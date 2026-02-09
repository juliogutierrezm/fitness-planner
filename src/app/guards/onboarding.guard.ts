import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class OnboardingGuard implements CanActivate {
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
    // SSR: allow through; splash screen gates rendering.
    if (!this.isBrowser) {
      return of(true);
    }

    // Browser: wait for auth to resolve, then check authentication + roles.
    return this.authService.authStatus$.pipe(
      filter(status => status !== 'unknown'),
      take(1),
      map(status => {
        if (status !== 'authenticated') {
          this.router.navigate(['/login']);
          return false;
        }

        if (this.authService.isClientOnly()) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        if (this.authService.hasPlannerGroups()) {
          this.router.navigate(['/dashboard']);
          return false;
        }

        return true;
      })
    );
  }
}

