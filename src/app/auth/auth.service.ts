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

  login(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    const { domain, clientId, redirectUri } = environment.cognito;
    const authUrl = `https://${domain}/oauth2/authorize` +
      `?client_id=${clientId}` +
      `&response_type=code` +
      `&scope=email+openid+profile` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
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
      const baseRedirectUri = redirectUri.replace('/callback', '');
      const logoutUrl = `https://${domain}/logout` +
        `?client_id=${clientId}` +
        `&logout_uri=${encodeURIComponent(baseRedirectUri)}`;
      
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

    return response.json();
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