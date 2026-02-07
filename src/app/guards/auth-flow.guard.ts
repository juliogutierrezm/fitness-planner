import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { catchError, map, tap, filter, switchMap, take } from 'rxjs/operators';
import { AuthService, AuthFlowStep } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthFlowGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    // SSR/hydration note: auth is unknown on server; do not redirect to /login.
    if (this.authService.getAuthStatusSync() === 'unknown') {
      void 0;
      return of(true);
    }
    return from(this.authService.checkAuthState()).pipe(
      tap(() => void 0),
      switchMap(() => this.authService.isAuthLoading$.pipe(
        filter(isLoading => !isLoading),
        take(1),
        map(() => this.evaluateRoute(route))
      )),
      tap(result => void 0),
      catchError(error => {
        console.error('[AuthDebug]', { op: 'AuthFlowGuard.error', error });
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }

  private evaluateRoute(route: ActivatedRouteSnapshot): boolean {
    const requiredFlow = route.data?.['flow'] as AuthFlowStep | 'none' | undefined;
    const fallback = route.data?.['fallback'] as string | undefined;
    const flowState = this.authService.getAuthFlowSnapshot();
    const currentPath = route.routeConfig?.path ? `/${route.routeConfig.path}` : '';
    void 0;
    if (this.authService.isAuthenticatedSync()) {
      void 0;
      this.router.navigate(['/dashboard']);
      return false;
    }

    if (flowState && (!flowState.step || !flowState.username)) {
      void 0;
      this.authService.clearAuthFlowState();
    }

    if (requiredFlow === undefined) {
      void 0;
      return true;
    }

    if (requiredFlow === 'none') {
      if (flowState?.step) {
        const target = this.authService.getAuthFlowRoute(flowState.step);
        if (currentPath && target === currentPath) {
          void 0;
          return true;
        }
        void 0;
        this.router.navigate([target]);
        return false;
      }
      void 0;
      return true;
    }

    if (!flowState || flowState.step !== requiredFlow) {
      if (flowState?.step) {
        const target = this.authService.getAuthFlowRoute(flowState.step);
        void 0;
        this.router.navigate([target]);
        return false;
      }
      const target = fallback || '/login';
      void 0;
      this.router.navigate([target]);
      return false;
    }

    void 0;
    return true;
  }
}

