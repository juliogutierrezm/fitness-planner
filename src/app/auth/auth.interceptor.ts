import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only attach token for requests to our API
    const isApiRequest = req.url.startsWith(environment.apiBase);
    const idToken = this.authService.getIdToken();

    if (isApiRequest && idToken && this.authService.isLoggedIn()) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${idToken}`
        }
      });
      return next.handle(authReq);
    }

    return next.handle(req);
  }
}