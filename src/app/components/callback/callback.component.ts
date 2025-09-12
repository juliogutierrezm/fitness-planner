import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule
  ],
  template: `
    <div class="callback-container">
      <mat-card class="callback-card">
        <mat-card-content>
          <div class="callback-content" *ngIf="!error">
            <mat-spinner diameter="50"></mat-spinner>
            <h2>Completando autenticación...</h2>
            <p>Por favor espera mientras procesamos tu información.</p>
          </div>
          
          <div class="error-content" *ngIf="error">
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h2>Error de autenticación</h2>
            <p>{{ error }}</p>
            <button mat-button (click)="retryLogin()">
              Intentar de nuevo
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .callback-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 20px;
    }

    .callback-card {
      width: 100%;
      max-width: 400px;
      text-align: center;
    }

    .callback-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 40px 20px;
    }

    .error-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px 20px;
    }

    .error-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #f44336;
    }

    h2 {
      margin: 0;
      color: #333;
    }

    p {
      margin: 0;
      color: #666;
    }

    button {
      margin-top: 16px;
    }
  `]
})
export class CallbackComponent implements OnInit {
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      // Handle the OAuth callback
      await this.authService.handleCallback();
      
      // Check if authentication was successful
      if (this.authService.isLoggedIn()) {
        // Redirect to dashboard on successful authentication
        this.router.navigate(['/dashboard']);
      } else {
        this.error = 'No se pudo completar la autenticación.';
      }
    } catch (error) {
      console.error('Callback error:', error);
      this.error = 'Error procesando la autenticación. Por favor intenta de nuevo.';
    }
  }

  retryLogin() {
    this.authService.login();
  }
}