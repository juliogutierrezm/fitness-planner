import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiRequest = req.url.startsWith(environment.apiBase);
    const isAIGenerate = req.url.includes('/generatePlanFromAI');

    // Skip auth for non-API or public endpoints
    if (!isApiRequest || isAIGenerate || this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // Requests to API require auth (except public). If not authenticated, redirect to login.
    if (!this.authService.isAuthenticatedSync()) {
      try { this.router.navigate(['/login']); } catch {}
      // Let the request pass without token to avoid blocking; backend will 401 if needed
      return next.handle(req);
    }

    // Authenticated: attach token (avoid CORS preflight for simple GETs unless endpoint is protected)
    const needsAuthHeaderForGet = /\/(users|workoutPlans|tenant)|\/exercise(?!\/bulk)/.test(req.url);
    return this.authService.getIdToken().pipe(
      switchMap(token => {
        // Attach Authorization on non-GET requests, and on GET if explicitly required
        if (token && (req.method !== 'GET' || needsAuthHeaderForGet)) {
          const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
          return next.handle(authReq);
        }
        return next.handle(req);
      }),
      catchError(() => next.handle(req))
    );
  }

  private isPublicEndpoint(url: string): boolean {
    const publicEndpoints = [
      '/assets',
      '/health',
      '/public'
    ];
    
    return publicEndpoints.some(endpoint => url.includes(endpoint));
  }
}
