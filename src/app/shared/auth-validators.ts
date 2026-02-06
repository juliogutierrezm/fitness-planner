import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
}

export function matchFieldsValidator(field: string, confirmField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const first = control.get(field)?.value;
    const second = control.get(confirmField)?.value;

    if (!first || !second) {
      return null;
    }

    return first === second ? null : { mismatch: true };
  };
}

export function passwordPolicyValidator(
  config: PasswordPolicyConfig = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true
  }
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '');
    const errors: ValidationErrors = {};

    if (config.minLength && value.length < config.minLength) {
      errors['minlength'] = {
        requiredLength: config.minLength,
        actualLength: value.length
      };
    }

    if (config.requireUppercase && !/[A-Z]/.test(value)) {
      errors['uppercase'] = true;
    }

    if (config.requireLowercase && !/[a-z]/.test(value)) {
      errors['lowercase'] = true;
    }

    if (config.requireNumbers && !/[0-9]/.test(value)) {
      errors['number'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}
