import { Exercise } from '../../../../shared/models';
import { ExerciseTableComponent } from './exercise-table.component';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { ChangeDetectorRef } from '@angular/core';

describe('ExerciseTableComponent', () => {
  function createComponent(): ExerciseTableComponent {
    const mockApi = {} as ExerciseApiService;
    const mockCdr = { markForCheck: () => {} } as unknown as ChangeDetectorRef;
    return new ExerciseTableComponent(mockApi, mockCdr);
  }

  function createExercise(overrides: Partial<Exercise> = {}): Exercise {
    return {
      id: 'ex-1',
      name: 'Exercise',
      equipment: 'Bodyweight',
      muscle: 'Chest',
      ...overrides
    };
  }

  it('allows actions for owned custom exercises', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    }))).toBeTrue();
  });

  it('hides actions for custom exercises owned by another user', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-2'
    }))).toBeFalse();
  });

  it('hides actions for library exercises even when trainerId matches', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'LIBRARY',
      trainerId: 'trainer-1'
    }))).toBeFalse();
  });

  it('treats missing current user or trainerId as not editable', () => {
    const component = createComponent();

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: null
    }))).toBeFalse();

    component.currentUserId = null;
    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    }))).toBeFalse();
  });
});
