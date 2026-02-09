import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Guard that restricts access to routes requiring System group membership.
 * Only users belonging to the Cognito 'System' group can access protected routes.
 */
@Injectable({
  providedIn: 'root'
})
export class SystemGuard implements CanActivate {
  private readonly isBrowser: boolean;

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // SSR: allow through; splash screen gates rendering.
    if (!this.isBrowser) {
      return of(true);
    }

    // Browser: wait for auth to resolve, then check System group.
    return this.authService.currentUser$.pipe(
      filter(() => this.authService.getAuthStatusSync() !== 'unknown'),
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }

        if (!this.authService.isSystem()) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}

