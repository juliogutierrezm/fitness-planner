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
import { AuthService } from '../../services/auth.service';
import { mapCognitoError } from '../../shared/auth-error-utils';
import { matchFieldsValidator, passwordPolicyValidator } from '../../shared/auth-validators';

@Component({
  selector: 'app-force-new-password',
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
    MatInputModule
  ],
  templateUrl: './force-new-password.component.html',
  styleUrls: ['./force-new-password.component.scss']
})
export class ForceNewPasswordComponent implements OnInit {
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  email: string | null = null;
  requiresGivenName = false;
  requiresFamilyName = false;
  readonly form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    this.form = this.formBuilder.group(
      {
        givenName: [''],
        familyName: [''],
        password: ['', [Validators.required, passwordPolicyValidator()]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: matchFieldsValidator('password', 'confirmPassword') }
    );
  }

  ngOnInit(): void {
    const flowState = this.authService.getAuthFlowSnapshot();
    this.email = flowState?.username || null;
    const missingAttributes = (flowState?.nextStep?.missingAttributes as string[]) || [];
    this.requiresGivenName = missingAttributes.includes('given_name');
    this.requiresFamilyName = missingAttributes.includes('family_name');

    if (this.requiresGivenName) {
      this.form.get('givenName')?.setValidators([Validators.required]);
    }
    if (this.requiresFamilyName) {
      this.form.get('familyName')?.setValidators([Validators.required]);
    }
    this.form.updateValueAndValidity();
  }

  async submit(): Promise<void> {
    const startedAt = Date.now();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = this.form.value.password || '';
    const givenName = this.form.value.givenName?.trim() || '';
    const familyName = this.form.value.familyName?.trim() || '';

    this.loading = true;
    this.error = null;

    try {
      const userAttributes: Record<string, string> = {};
      if (this.requiresGivenName) {
        userAttributes['given_name'] = givenName;
      }
      if (this.requiresFamilyName) {
        userAttributes['family_name'] = familyName;
      }

      const result = await this.authService.confirmNewPassword(password, userAttributes);
      if (result.nextStep) {
        this.error = 'No pudimos completar la autenticación. Intenta de nuevo.';
        return;
      }

      const navigated = await this.router.navigate(['/dashboard']);
      void 0;
    } catch (error) {
      this.error = mapCognitoError(error, 'No pudimos actualizar la contraseña. Intenta de nuevo.');
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

