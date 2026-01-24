import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { mapCognitoError } from '../../shared/auth-error-utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loading = false;
  error: string | null = null;
  showPassword = false;
  readonly form: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  async submit(): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'LoginComponent.submit.start' });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      console.debug('[AuthDebug]', { op: 'LoginComponent.submit.invalidForm' });
      return;
    }

    const email = this.form.value.email?.trim() || '';
    const password = this.form.value.password || '';

    this.loading = true;
    this.error = null;

    try {
      const result = await this.authService.signInUser(email, password);
      console.debug('[AuthDebug]', { op: 'LoginComponent.submit.result', result });
      if (result.nextStep) {
        this.showNextStepNotice(result.nextStep);
        const target = this.authService.getAuthFlowRoute(result.nextStep);
        console.debug('[AuthDebug]', { op: 'LoginComponent.submit.navigateNextStep', target });
        const navigated = await this.router.navigate([target]);
        console.debug('[AuthDebug]', { op: 'LoginComponent.submit.navigateNextStep.result', target, navigated });
        return;
      }

      console.debug('[AuthDebug]', { op: 'LoginComponent.submit.navigateDashboard' });
      const navigated = await this.router.navigate(['/dashboard']);
      console.debug('[AuthDebug]', { op: 'LoginComponent.submit.navigateDashboard.result', navigated });
    } catch (error) {
      console.error('[AuthDebug]', { op: 'LoginComponent.submit.error', error });
      this.error = mapCognitoError(error, 'No pudimos iniciar sesión. Intenta de nuevo.');
    } finally {
      this.loading = false;
      console.debug('[AuthDebug]', {
        op: 'LoginComponent.submit.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async goToSignup(): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'LoginComponent.goToSignup.start' });
    try {
      const navigated = await this.router.navigate(['/signup']);
      console.debug('[AuthDebug]', { op: 'LoginComponent.goToSignup.result', navigated });
    } catch (error) {
      console.error('[AuthDebug]', { op: 'LoginComponent.goToSignup.error', error });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'LoginComponent.goToSignup.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  async goToForgotPassword(): Promise<void> {
    const startedAt = Date.now();
    console.debug('[AuthDebug]', { op: 'LoginComponent.goToForgotPassword.start' });
    try {
      const navigated = await this.router.navigate(['/forgot-password']);
      console.debug('[AuthDebug]', { op: 'LoginComponent.goToForgotPassword.result', navigated });
    } catch (error) {
      console.error('[AuthDebug]', { op: 'LoginComponent.goToForgotPassword.error', error });
      throw error;
    } finally {
      console.debug('[AuthDebug]', {
        op: 'LoginComponent.goToForgotPassword.end',
        elapsedMs: Date.now() - startedAt
      });
    }
  }

  private showNextStepNotice(step: string): void {
    const messages: Record<string, string> = {
      confirmSignUp: 'Tu cuenta necesita confirmación. Revisa tu correo.',
      resetPassword: 'Debes restablecer tu contraseña. Enviamos un código.',
      newPasswordRequired: 'Debes cambiar tu contraseña para continuar.'
    };
    const message = messages[step];
    if (message) {
      this.snackBar.open(message, 'Cerrar', { duration: 4000 });
    }
  }
}
