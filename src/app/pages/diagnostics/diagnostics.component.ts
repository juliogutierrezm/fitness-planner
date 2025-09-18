import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface ApiCallResult {
  status?: number;
  body?: any;
  error?: string;
  timestamp: Date;
}

@Component({
  selector: 'app-diagnostics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatExpansionModule
  ],
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})
export class DiagnosticsComponent implements OnInit {
  isLoggedIn = false;
  user: any = null;
  tokenExpiration: Date | null = null;
  timeToExpire: number | null = null;
  decodedToken: any = null;
  lastApiCall: ApiCallResult | null = null;
  loading = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // Subscribe to auth state
    this.authService.isAuthenticated$.subscribe(isAuth => {
      this.isLoggedIn = isAuth;
    });
    // Subscribe to user changes and refresh token info
    this.authService.currentUser$.subscribe(() => {
      this.updateAuthInfo();
    });
  }

  private updateAuthInfo() {
    this.user = this.authService.getCurrentUser();
    
    this.authService.getIdToken().subscribe(token => {
      if (token) {
        try {
          this.decodedToken = this.decodeToken(token);
          const exp = this.decodedToken.payload.exp;
          if (exp) {
            this.tokenExpiration = new Date(exp * 1000);
            this.timeToExpire = exp - Math.floor(Date.now() / 1000);
          }
        } catch (error) {
          console.error('Error decoding token:', error);
          this.decodedToken = null;
          this.tokenExpiration = null;
          this.timeToExpire = null;
        }
      } else {
        this.decodedToken = null;
        this.tokenExpiration = null;
        this.timeToExpire = null;
      }
    });
  }

  private decodeToken(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token');
    }

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    return { header, payload };
  }

  formatTimeToExpire(seconds: number): string {
    if (seconds <= 0) return 'EXPIRED';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  getStatusClass(status?: number): string {
    if (!status) return 'error';
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500) return 'status-5xx';
    return '';
  }

  formatJson(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  async callExerciseApi() {
    this.loading = true;
    const url = `${environment.apiBase}/exercise`;
    
    try {
      const response = await this.http.get(url).toPromise();
      this.lastApiCall = {
        status: 200,
        body: response,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.lastApiCall = {
        status: error.status,
        error: error.message || 'Network error',
        body: error.error,
        timestamp: new Date()
      };
    } finally {
      this.loading = false;
    }
  }

  async callWorkoutPlansApi() {
    this.loading = true;
    // Use subject from token as trainerId, fallback to "test-trainer"
    const trainerId = this.user?.id || 'test-trainer';
    const url = `${environment.apiBase}/workoutPlans?trainerId=${trainerId}`;
    
    try {
      const response = await this.http.get(url).toPromise();
      this.lastApiCall = {
        status: 200,
        body: response,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.lastApiCall = {
        status: error.status,
        error: error.message || 'Network error',
        body: error.error,
        timestamp: new Date()
      };
    } finally {
      this.loading = false;
    }
  }
}
