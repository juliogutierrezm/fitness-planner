import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit {
  constructor(private authService: AuthService) {}

  async ngOnInit() {
    // Ensure current auth state is synced on app load
    await this.authService.checkAuthState();
  }
}
