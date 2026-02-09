import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PostLoginRedirectGuard implements CanActivate {
  private readonly isBrowser: boolean;

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // SSR: allow through; AuthGuard + splash screen handle gating.
    if (!this.isBrowser) {
      return true;
    }

    // Avoid loops: if already on onboarding route, don't redirect again
    if (route.routeConfig?.path === 'onboarding' || state.url?.startsWith('/onboarding')) {
      return true;
    }

    if (!this.authService.isAuthenticatedSync()) {
      return true;
    }

    if (this.authService.isClientOnly()) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    if (!this.authService.hasPlannerGroups()) {
      this.router.navigate(['/onboarding']);
      return false;
    }

    return true;
  }
}

