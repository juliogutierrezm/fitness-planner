import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { fetchAuthSession } from 'aws-amplify/auth';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    if (!req.url.startsWith(environment.apiBase)) {
      return next.handle(req);
    }

    return from(fetchAuthSession()).pipe(
      switchMap(session => {
        const token =
          session?.tokens?.idToken?.toString() ??
          session?.tokens?.accessToken?.toString();

        if (!token) {
          return next.handle(req);
        }

        console.debug('[Authorization] JWT attached');

        return next.handle(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          })
        );
      }),
      catchError(() => next.handle(req))
    );
  }
}
