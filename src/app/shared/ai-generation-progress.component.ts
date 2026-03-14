import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AI_PIPELINE_STEPS, AiPipelineStepConfig } from './ai-generation-progress.config';
import { AiGenerationStatus, AiStep } from './models';

@Component({
  selector: 'app-ai-generation-progress',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './ai-generation-progress.component.html',
  styleUrls: ['./ai-generation-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiGenerationProgressComponent implements OnChanges {
  @Input() currentStep: AiStep | null = null;
  @Input() status: AiGenerationStatus = 'PENDING';

  readonly pipelineSteps = AI_PIPELINE_STEPS;
  readonly pendingMessage = 'Preparando contexto del atleta';
  readonly completedMessage = 'Plan final validado';

  activeStepIndex = -1;
  progressPercentage = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentStep'] || changes['status']) {
      this.syncViewState();
    }
  }

  get totalSteps(): number {
    return this.pipelineSteps.length;
  }

  get headerTitle(): string {
    return 'Generando plan de entrenamiento con IA';
  }

  get statusLabel(): string {
    switch (this.status) {
      case 'IN_PROGRESS':
        return 'Pensando';
      case 'COMPLETED':
        return 'Listo';
      default:
        return 'En cola';
    }
  }

  get statusIcon(): string {
    switch (this.status) {
      case 'IN_PROGRESS':
        return 'autorenew';
      case 'COMPLETED':
        return 'check_circle';
      default:
        return 'hourglass_top';
    }
  }

  get currentMessage(): string {
    if (this.status === 'COMPLETED') {
      return this.completedMessage;
    }

    if (this.status !== 'IN_PROGRESS') {
      return this.pendingMessage;
    }

    return this.activeStep?.message ?? this.pendingMessage;
  }

  get activeStep(): AiPipelineStepConfig | null {
    if (this.activeStepIndex < 0 || this.activeStepIndex >= this.totalSteps) {
      return null;
    }

    return this.pipelineSteps[this.activeStepIndex];
  }

  get progressLabel(): string {
    return `${this.progressPercentage}%`;
  }

  get showAnimatedDots(): boolean {
    return this.status === 'IN_PROGRESS';
  }

  get loaderCoreLabel(): string {
    return this.status === 'COMPLETED' ? 'OK' : 'AI';
  }

  private syncViewState(): void {
    this.activeStepIndex = this.resolveActiveStepIndex();
    this.progressPercentage = this.resolveProgressPercentage();
  }

  private resolveActiveStepIndex(): number {
    if (this.status === 'COMPLETED') {
      return this.totalSteps - 1;
    }

    if (this.status !== 'IN_PROGRESS') {
      return -1;
    }

    if (!this.currentStep) {
      return 0;
    }

    const stepIndex = this.pipelineSteps.findIndex(step => step.id === this.currentStep);
    return stepIndex >= 0 ? stepIndex : 0;
  }

  private resolveProgressPercentage(): number {
    if (this.status === 'COMPLETED') {
      return 100;
    }

    if (this.status !== 'IN_PROGRESS' || this.activeStepIndex < 0) {
      return 0;
    }

    return Math.round(((this.activeStepIndex + 1) / this.totalSteps) * 100);
  }
}
