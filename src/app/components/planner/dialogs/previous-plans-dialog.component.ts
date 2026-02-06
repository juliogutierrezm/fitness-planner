import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-previous-plans-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './previous-plans-dialog.component.html',
  styleUrls: ['./previous-plans-dialog.component.scss']
})
export class PreviousPlansDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<PreviousPlansDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plans: any[] }
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  selectPlan(plan: any): void {
    // For now, just close the dialog. Could be extended to navigate or perform actions
    this.dialogRef.close(plan);
  }

  trackByPlan = (_: number, plan: any) => plan.id || plan.name;
}
