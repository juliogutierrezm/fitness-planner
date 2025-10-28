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
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss']
})
export class UnauthorizedComponent {
  currentUser: any;
  get displayName(): string {
    const u = this.currentUser;
    if (!u) return '';
    const first = u?.givenName?.trim();
    const last = u?.familyName?.trim();
    if (first || last) return [first, last].filter(Boolean).join(' ');
    return u?.email?.split('@')[0] || 'Usuario';
  }

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
