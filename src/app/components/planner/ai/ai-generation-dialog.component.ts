import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AiGenerationTimelineComponent } from '../../../shared/ai-generation-timeline.component';
import { AiStep } from '../../../shared/models';

@Component({
  selector: 'app-ai-generation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, AiGenerationTimelineComponent],
  template: `
    <app-ai-generation-timeline [currentAiStep]="data.currentAiStep"></app-ai-generation-timeline>
  `,
  styles: []
})
export class AiGenerationDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { currentAiStep?: AiStep }) {}
}
