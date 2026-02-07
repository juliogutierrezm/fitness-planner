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

@Component({
  selector: 'app-confirm-code',
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
  templateUrl: './confirm-code.component.html',
  styleUrls: ['./confirm-code.component.scss']
})
export class ConfirmCodeComponent implements OnInit {
  loading = false;
  resending = false;
  error: string | null = null;
  notice: string | null = null;
  email = '';
  readonly form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.formBuilder.group({
      code: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    const flowState = this.authService.getAuthFlowSnapshot();
    this.email = flowState?.username || '';
  }

  async submit(): Promise<void> {
    const startedAt = Date.now();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const code = this.form.value.code?.trim() || '';

    if (!this.email) {
      this.error = 'No encontramos el correo para confirmar.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await this.authService.confirmSignUpUser(this.email, code);
      this.snackBar.open('Cuenta confirmada. Ya puedes iniciar sesión.', 'Cerrar', { duration: 4000 });
      const navigated = await this.router.navigate(['/login']);

    } catch (error) {
      this.error = mapCognitoError(error, 'No pudimos confirmar tu cuenta. Intenta de nuevo.');
    } finally {
      this.loading = false;
    }
  }

  async resendCode(): Promise<void> {
    const startedAt = Date.now();
    if (!this.email) {
      this.error = 'No encontramos el correo para reenviar el código.';
      return;
    }

    this.resending = true;
    this.error = null;
    try {
      await this.authService.resendSignUpCode(this.email);
      this.notice = 'Código reenviado. Revisa tu bandeja de entrada.';
    } catch (error) {
      this.error = mapCognitoError(error, 'No pudimos reenviar el código. Intenta de nuevo.');
    } finally {
      this.resending = false;
    }
  }

}
