import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
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
        <mat-card-content>
          <div class="brand">
            <mat-icon>fitness_center</mat-icon>
            <h1>Fitness Planner</h1>
            <p>Planifica y gestiona tus entrenamientos</p>
          </div>

          <div class="actions" *ngIf="!loading">
            <button mat-flat-button class="login-primary" (click)="signInWithHostedUI()">
              <mat-icon>login</mat-icon>
              Iniciar sesión
            </button>
            <button mat-stroked-button class="login-secondary" (click)="signUpWithHostedUI()">
              <mat-icon>person_add</mat-icon>
              Crear cuenta
            </button>
          </div>

          <div class="loading" *ngIf="loading">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Redirigiendo al proveedor…</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b1220; padding: 24px; }
    .login-card { width: 100%; max-width: 420px; background: #111827; color: #e5e7eb; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
    .brand { text-align: center; padding: 28px 20px 8px; }
    .brand mat-icon { color: #60a5fa; font-size: 40px; width: 40px; height: 40px; }
    .brand h1 { margin: 8px 0 4px; font-size: 22px; color: #fff; }
    .brand p { margin: 0; color: #9ca3af; }
    .actions { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
    .login-primary { background: #2563eb; color: #fff; height: 44px; }
    .login-secondary { border-color: #9ca3af; color: #e5e7eb; height: 44px; }
    .actions button mat-icon { margin-right: 8px; }
    .loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; }
    .loading p { color: #9ca3af; margin: 0; }
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
    this.loading = true;
    await this.authService.signInWithRedirect();
  }

  async signUpWithHostedUI() {
    this.loading = true;
    // For now, sign up also redirects to the hosted UI where users can choose to sign up.
    await this.authService.signInWithRedirect();
  }
}
