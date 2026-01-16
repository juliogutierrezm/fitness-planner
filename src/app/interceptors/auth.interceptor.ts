import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiRequest = req.url.startsWith(environment.apiBase);

    // Requests que no van al API
    if (!isApiRequest || this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // Usuario no autenticado
    if (!this.authService.isAuthenticatedSync()) {
      try { this.router.navigate(['/login']); } catch {}
      return next.handle(req);
    }

    // 🔑 SIEMPRE adjuntar ID token
    return this.authService.getIdToken().pipe(
      switchMap(token => {
        if (!token) {
          return next.handle(req);
        }

        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });

        return next.handle(authReq);
      })
    );
  }

  private isPublicEndpoint(url: string): boolean {
    return ['/assets', '/health', '/public'].some(p => url.includes(p));
  }
}


