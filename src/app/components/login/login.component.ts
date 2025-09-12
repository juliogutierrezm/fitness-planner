import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { signInWithRedirect, signUp, signIn } from 'aws-amplify/auth';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>fitness_center</mat-icon>
            Fitness Planner
          </mat-card-title>
          <mat-card-subtitle>
            Planifica y gestiona entrenamientos profesionales
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="login-content">
            <div class="welcome-text">
              <h2>Bienvenido</h2>
              <p>Inicia sesión para acceder a tu cuenta</p>
            </div>

            <div class="auth-buttons" *ngIf="!loading">
              <button 
                mat-raised-button 
                color="primary" 
                class="auth-button"
                (click)="signInWithHostedUI()">
                <mat-icon>login</mat-icon>
                Iniciar Sesión
              </button>

              <div class="divider">
                <span>¿No tienes cuenta?</span>
              </div>

              <button 
                mat-outlined-button 
                color="primary" 
                class="auth-button"
                (click)="signUpWithHostedUI()">
                <mat-icon>person_add</mat-icon>
                Registrarse
              </button>
            </div>

            <div class="loading-spinner" *ngIf="loading">
              <mat-spinner diameter="50"></mat-spinner>
              <p>Redirigiendo...</p>
            </div>

            <div class="features">
              <h3>Características</h3>
              <ul>
                <li><mat-icon>check_circle</mat-icon> Gestión de ejercicios</li>
                <li><mat-icon>check_circle</mat-icon> Planes de entrenamiento personalizados</li>
                <li><mat-icon>check_circle</mat-icon> Generación de rutinas con IA</li>
                <li><mat-icon>check_circle</mat-icon> Seguimiento de progreso</li>
              </ul>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    mat-card-header {
      text-align: center;
      margin-bottom: 20px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 24px;
      margin-bottom: 8px;
    }

    .login-content {
      text-align: center;
    }

    .welcome-text {
      margin-bottom: 30px;
    }

    .welcome-text h2 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .welcome-text p {
      margin: 0;
      color: #666;
    }

    .auth-buttons {
      margin-bottom: 30px;
    }

    .auth-button {
      width: 100%;
      height: 48px;
      margin-bottom: 16px;
      font-size: 16px;
    }

    .auth-button mat-icon {
      margin-right: 8px;
    }

    .divider {
      margin: 20px 0;
      color: #666;
      position: relative;
    }

    .divider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: #ddd;
      z-index: 1;
    }

    .divider span {
      background: white;
      padding: 0 16px;
      position: relative;
      z-index: 2;
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .features {
      text-align: left;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }

    .features h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .features ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .features li {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      color: #666;
    }

    .features mat-icon {
      color: #4caf50;
      margin-right: 8px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class LoginComponent implements OnInit {
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is already authenticated
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  async signInWithHostedUI() {
    try {
      this.loading = true;
      await signInWithRedirect();
    } catch (error) {
      console.error('Error signing in:', error);
      this.loading = false;
    }
  }

  async signUpWithHostedUI() {
    try {
      this.loading = true;
      await signInWithRedirect();
    } catch (error) {
      console.error('Error signing up:', error);
      this.loading = false;
    }
  }
}