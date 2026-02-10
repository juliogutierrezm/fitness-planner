import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { AuthService, UserRole } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
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
    const requiredRoles = route.data?.['roles'] as UserRole[];

    if (!requiredRoles || requiredRoles.length === 0) {
      return of(true);
    }

    // SSR: allow through; splash screen gates rendering.
    if (!this.isBrowser) {
      return of(true);
    }

    // Browser: wait for auth status to resolve, then check roles from auth snapshot.
    return this.authService.authStatus$.pipe(
      filter(status => status !== 'unknown'),
      take(1),
      map(status => {
        if (status !== 'authenticated') {
          this.router.navigate(['/login']);
          return false;
        }

        const user = this.authService.getCurrentUser();
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }

        if (requiredRoles && !this.authService.hasRequiredRoles(requiredRoles)) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        const excludeIndependent = route.data?.['excludeIndependent'] === true;
        if (excludeIndependent && this.authService.isIndependentTenant()) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}

