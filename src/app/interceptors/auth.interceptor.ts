/**
 * Purpose: Attach Cognito Bearer tokens to API requests and validate JWT issuer.
 * Input: HttpRequest. Output: HttpEvent with Authorization header (or blocked on mismatch).
 * Error handling: silently passes through on token fetch failure; blocks on issuer mismatch.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { fetchAuthSession } from 'aws-amplify/auth';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  /** Expected JWT issuer based on the environment's Cognito User Pool */
  private readonly expectedIssuer =
    `https://cognito-idp.us-east-1.amazonaws.com/${environment.cognito.userPoolId}`;

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    // Only attach tokens to requests targeting our API
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

        // Validate JWT issuer matches the expected Cognito pool for this environment
        const issuer = this.extractIssuerFromJwt(token);
        if (issuer && issuer !== this.expectedIssuer) {
          const message =
            `[AuthInterceptor] JWT issuer mismatch — ` +
            `token iss: ${issuer}, expected: ${this.expectedIssuer}. ` +
            `Request to ${req.url} blocked.`;

          if (!environment.production) {
            console.error(message);
          }

          return throwError(() => new Error(
            'Environment/token mismatch: JWT was issued by a different Cognito pool than expected.'
          ));
        }

        return next.handle(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          })
        );
      }),
      catchError(err => {
        // Re-throw environment mismatch errors — they must not be silenced
        if (err?.message?.includes('Environment/token mismatch')) {
          return throwError(() => err);
        }
        // For any other error (e.g. no session), pass request through without token
        return next.handle(req);
      })
    );
  }

  /**
   * Decode the JWT payload (base64url) and extract the `iss` claim.
   * No external library needed — JWT structure is header.payload.signature.
   */
  private extractIssuerFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      // base64url → base64 → decode
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.iss ?? null;
    } catch {
      return null;
    }
  }
}
