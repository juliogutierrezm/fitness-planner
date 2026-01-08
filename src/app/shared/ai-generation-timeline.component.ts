import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AiStep } from './models';

interface AiTimelineStep {
  title: string;
  description: string;
}

@Component({
  selector: 'app-ai-generation-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './ai-generation-timeline.component.html',
  styleUrls: ['./ai-generation-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiGenerationTimelineComponent implements OnChanges {
  readonly steps: AiTimelineStep[] = [
    {
      title: 'Analizando el perfil del usuario',
      description: 'Edad, experiencia, objetivos y limitaciones se interpretan para crear un contexto realista.'
    },
    {
      title: 'Traduciendo el objetivo en estrategia',
      description: 'El objetivo se convierte en criterios de volumen, intensidad y selección de ejercicios.'
    },
    {
      title: 'Diseñando la estructura del plan',
      description: 'Se organiza la semana según sesiones, duración y grupos musculares.'
    },
    {
      title: 'Seleccionando ejercicios uno por uno',
      description: 'Cada ejercicio se elige según equipo, objetivo y equilibrio muscular.'
    },
    {
      title: 'Optimizando rendimiento y fatiga',
      description: 'Se ajustan superseries, descansos y orden para maximizar resultados.'
    },
    {
      title: 'Validación final del plan',
      description: 'El plan se revisa para asegurar progresión lógica y seguridad.'
    }
  ];

  @Input() currentAiStep?: AiStep;

  private readonly AI_TIMELINE_MAP: Record<AiStep, number> = {
    VALIDATING_INPUT: 0,
    FILTERING_EXERCISES: 1,
    STRUCTURING_PLAN: 2,
    MATCHING_EXERCISES: 3,
    OPTIMIZING_LOAD: 4,
    FINAL_VALIDATION: 5
  };

  currentStepIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentAiStep']) {
      this.updateCurrentStepIndex();
    }
  }

  private updateCurrentStepIndex(): void {
    if (this.currentAiStep) {
      this.currentStepIndex = this.AI_TIMELINE_MAP[this.currentAiStep];
    } else {
      this.currentStepIndex = 0;
    }
  }

  isCompleted(index: number): boolean {
    return index < this.currentStepIndex;
  }

  isActive(index: number): boolean {
    return index === this.currentStepIndex;
  }

  isUpcoming(index: number): boolean {
    return index > this.currentStepIndex;
  }
}
