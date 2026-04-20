import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
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
    return this.checkAuth(route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(childRoute);
  }

  private checkAuth(_route: ActivatedRouteSnapshot): Observable<boolean> {
    // SSR: cannot resolve auth tokens on the server; allow through.
    // The splash screen in AppComponent gates rendering until auth resolves on client.
    if (!this.isBrowser) {
      return of(true);
    }

    // Browser: wait for auth to resolve (filter out 'unknown'), then decide.
    // This eliminates the race between APP_INITIALIZER and withEnabledBlockingInitialNavigation().
    return this.authService.authStatus$.pipe(
      filter(status => status !== 'unknown'),
      take(1),
      map(status => {
        if (status === 'authenticated') {
          return true;
        }
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}

