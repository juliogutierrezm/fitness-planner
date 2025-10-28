// src/app/shared/feedback-utils.ts
// Centralized feedback utilities following DEVELOPER.md Section L (Layering)

import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBarConfig } from '@angular/material/snack-bar';

/**
 * Semantic feedback themes for consistent user experience
 * Aligns with Material Design theme system
 */
export enum FeedbackTheme {
  SUCCESS = 'primary',  // Green/primary for positive actions
  ERROR = 'warn',       // Red/warn for errors and dangerous states
  INFO = 'accent'       // Blue/accent for neutral information
}

/**
 * Operation types for distinguishing create vs update scenarios
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update'
}

/**
 * Centralized feedback configuration matching Material Design standards
 * Duration: 3-4s as specified, with semantic theming
 */
export class FeedbackConfig {
  static readonly SUCCESS_DURATION = 3000;
  static readonly ERROR_DURATION = 4000;

  /**
   * Success configuration with green theming
   */
  static successConfig(): MatSnackBarConfig {
    return {
      duration: this.SUCCESS_DURATION,
      panelClass: ['snackbar-success'],
      verticalPosition: 'bottom',
      horizontalPosition: 'center'
    };
  }

  /**
   * Error configuration with red theming
   */
  static errorConfig(): MatSnackBarConfig {
    return {
      duration: this.ERROR_DURATION,
      panelClass: ['snackbar-error'],
      verticalPosition: 'bottom',
      horizontalPosition: 'center'
    };
  }

  /**
   * Info configuration with neutral theming
   */
  static infoConfig(): MatSnackBarConfig {
    return {
      duration: this.SUCCESS_DURATION,
      panelClass: ['snackbar-info'],
      verticalPosition: 'bottom',
      horizontalPosition: 'center'
    };
  }
}

/**
 * Exercise-specific feedback messages following DEVELOPER.md Section O (Observability)
 * Distinguishes between create and update operations for clarity
 */
export class ExerciseMessages {
  static readonly CREATED_SUCCESS = '✅ Ejercicio creado correctamente';
  static readonly UPDATED_SUCCESS = '✅ Ejercicio guardado correctamente';
  static readonly LOADING_ERROR = '❌ Error al cargar los ejercicios. Intente nuevamente.';
  static readonly SAVE_ERROR = '❌ Error al guardar el ejercicio. Intente nuevamente.';
}

/**
 * Maps HTTP error status codes to user-friendly messages
 * Follows DEVELOPER.md Section O error handling patterns
 */
export class ErrorMapper {
  /**
   * Maps HTTP error responses to friendly user messages
   * Includes structured context for logging in dev mode
   */
  static mapHttpError(error: HttpErrorResponse | Error): string {
    // Log structured context in development per DEVELOPER.md Section O
    if (process.env['NODE_ENV'] === 'development' && error instanceof HttpErrorResponse) {
      console.error('[ErrorMapper]', {
        status: error.status,
        url: error.url,
        message: error.message,
        timestamp: Date.now()
      });
    }

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return '❌ Datos inválidos. Verifique la información e intente nuevamente.';
        case 401:
          return '❌ Sesión expirada. Inicie sesión nuevamente.';
        case 403:
          return '❌ No tiene permisos para realizar esta acción.';
        case 413:
          return '❌ Archivo demasiado grande. Reduzca el tamaño e intente nuevamente.';
        case 422:
          return '❌ Validación fallida. Complete todos los campos requeridos.';
        case 429:
          return '❌ Demasiadas solicitudes. Espere un momento e intente nuevamente.';
        case 500:
        case 502:
        case 503:
        case 504:
          return '❌ Error del servidor. Intente nuevamente en unos momentos.';
        default:
          return `❌ Error (${error.status}). Intente nuevamente.`;
      }
    }

    // Network or other errors
    return '❌ Error de conexión. Verifique su internet e intente nuevamente.';
  }

  /**
   * Generic error fallback when no specific error is available
   */
  static mapGenericError(message?: string): string {
    if (message) {
      console.warn('[ErrorMapper] Generic error mapped:', message);
      return `❌ ${message}`;
    }
    return '❌ Ha ocurrido un error inesperado. Intente nuevamente.';
  }
}

/**
 * Centralized logging utilities for development debugging
 * Follows DEVELOPER.md Section O observability requirements
 */
export class DevLogger {
  static logOperation(operation: string, context: any, ok: boolean): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`[ExerciseOp:${operation}]`, {
        operation,
        ok,
        context,
        elapsedMs: context.elapsedMs || 0,
        timestamp: Date.now()
      });
    }
  }

  static logError(operation: string, error: any): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.error(`[ExerciseError:${operation}]`, error);
    }
  }
}

// Spreadsheet purpose: Centralized feedback handling CRP: OK. No side effects. Pure utility exports. Standards: SRP/DRY OK.
