import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../auth/auth.service';
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
  template: `
    <div class="diagnostics-container">
      <mat-card class="diagnostics-card">
        <mat-card-header>
          <mat-card-title>🔍 Authentication Diagnostics</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <!-- Login State -->
          <div class="section">
            <h3><mat-icon>verified_user</mat-icon> Authentication Status</h3>
            <div class="status-grid">
              <div class="status-item">
                <strong>Logged In:</strong> 
                <span [class]="isLoggedIn ? 'success' : 'error'">
                  {{ isLoggedIn ? '✅ Yes' : '❌ No' }}
                </span>
              </div>
              <div class="status-item" *ngIf="user">
                <strong>Email:</strong> {{ user.email }}
              </div>
              <div class="status-item" *ngIf="user">
                <strong>Subject:</strong> {{ user.id }}
              </div>
              <div class="status-item" *ngIf="tokenExpiration">
                <strong>Token Expires:</strong> {{ tokenExpiration | date:'medium' }}
              </div>
              <div class="status-item" *ngIf="timeToExpire">
                <strong>Time to Expire:</strong> 
                <span [class]="timeToExpire < 300 ? 'warning' : 'success'">
                  {{ formatTimeToExpire(timeToExpire) }}
                </span>
              </div>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- API Test Buttons -->
          <div class="section">
            <h3><mat-icon>api</mat-icon> API Tests</h3>
            <div class="button-group">
              <button mat-raised-button color="primary" (click)="callExerciseApi()" [disabled]="loading">
                <mat-icon>fitness_center</mat-icon>
                Call /exercise
              </button>
              <button mat-raised-button color="accent" (click)="callWorkoutPlansApi()" [disabled]="loading">
                <mat-icon>library_books</mat-icon>
                Call /workoutPlans
              </button>
            </div>
            
            <!-- Last API Call Result -->
            <div *ngIf="lastApiCall" class="api-result">
              <h4>Last API Call Result:</h4>
              <div class="result-header">
                <strong>{{ lastApiCall.timestamp | date:'medium' }}</strong>
                <span [class]="getStatusClass(lastApiCall.status)">
                  {{ lastApiCall.status ? 'HTTP ' + lastApiCall.status : 'ERROR' }}
                </span>
              </div>
              <div class="result-body">
                <pre *ngIf="lastApiCall.body">{{ formatJson(lastApiCall.body) }}</pre>
                <div *ngIf="lastApiCall.error" class="error-text">{{ lastApiCall.error }}</div>
              </div>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Token Decoder -->
          <div class="section">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>code</mat-icon>
                  Decode JWT Token
                </mat-panel-title>
              </mat-expansion-panel-header>
              
              <div *ngIf="decodedToken" class="token-decode">
                <div class="token-section">
                  <h4>Header:</h4>
                  <pre>{{ formatJson(decodedToken.header) }}</pre>
                </div>
                <div class="token-section">
                  <h4>Payload:</h4>
                  <pre>{{ formatJson(decodedToken.payload) }}</pre>
                </div>
                <div class="token-info">
                  <small><em>Signature verification not shown for security</em></small>
                </div>
              </div>
              <div *ngIf="!decodedToken" class="no-token">
                No valid token available
              </div>
            </mat-expansion-panel>
          </div>

        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .diagnostics-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .diagnostics-card {
      margin-bottom: 20px;
    }

    .section {
      margin: 20px 0;
    }

    .section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      color: #1976d2;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }

    .status-item {
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .button-group {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .api-result {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .result-body {
      max-height: 300px;
      overflow: auto;
    }

    .result-body pre {
      background: #2d3748;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
      margin: 0;
      overflow: auto;
    }

    .token-decode {
      margin-top: 16px;
    }

    .token-section {
      margin-bottom: 20px;
    }

    .token-section h4 {
      margin-bottom: 8px;
      color: #424242;
    }

    .token-section pre {
      background: #2d3748;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
      overflow: auto;
    }

    .token-info {
      text-align: center;
      margin-top: 16px;
      color: #666;
    }

    .no-token {
      text-align: center;
      color: #999;
      padding: 20px;
    }

    .success { color: #4caf50; }
    .error { color: #f44336; }
    .warning { color: #ff9800; }

    .status-2xx { color: #4caf50; }
    .status-4xx { color: #ff9800; }
    .status-5xx { color: #f44336; }

    .error-text {
      color: #f44336;
      background: #ffebee;
      padding: 8px;
      border-radius: 4px;
      border-left: 4px solid #f44336;
    }
  `]
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
    this.updateAuthInfo();
    
    // Subscribe to user changes
    this.authService.user$.subscribe(() => {
      this.updateAuthInfo();
    });
  }

  private updateAuthInfo() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.user = this.authService.getUser();
    
    const token = this.authService.getIdToken();
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
      }
    } else {
      this.decodedToken = null;
      this.tokenExpiration = null;
      this.timeToExpire = null;
    }
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