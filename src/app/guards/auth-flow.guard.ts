import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { AuthService, AuthFlowStep } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthFlowGuard implements CanActivate {
  private readonly isBrowser: boolean;

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    // SSR: allow through; splash screen gates rendering.
    if (!this.isBrowser) {
      return of(true);
    }

    // Browser: wait for auth to resolve, then evaluate the auth-flow route.
    return this.authService.authStatus$.pipe(
      filter(status => status !== 'unknown'),
      take(1),
      map(() => this.evaluateRoute(route))
    );
  }

  private evaluateRoute(route: ActivatedRouteSnapshot): boolean {
    const requiredFlow = route.data?.['flow'] as AuthFlowStep | 'none' | undefined;
    const fallback = route.data?.['fallback'] as string | undefined;
    const flowState = this.authService.getAuthFlowSnapshot();
    const currentPath = route.routeConfig?.path ? `/${route.routeConfig.path}` : '';
    void 0;
    if (this.authService.isAuthenticatedSync()) {
      const target = this.authService.resolveEntryTarget();
      void 0;
      this.router.navigate([target]);
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

