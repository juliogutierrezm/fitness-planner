import { Component, inject } from '@angular/core';
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
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  /**
   * Gate rendering until auth is deterministically resolved.
   * In SSR, auth remains 'unknown' => we render splash (never login).
   */
  private readonly authService = inject(AuthService);
  readonly authStatus$ = this.authService.authStatus$;
}

