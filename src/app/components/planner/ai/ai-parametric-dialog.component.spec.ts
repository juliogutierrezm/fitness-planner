import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { AiParametricDialogComponent } from './ai-parametric-dialog.component';
import { ExerciseApiService } from '../../../exercise-api.service';
import { AuthService } from '../../../services/auth.service';
import { AiPlansService } from '../../../services/ai-plans.service';

describe('AiParametricDialogComponent', () => {
  let component: AiParametricDialogComponent;
  let fixture: ComponentFixture<AiParametricDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiParametricDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: ExerciseApiService, useValue: { generatePlanFromAI: () => of({ executionId: 'test-execution-id' }) } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
        {
          provide: AuthService,
          useValue: {
            isTrainer: () => false,
            getCurrentUserId: () => 'trainer-1',
            getCurrentCompanyId: () => 'company-1'
          }
        },
        { provide: AiPlansService, useValue: { getTrainerQuota: () => of({ limitReached: false, limit: 10 }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AiParametricDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function getSessionBlueprintArray(): FormArray {
    return component.form.get('sessionBlueprint') as FormArray;
  }

  function getSessionGroup(index: number): FormGroup {
    return getSessionBlueprintArray().at(index) as FormGroup;
  }

  it('should create a session blueprint with empty muscle groups and movement patterns', () => {
    const sessionGroup = getSessionGroup(0);

    expect(component).toBeTruthy();
    expect(sessionGroup.get('selectedMuscleGroups')?.value).toEqual([]);
    expect(sessionGroup.get('selectedMovementPatterns')?.value).toEqual([]);
    expect(sessionGroup.hasError('targetsRequired')).toBeTrue();
  });

  it('should preserve muscle groups and movement patterns when total sessions changes', () => {
    const firstSession = getSessionGroup(0);
    firstSession.get('selectedMuscleGroups')?.setValue(['Bíceps']);
    firstSession.get('selectedMovementPatterns')?.setValue(['Push']);
    firstSession.get('includeSupersets')?.setValue(false);

    component.form.get('totalSessions')?.setValue(2);

    const expandedFirstSession = getSessionGroup(0);
    const secondSession = getSessionGroup(1);
    expect(expandedFirstSession.get('selectedMuscleGroups')?.value).toEqual(['Bíceps']);
    expect(expandedFirstSession.get('selectedMovementPatterns')?.value).toEqual(['Push']);
    expect(expandedFirstSession.get('includeSupersets')?.value).toBeFalse();
    expect(secondSession.get('selectedMuscleGroups')?.value).toEqual([]);
    expect(secondSession.get('selectedMovementPatterns')?.value).toEqual([]);

    secondSession.get('selectedMovementPatterns')?.setValue(['Mobility']);
    component.form.get('totalSessions')?.setValue(1);

    const reducedFirstSession = getSessionGroup(0);
    expect(reducedFirstSession.get('selectedMuscleGroups')?.value).toEqual(['Bíceps']);
    expect(reducedFirstSession.get('selectedMovementPatterns')?.value).toEqual(['Push']);
  });

  it('should flatten both selector arrays into targets in order', () => {
    const blueprint = (component as any).buildSessionBlueprint({
      sessionBlueprint: [
        {
          name: 'Sesion 1',
          selectedMuscleGroups: ['Bíceps', 'Pectorales'],
          selectedMovementPatterns: ['Push', 'Carry'],
          includeSupersets: true
        }
      ]
    });

    expect(blueprint).toEqual([
      {
        name: 'Sesion 1',
        targets: ['Bíceps', 'Pectorales', 'Push', 'Carry'],
        includeSupersets: true
      }
    ]);
  });

  it('should validate a session when either selector has values', () => {
    component.form.get('availableEquipment')?.setValue(['Barra']);

    const sessionGroup = getSessionGroup(0);
    expect(component.form.valid).toBeFalse();

    sessionGroup.get('selectedMuscleGroups')?.setValue(['Core']);
    expect(sessionGroup.valid).toBeTrue();
    expect(component.form.valid).toBeTrue();

    sessionGroup.get('selectedMuscleGroups')?.setValue([]);
    sessionGroup.get('selectedMovementPatterns')?.setValue(['Cardio']);
    expect(sessionGroup.valid).toBeTrue();
    expect(component.form.valid).toBeTrue();

    sessionGroup.get('selectedMovementPatterns')?.setValue([]);
    expect(sessionGroup.hasError('targetsRequired')).toBeTrue();
    expect(component.form.valid).toBeFalse();
  });
});
