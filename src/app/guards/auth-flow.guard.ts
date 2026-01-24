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
    return from(this.authService.checkAuthState()).pipe(
      tap(() => console.debug('[AuthDebug]', { op: 'AuthFlowGuard.checkAuthStateComplete' })),
      switchMap(() => this.authService.isAuthLoading$.pipe(
        filter(isLoading => !isLoading),
        take(1),
        map(() => this.evaluateRoute(route))
      )),
      tap(result => console.debug('[AuthDebug]', { op: 'AuthFlowGuard.evaluateRoute.result', result })),
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
    console.debug('[AuthDebug]', {
      op: 'AuthFlowGuard.evaluateRoute.start',
      requiredFlow,
      fallback,
      flowState,
      currentPath
    });
    if (this.authService.isAuthenticatedSync()) {
      console.debug('[AuthDebug]', { op: 'AuthFlowGuard.redirectDashboard', reason: 'alreadyAuthenticated' });
      this.router.navigate(['/dashboard']);
      return false;
    }

    if (flowState && (!flowState.step || !flowState.username)) {
      console.debug('[AuthDebug]', { op: 'AuthFlowGuard.clearInvalidFlowState', flowState });
      this.authService.clearAuthFlowState();
    }

    if (requiredFlow === undefined) {
      console.debug('[AuthDebug]', { op: 'AuthFlowGuard.allow', reason: 'noRequiredFlow' });
      return true;
    }

    if (requiredFlow === 'none') {
      if (flowState?.step) {
        const target = this.authService.getAuthFlowRoute(flowState.step);
        if (currentPath && target === currentPath) {
          console.debug('[AuthDebug]', { op: 'AuthFlowGuard.allow', reason: 'alreadyOnFlowRoute', target });
          return true;
        }
        console.debug('[AuthDebug]', { op: 'AuthFlowGuard.redirectToFlow', target });
        this.router.navigate([target]);
        return false;
      }
      console.debug('[AuthDebug]', { op: 'AuthFlowGuard.allow', reason: 'noActiveFlow' });
      return true;
    }

    if (!flowState || flowState.step !== requiredFlow) {
      if (flowState?.step) {
        const target = this.authService.getAuthFlowRoute(flowState.step);
        console.debug('[AuthDebug]', { op: 'AuthFlowGuard.redirectToFlow', target });
        this.router.navigate([target]);
        return false;
      }
      const target = fallback || '/login';
      console.debug('[AuthDebug]', { op: 'AuthFlowGuard.redirectFallback', target });
      this.router.navigate([target]);
      return false;
    }

    console.debug('[AuthDebug]', { op: 'AuthFlowGuard.allow', reason: 'flowMatched', requiredFlow });
    return true;
  }
}
