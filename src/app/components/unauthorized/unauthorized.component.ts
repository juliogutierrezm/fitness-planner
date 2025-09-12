import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="unauthorized-container">
      <mat-card class="unauthorized-card">
        <mat-card-content>
          <div class="unauthorized-content">
            <mat-icon class="warning-icon">warning</mat-icon>
            <h1>Acceso No Autorizado</h1>
            <p>No tienes permisos para acceder a esta página.</p>
            
            <div class="user-info" *ngIf="currentUser">
              <p><strong>Usuario:</strong> {{ currentUser.email }}</p>
              <p><strong>Rol:</strong> {{ getRoleDisplayName(currentUser.role) }}</p>
            </div>

            <div class="actions">
              <button 
                mat-raised-button 
                color="primary" 
                (click)="goToDashboard()">
                <mat-icon>dashboard</mat-icon>
                Ir al Dashboard
              </button>
              
              <button 
                mat-stroked-button 
                (click)="signOut()">
                <mat-icon>logout</mat-icon>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 20px;
    }

    .unauthorized-card {
      width: 100%;
      max-width: 500px;
      text-align: center;
    }

    .unauthorized-content {
      padding: 40px 20px;
    }

    .warning-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ff9800;
      margin-bottom: 20px;
    }

    h1 {
      color: #333;
      margin-bottom: 16px;
    }

    p {
      color: #666;
      margin-bottom: 20px;
    }

    .user-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
    }

    .user-info p {
      margin: 8px 0;
    }

    .actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 30px;
    }

    .actions button {
      min-width: 140px;
    }

    .actions button mat-icon {
      margin-right: 8px;
    }
  `]
})
export class UnauthorizedComponent {
  currentUser: any;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUser = this.authService.getCurrentUser();
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'admin': 'Administrador',
      'trainer': 'Entrenador',
      'client': 'Cliente'
    };
    return roleNames[role] || role;
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  async signOut() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}