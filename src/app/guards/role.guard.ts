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
      console.debug('[AuthDebug]', { op: 'RoleGuard.allow', reason: 'noRequiredRoles' });
      return of(true);
    }

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          console.debug('[AuthDebug]', { op: 'RoleGuard.redirectLogin', reason: 'missingUser' });
          this.router.navigate(['/login']);
          return false;
        }

        if (requiredRoles && !this.authService.hasRequiredRoles(requiredRoles)) {
          console.debug('[AuthDebug]', { op: 'RoleGuard.redirectUnauthorized', requiredRoles });
          this.router.navigate(['/unauthorized']);
          return false;
        }

        const excludeIndependent = route.data?.['excludeIndependent'] === true;
        if (excludeIndependent && this.authService.isIndependentTenant()) {
          console.debug('[AuthDebug]', { op: 'RoleGuard.redirectUnauthorized', reason: 'excludeIndependent' });
          this.router.navigate(['/unauthorized']);
          return false;
        }

        console.debug('[AuthDebug]', { op: 'RoleGuard.allow', reason: 'rolesOk', requiredRoles });
        return true;
      })
    );
  }
}
