import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <mat-icon class="icon">{{ data.icon || 'help_outline' }}</mat-icon>
        <h2>{{ data.title || 'Confirmar acción' }}</h2>
      </div>
      <p class="message">{{ data.message || '¿Estás seguro de continuar?' }}</p>
      <div class="actions">
        <button mat-stroked-button (click)="close(false)">{{ data.cancelLabel || 'Cancelar' }}</button>
        <button mat-flat-button color="warn" (click)="close(true)">{{ data.confirmLabel || 'Eliminar' }}</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container { padding: 16px; max-width: 420px; }
    .dialog-header { display: flex; align-items: center; gap: 12px; }
    .dialog-header h2 { margin: 0; }
    .icon { color: #ef4444; }
    .message { margin: 12px 0 20px; }
    .actions { display: flex; gap: 12px; justify-content: flex-end; }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private ref: MatDialogRef<ConfirmDialogComponent>
  ) {}

  close(result: boolean) {
    this.ref.close(result);
  }
}

