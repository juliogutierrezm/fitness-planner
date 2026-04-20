import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AiGenerationProgressComponent } from '../../../shared/ai-generation-progress.component';
import { AiGenerationStatus, AiStep } from '../../../shared/models';

export interface AiGenerationDialogData {
  currentStep: AiStep | null;
  status: AiGenerationStatus;
}

@Component({
  selector: 'app-ai-generation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, AiGenerationProgressComponent],
  template: `
    <app-ai-generation-progress
      [currentStep]="currentStep"
      [status]="status">
    </app-ai-generation-progress>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiGenerationDialogComponent {
  currentStep: AiStep | null;
  status: AiGenerationStatus;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: AiGenerationDialogData,
    private cdr: ChangeDetectorRef
  ) {
    this.currentStep = data.currentStep;
    this.status = data.status;
  }

  updateProgress(data: AiGenerationDialogData): void {
    this.currentStep = data.currentStep;
    this.status = data.status;
    this.cdr.markForCheck();
  }
}
