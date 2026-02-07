import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService, UserRole } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredRoles = route.data?.['roles'] as UserRole[];
    
    if (!requiredRoles || requiredRoles.length === 0) {
      void 0;
      return of(true);
    }

    // SSR/hydration note: while auth is 'unknown', do not redirect.
    if (this.authService.getAuthStatusSync() === 'unknown') {
      void 0;
      return of(true);
    }

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          void 0;
          this.router.navigate(['/login']);
          return false;
        }

        if (requiredRoles && !this.authService.hasRequiredRoles(requiredRoles)) {
          void 0;
          this.router.navigate(['/unauthorized']);
          return false;
        }

        const excludeIndependent = route.data?.['excludeIndependent'] === true;
        if (excludeIndependent && this.authService.isIndependentTenant()) {
          void 0;
          this.router.navigate(['/unauthorized']);
          return false;
        }

        void 0;
        return true;
      })
    );
  }
}

