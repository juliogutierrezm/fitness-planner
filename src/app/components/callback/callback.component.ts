import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, UserRole } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    try {
      // Avoid accessing window during SSR render
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      // If Hosted UI returned an error, show it immediately
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorDesc = params.get('error_description');
      if (error) {
        this.error = decodeURIComponent(errorDesc || 'No se pudo completar la autenticación.');
        return;
      }

      // Finalize redirect and refresh auth state
      await this.authService.checkAuthState();

      // Evaluate synchronously after state refresh to avoid initial false emission
      if (this.authService.isAuthenticatedSync()) {
        this.router.navigate([this.resolvePostLoginRoute()]);
      } else {
        this.error = 'No se pudo completar la autenticación.';
      }
    } catch (error) {
      console.error('Callback error:', error);
      this.error = 'Error procesando la autenticación. Por favor intenta de nuevo.';
    }
  }

  retryLogin() {
    this.authService.signInWithRedirect();
  }

  /**
   * Purpose: select a post-login route based on the current user role.
   * Input: none. Output: route path string.
   * Error handling: defaults to admin/trainer dashboard when role is unknown.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private resolvePostLoginRoute(): string {
    const role = this.authService.getCurrentUserRole();
    if (role === UserRole.CLIENT) {
      return '/unauthorized';
    }
    return '/dashboard';
  }
}
