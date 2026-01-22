import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { map, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

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

  private checkAuth(_route: ActivatedRouteSnapshot): Observable<boolean> {
    // Ensure we refresh auth state once before deciding
    return from(this.authService.checkAuthState()).pipe(
      switchMap(() => this.authService.isAuthenticated$.pipe(
        take(1),
        map(isAuthenticated => {
          if (!isAuthenticated) {
            // Prefer Hosted UI redirect if available
            try { this.authService.signInWithRedirect(); } catch {}
            this.router.navigate(['/login']);
            return false;
          }

          return true;
        })
      ))
    );
  }
}
