import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  darkMode?: boolean;  // UI mapping for backgroundMode
  backgroundMode?: string;  // Backend: 'dark' | 'light'
  typography?: string;  // UI mapping for fontFamily
  fontFamily?: string;  // Backend field
  logoKey?: string;  // Backend: S3 key path
  logoUrl?: string;  // Used only for display
  appName?: string;  // Max 40 chars
  tagline?: string;  // Max 80 chars
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<ThemeConfig | null>(null);
  public theme$ = this.themeSubject.asObservable();

  private readonly isBrowser: boolean;

  // Default theme values
  private readonly defaultTheme: ThemeConfig = {
    primaryColor: '#FF9900',
    accentColor: '#22D3EE',
    backgroundMode: 'light',
    fontFamily: 'Inter',
    logoUrl: '/assets/TrainGrid.png'
  };

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private getApiBaseUrl(): string {
    // Use apiUrl from environment
    // Dev: /api (proxy redirects to backend)
    // Prod: full URL from environment
    return environment.apiUrl;
  }

  /**
   * Get current theme configuration from server
   */
  getTheme(): Observable<ThemeConfig> {
    return this.http.get<ThemeConfig>(`${this.getApiBaseUrl()}/tenant/theme`);
  }

  /**
   * Save theme configuration to server
   */
  saveTheme(config: ThemeConfig): Observable<ThemeConfig> {
    return this.http.put<ThemeConfig>(`${this.getApiBaseUrl()}/tenant/theme`, config);
  }

  /**
   * Get pre-signed URL for logo upload
   */
  getLogoUploadUrl(filename: string, contentType: string): Observable<{ uploadUrl: string; fileKey: string }> {
    return this.http.post<any>(
      `${this.getApiBaseUrl()}/tenant/logo-upload-url`,
      { filename, contentType }
    ).pipe(
      map(response => ({
        uploadUrl: response.uploadUrl,
        fileKey: response.key // Map 'key' from Lambda to 'fileKey'
      }))
    );
  }

  /**
   * Upload logo directly to S3 using pre-signed URL
   * Uses native fetch, NOT HttpClient (to avoid interceptors)
   */
  async uploadLogoToS3(uploadUrl: string, file: File): Promise<void> {
    // Using fetch instead of HttpClient to avoid interceptors
    // Only send Content-Type header - it's required to match the signature
    // Don't send x-amz-* headers as they trigger CORS preflight which S3 doesn't handle
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('S3 upload error:', errorText);
      throw new Error(`Failed to upload logo: ${response.statusText}`);
    }

    // Don't try to read response body - just verify success
  }

  /**
   * Get default theme
   */
  getDefaultTheme(): ThemeConfig {
    return { ...this.defaultTheme };
  }

  /**
   * Load theme from server and cache it
   */
  loadTheme(): Observable<ThemeConfig> {
    return new Observable(subscriber => {
      this.getTheme().subscribe({
        next: (theme) => {
          this.themeSubject.next(theme);
          subscriber.next(theme);
          subscriber.complete();
        },
        error: (error) => {
          // If theme not configured, use defaults
          console.log('Using default theme:', error);
          this.themeSubject.next(this.defaultTheme);
          subscriber.next(this.defaultTheme);
          subscriber.complete();
        }
      });
    });
  }

  /**
   * Get current theme value (useful for synchronous access)
   */
  getCurrentTheme(): ThemeConfig {
    return this.themeSubject.value || this.defaultTheme;
  }

  /**
   * Update theme in memory
   */
  setThemeInMemory(config: ThemeConfig): void {
    this.themeSubject.next(config);
  }
}
