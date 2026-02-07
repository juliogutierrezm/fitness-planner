import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { map, take, switchMap, catchError, tap, filter } from 'rxjs/operators';
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
    // SSR/hydration note: do not redirect while auth is unknown.
    if (this.authService.getAuthStatusSync() === 'unknown') {
      void 0;
      return of(true);
    }
    return from(this.authService.checkAuthState()).pipe(
      tap(() => void 0),
      switchMap(() => this.authService.isAuthLoading$.pipe(
        filter(isLoading => !isLoading),
        take(1),
        switchMap(() => this.authService.isAuthenticated$.pipe(
          take(1),
          map(isAuthenticated => {
            void 0;
            if (!isAuthenticated) {
              void 0;
              this.router.navigate(['/login']);
              return false;
            }

            if (this.authService.isClientOnly()) {
              void 0;
              this.router.navigate(['/unauthorized']);
              return false;
            }

            if (this.authService.hasPlannerGroups()) {
              void 0;
              this.router.navigate(['/dashboard']);
              return false;
            }

            return true;
          })
        ))
      )),
      catchError(error => {
        console.error('[AuthDebug]', { op: 'OnboardingGuard.error', error });
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}

