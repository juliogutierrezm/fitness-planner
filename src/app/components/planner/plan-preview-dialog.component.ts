import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutPlanViewComponent } from '../workout-plan-view/workout-plan-view.component';

@Component({
  selector: 'app-plan-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, WorkoutPlanViewComponent],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>Previsualización del plan</h2>
        <button mat-icon-button (click)="close()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="dialog-content">
        <app-workout-plan-view [plan]="data.plan"></app-workout-plan-view>
      </div>
      <div class="dialog-actions">
        <button mat-stroked-button color="primary" (click)="close()">
          Cerrar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 24px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .dialog-content {
      flex: 1;
      overflow: auto;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
    }
  `]
})
export class PlanPreviewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PlanPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plan: any }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
