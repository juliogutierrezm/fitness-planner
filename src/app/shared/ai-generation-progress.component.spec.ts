import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AI_PIPELINE_STEPS } from './ai-generation-progress.config';
import { AiGenerationProgressComponent } from './ai-generation-progress.component';
import { AiGenerationStatus, AiStep } from './models';

describe('AiGenerationProgressComponent', () => {
  let component: AiGenerationProgressComponent;
  let fixture: ComponentFixture<AiGenerationProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiGenerationProgressComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AiGenerationProgressComponent);
    component = fixture.componentInstance;
  });

  function setProgressState(status: AiGenerationStatus, currentStep: AiStep | null = null): void {
    fixture.componentRef.setInput('currentStep', currentStep);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
  }

  it('renders pending state with zero progress and the compact header', () => {
    setProgressState('PENDING');

    const element = fixture.nativeElement as HTMLElement;

    expect(component.progressPercentage).toBe(0);
    expect(component.activeStepIndex).toBe(-1);
    expect(element.querySelector('.ai-loader')).not.toBeNull();
    expect(element.querySelector('.timeline')).toBeNull();
    expect(element.querySelector('.progress-card')).toBeNull();
    expect(element.textContent).toContain('Generando plan de entrenamiento con IA');
    expect(element.textContent).toContain('0%');
    expect(element.textContent).toContain('Preparando contexto del atleta');
  });

  it('maps every AI step to the correct message and progress percentage', () => {
    AI_PIPELINE_STEPS.forEach((step, index) => {
      setProgressState('IN_PROGRESS', step.id);

      const message = fixture.nativeElement.querySelector('.ai-progress-message__text') as HTMLElement;

      expect(component.activeStepIndex).toBe(index);
      expect(component.progressPercentage).toBe(Math.round(((index + 1) / AI_PIPELINE_STEPS.length) * 100));
      expect(message.textContent?.trim()).toBe(step.message);
    });
  });

  it('places BUILDING_SESSION_STRUCTURE as step 4 of 7', () => {
    setProgressState('IN_PROGRESS', 'BUILDING_SESSION_STRUCTURE');

    expect(component.activeStepIndex).toBe(3);
    expect(component.progressPercentage).toBe(57);
    expect(component.currentMessage).toBe('Configurando sesiones');
  });

  it('renders completed state with full progress and final validation message', () => {
    setProgressState('COMPLETED', 'FINAL_VALIDATION');

    const element = fixture.nativeElement as HTMLElement;

    expect(component.progressPercentage).toBe(100);
    expect(element.querySelector('.ai-loader--completed')).not.toBeNull();
    expect(element.querySelector('.ai-progress-message__dots')).toBeNull();
    expect(element.textContent).toContain('Plan final validado');
    expect(element.textContent).toContain('Listo');
  });

  it('shows animated dots only while generation is in progress', () => {
    setProgressState('IN_PROGRESS', 'MATCHING_EXERCISES');

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.ai-progress-message__dots')).not.toBeNull();

    setProgressState('COMPLETED', 'FINAL_VALIDATION');

    expect(element.querySelector('.ai-progress-message__dots')).toBeNull();
  });

  it('uses the first step when status is in progress without a backend step yet', () => {
    setProgressState('IN_PROGRESS', null);

    expect(component.activeStepIndex).toBe(0);
    expect(component.progressPercentage).toBe(14);
    expect(component.currentMessage).toBe(AI_PIPELINE_STEPS[0].message);
  });

  it('renders loader core labels for active and completed states', () => {
    setProgressState('IN_PROGRESS', 'MATCHING_EXERCISES');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.ai-loader__core-label')?.textContent?.trim()).toBe('AI');

    setProgressState('COMPLETED', 'FINAL_VALIDATION');
    expect(element.querySelector('.ai-loader__core-label')?.textContent?.trim()).toBe('OK');
  });
});
