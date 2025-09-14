import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { AuthService, UserRole } from '../services/auth.service';

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

  private checkAuth(route: ActivatedRouteSnapshot): Observable<boolean> {
    // Ensure we refresh auth state once before deciding
    return from(this.authService.checkAuthState()).pipe(
      switchMap(() => this.authService.isAuthenticated$.pipe(
        take(1),
        switchMap(isAuthenticated => {
          if (!isAuthenticated) {
            // Prefer Hosted UI redirect if available
            try { this.authService.signInWithRedirect(); } catch {}
            this.router.navigate(['/login']);
            return of(false);
          }

          // Check role-based access
          const requiredRoles = route.data?.['roles'] as UserRole[];
          if (requiredRoles && requiredRoles.length > 0) {
            return this.authService.currentUser$.pipe(
              take(1),
              map(user => {
                if (!user || !requiredRoles.includes(user.role)) {
                  this.router.navigate(['/unauthorized']);
                  return false;
                }
                return true;
              })
            );
          }

          return of(true);
        })
      ))
    );
  }
}
