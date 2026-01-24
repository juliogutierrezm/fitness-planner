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
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  loading = false;
  error: string | null = null;
  readonly form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.value.email?.trim() || '';
    this.loading = true;
    this.error = null;

    try {
      const result = await this.authService.startResetPassword(email);
      if (result.nextStep) {
        this.snackBar.open('Te enviamos un código para restablecer la contraseña.', 'Cerrar', { duration: 4000 });
        await this.router.navigate([this.authService.getAuthFlowRoute(result.nextStep)]);
        return;
      }

      await this.router.navigate(['/login']);
    } catch (error) {
      this.error = mapCognitoError(error, 'No pudimos enviar el código. Intenta de nuevo.');
    } finally {
      this.loading = false;
    }
  }

  async goToLogin(): Promise<void> {
    await this.router.navigate(['/login']);
  }
}
