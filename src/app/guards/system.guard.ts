import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Purpose: Guard that restricts access to routes requiring System group membership.
 * Only users belonging to the Cognito 'System' group can access protected routes.
 * This guard validates technical permissions for exercises management and diagnostics.
 * Input: route, state. Output: Observable<boolean>.
 * Error handling: redirects to /unauthorized if user lacks System group.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({
  providedIn: 'root'
})
export class SystemGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // SSR/hydration note: while auth is 'unknown', do not redirect.
    if (this.authService.getAuthStatusSync() === 'unknown') {
      console.debug('[AuthDebug]', { op: 'SystemGuard.allow', reason: 'authUnknown', url: state.url });
      return of(true);
    }

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          console.debug('[AuthDebug]', { op: 'SystemGuard.redirectLogin', reason: 'missingUser' });
          this.router.navigate(['/login']);
          return false;
        }

        // Check if user belongs to System group
        if (!this.authService.isSystem()) {
          console.debug('[AuthDebug]', { 
            op: 'SystemGuard.redirectUnauthorized', 
            reason: 'notSystemGroup',
            userGroups: user.groups 
          });
          this.router.navigate(['/unauthorized']);
          return false;
        }

        console.debug('[AuthDebug]', { op: 'SystemGuard.allow', reason: 'systemGroupOk' });
        return true;
      })
    );
  }
}
