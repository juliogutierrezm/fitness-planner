import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { map, take, switchMap, catchError, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class OnboardingGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return from(this.authService.checkAuthState()).pipe(
      tap(() => console.debug('[AuthDebug]', { op: 'OnboardingGuard.checkAuthStateComplete' })),
      switchMap(() => this.authService.isAuthenticated$.pipe(
        take(1),
        map(isAuthenticated => {
          console.debug('[AuthDebug]', { op: 'OnboardingGuard.isAuthenticated', isAuthenticated });
          if (!isAuthenticated) {
            console.debug('[AuthDebug]', { op: 'OnboardingGuard.redirectLogin' });
            this.router.navigate(['/login']);
            return false;
          }

          if (this.authService.isClientOnly()) {
            console.debug('[AuthDebug]', { op: 'OnboardingGuard.redirectUnauthorized', reason: 'clientOnly' });
            this.router.navigate(['/unauthorized']);
            return false;
          }

          if (this.authService.hasPlannerGroups()) {
            console.debug('[AuthDebug]', { op: 'OnboardingGuard.redirectDashboard', reason: 'plannerGroups' });
            this.router.navigate(['/dashboard']);
            return false;
          }

          return true;
        })
      )),
      catchError(error => {
        console.error('[AuthDebug]', { op: 'OnboardingGuard.error', error });
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
