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
