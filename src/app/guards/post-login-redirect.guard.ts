import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PostLoginRedirectGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Avoid loops: if already on onboarding route, don't redirect again
    if (route.routeConfig?.path === 'onboarding' || state.url?.startsWith('/onboarding')) {
      console.debug('[AuthDebug]', { op: 'PostLoginRedirectGuard.allow', reason: 'alreadyOnOnboarding', url: state.url });
      return true;
    }

    if (!this.authService.isAuthenticatedSync()) {
      console.debug('[AuthDebug]', { op: 'PostLoginRedirectGuard.allow', reason: 'notAuthenticated', url: state.url });
      return true;
    }

    if (this.authService.isClientOnly()) {
      console.debug('[AuthDebug]', { op: 'PostLoginRedirectGuard.redirectUnauthorized', reason: 'clientOnly' });
      this.router.navigate(['/unauthorized']);
      return false;
    }

    if (!this.authService.hasPlannerGroups()) {
      console.debug('[AuthDebug]', { op: 'PostLoginRedirectGuard.redirectOnboarding', reason: 'missingPlannerGroups' });
      this.router.navigate(['/onboarding']);
      return false;
    }
    console.debug('[AuthDebug]', { op: 'PostLoginRedirectGuard.allow', reason: 'plannerAccess' });
    return true;
  }
}
