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
import { matchFieldsValidator, passwordPolicyValidator } from '../../shared/auth-validators';

@Component({
  selector: 'app-signup',
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
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  readonly form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.formBuilder.group(
      {
        givenName: ['', [Validators.required]],
        familyName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, passwordPolicyValidator()]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: matchFieldsValidator('password', 'confirmPassword') }
    );
  }

  async submit(): Promise<void> {
    const startedAt = Date.now();
    void 0;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      void 0;
      return;
    }

    const givenName = this.form.value.givenName?.trim() || '';
    const familyName = this.form.value.familyName?.trim() || '';
    const email = this.form.value.email?.trim() || '';
    const password = this.form.value.password || '';

    this.loading = true;
    this.error = null;

    try {
      const result = await this.authService.signUpUser(email, password, givenName, familyName);
      void 0;

      if (result.nextStep) {
        this.snackBar.open('Te enviamos un código de confirmación.', 'Cerrar', { duration: 4000 });
        const target = this.authService.getAuthFlowRoute(result.nextStep);
        void 0;
        const navigated = await this.router.navigate([target]);
        void 0;
        return;
      }

      this.snackBar.open('Cuenta creada. Inicia sesión para continuar.', 'Cerrar', { duration: 4000 });
      void 0;
      const navigated = await this.router.navigate(['/login']);
      void 0;
    } catch (error) {
      console.error('[AuthDebug]', { op: 'SignupComponent.submit.error', error });
      this.error = mapCognitoError(error, 'No pudimos crear la cuenta. Intenta de nuevo.');
    } finally {
      this.loading = false;
      void 0;
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async goToLogin(): Promise<void> {
    const startedAt = Date.now();
    void 0;
    try {
      const navigated = await this.router.navigate(['/login']);
      void 0;
    } catch (error) {
      console.error('[AuthDebug]', { op: 'SignupComponent.goToLogin.error', error });
      throw error;
    } finally {
      void 0;
    }
  }
}

