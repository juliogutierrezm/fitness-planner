import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, UserProfile } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
  sidebarOpen = true;
  user: UserProfile | null = null;
  private authenticated = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.authService.isAuthenticated$.subscribe(isAuth => {
      this.authenticated = isAuth;
    });
  }

  get isLoggedIn(): boolean {
    return this.authenticated;
  }

  get displayName(): string {
    if (!this.user) return '';
    const first = this.user.givenName?.trim();
    const last = this.user.familyName?.trim();
    if (first || last) {
      return [first, last].filter(Boolean).join(' ');
    }
    return this.user.email?.split('@')[0] || 'Usuario';
  }

  login() {
    this.authService.signInWithRedirect();
  }

  logout() {
    this.authService.signOut();
  }
}
