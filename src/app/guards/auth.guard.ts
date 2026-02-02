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
      console.debug('[AuthDebug]', { op: 'AuthGuard.checkAuth.allow', reason: 'authUnknown' });
      return of(true);
    }

    // Browser: Ensure we refresh auth state once before deciding
    return from(this.authService.checkAuthState()).pipe(
      tap(() => console.debug('[AuthDebug]', { op: 'AuthGuard.checkAuth.checkAuthStateComplete' })),
      switchMap(() => this.authService.isAuthLoading$.pipe(
        filter(isLoading => !isLoading),
        take(1),
        switchMap(() => this.authService.isAuthenticated$.pipe(
          take(1),
          map(isAuthenticated => {
            console.debug('[AuthDebug]', { op: 'AuthGuard.checkAuth.isAuthenticated', isAuthenticated });
            if (!isAuthenticated) {
              console.debug('[AuthDebug]', { op: 'AuthGuard.checkAuth.redirectLogin' });
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
