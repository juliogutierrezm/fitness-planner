import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ID_TOKEN_KEY = 'id_token';
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user_info';
  
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const user = this.loadUserFromStorage();
      this.userSubject.next(user);
    }
  }

  async login(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    const { domain, clientId, redirectUri } = environment.cognito;

    // PKCE support: generate code_verifier and code_challenge (S256)
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Persist the verifier for the token exchange step
    try {
      sessionStorage.setItem('pkce_verifier', codeVerifier);
    } catch {}

    const authUrl = `https://${domain}/oauth2/authorize` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&scope=email+openid+profile` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&identity_provider=COGNITO` +
      `&code_challenge_method=S256` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}`;
    
    window.location.href = authUrl;
  }

  async handleCallback(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      try {
        const tokens = await this.exchangeCodeForTokens(code);
        this.setTokens(tokens.id_token, tokens.access_token);
        
        const user = this.parseTokenPayload(tokens.id_token);
        this.setUser(user);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Token exchange failed:', error);
        this.logout();
      }
    }
  }

  getIdToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(this.ID_TOKEN_KEY);
  }

  getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  isLoggedIn(): boolean {
    const token = this.getIdToken();
    if (!token) {
      return false;
    }

    try {
      // Check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.ID_TOKEN_KEY);
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      this.userSubject.next(null);
      
      const { domain, clientId, redirectUri } = environment.cognito;
      // Ensure trailing slash so it matches Cognito Sign-out URLs exactly
      let postLogoutRedirect = '';
      try {
        const u = new URL(redirectUri);
        postLogoutRedirect = `${u.origin}/`;
      } catch {
        // Fallback: replace '/callback' with '/'
        postLogoutRedirect = redirectUri.replace(/\/callback$/, '/');
      }

      const logoutUrl = `https://${domain}/logout` +
        `?client_id=${clientId}` +
        `&logout_uri=${encodeURIComponent(postLogoutRedirect)}`;
      
      window.location.href = logoutUrl;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<any> {
    const { domain, clientId, redirectUri } = environment.cognito;
    
    const tokenEndpoint = `https://${domain}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri
    });

    // Include PKCE verifier if available
    try {
      const verifier = sessionStorage.getItem('pkce_verifier');
      if (verifier) {
        body.set('code_verifier', verifier);
      }
    } catch {}

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Cleanup PKCE verifier on success
    try { sessionStorage.removeItem('pkce_verifier'); } catch {}
    return data;
  }

  // PKCE helpers
  private generateCodeVerifier(length: number = 64): string {
    // RFC 7636: 43-128 chars, unreserved [A-Z / a-z / 0-9 / - . _ ~]
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += charset[array[i] % charset.length];
      }
    } else {
      // Fallback (less secure, but avoids crash in non-browser env)
      for (let i = 0; i < length; i++) {
        result += charset[Math.floor(Math.random() * charset.length)];
      }
    }
    return result;
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return this.base64UrlEncode(new Uint8Array(digest));
    }
    // Fallback without subtle crypto is not ideal; return verifier (plain) which some configs accept
    return verifier;
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    let str = '';
    bytes.forEach(b => { str += String.fromCharCode(b); });
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private parseTokenPayload(idToken: string): User {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email?.split('@')[0] || 'User'
    };
  }

  private setTokens(idToken: string, accessToken: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.ID_TOKEN_KEY, idToken);
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    }
  }

  private setUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this.userSubject.next(user);
  }

  private loadUserFromStorage(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    
    const token = this.getIdToken();
    const userStr = localStorage.getItem(this.USER_KEY);
    
    if (token && userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Failed to parse user from storage:', error);
        localStorage.removeItem(this.USER_KEY);
      }
    }
    
    return null;
  }
}
