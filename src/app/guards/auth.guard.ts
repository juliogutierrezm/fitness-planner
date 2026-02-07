import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { map, take, switchMap, catchError, tap, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(childRoute);
  }

  private checkAuth(_route: ActivatedRouteSnapshot): Observable<boolean> {
    // SSR/hydration note:
    // - On the server we cannot resolve browser auth tokens, so authStatus remains 'unknown'.
    // - We must NOT redirect to /login in that state (it breaks deep links and causes login flash).
    if (this.authService.getAuthStatusSync() === 'unknown') {
      void 0;
      return of(true);
    }

    // Browser: Ensure we refresh auth state once before deciding
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

            return true;
          })
        ))
      )),
      catchError(error => {
        console.error('[AuthDebug]', { op: 'AuthGuard.checkAuth.error', error });
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}

