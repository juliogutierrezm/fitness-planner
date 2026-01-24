import { Component, OnInit } from '@angular/core';
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
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  email = '';
  readonly form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.formBuilder.group(
      {
        email: ['', [Validators.required, Validators.email]],
        code: ['', [Validators.required]],
        password: ['', [Validators.required, passwordPolicyValidator()]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: matchFieldsValidator('password', 'confirmPassword') }
    );
  }

  ngOnInit(): void {
    const flowState = this.authService.getAuthFlowSnapshot();
    this.email = flowState?.username || '';
    if (this.email) {
      this.form.patchValue({ email: this.email });
      this.form.get('email')?.disable();
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.email) {
      this.error = 'No encontramos el correo para restablecer la contraseña.';
      return;
    }

    const code = this.form.value.code?.trim() || '';
    const password = this.form.value.password || '';

    this.loading = true;
    this.error = null;

    try {
      await this.authService.confirmResetPassword(this.email, code, password);
      this.snackBar.open('Contraseña restablecida. Inicia sesión.', 'Cerrar', { duration: 4000 });
      await this.router.navigate(['/login']);
    } catch (error) {
      this.error = mapCognitoError(error, 'No pudimos restablecer la contraseña. Intenta de nuevo.');
    } finally {
      this.loading = false;
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
