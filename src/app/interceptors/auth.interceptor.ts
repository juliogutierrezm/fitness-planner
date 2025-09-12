import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip authentication for public endpoints
    if (this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // Add JWT token to requests
    return this.authService.getIdToken().pipe(
      switchMap(token => {
        let authReq = req;
        
        if (token) {
          authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });
        }

        // Add user context headers for backend
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          authReq = authReq.clone({
            setHeaders: {
              ...authReq.headers,
              'X-User-Id': currentUser.id,
              'X-User-Role': currentUser.role,
              ...(currentUser.companyId && { 'X-Company-Id': currentUser.companyId })
            }
          });
        }

        return next.handle(authReq);
      }),
      catchError(error => {
        console.error('Auth interceptor error:', error);
        return next.handle(req);
      })
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