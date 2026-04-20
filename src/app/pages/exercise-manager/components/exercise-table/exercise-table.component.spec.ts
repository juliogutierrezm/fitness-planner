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

  it('allows actions for owned exercises without source field', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      trainerId: 'trainer-1'
    }))).toBeTrue();
  });

  it('hides actions for exercises owned by another user', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-2'
    }))).toBeFalse();
  });

  it('hides actions for exercises without trainerId', () => {
    const component = createComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'LIBRARY',
      trainerId: null
    }))).toBeFalse();

    expect(component.canEdit(createExercise({
      source: 'LIBRARY'
    }))).toBeFalse();
  });

  it('treats missing current user as not editable', () => {
    const component = createComponent();

    component.currentUserId = null;
    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    }))).toBeFalse();
  });

  it('admin can edit exercises from the same company', () => {
    const component = createComponent();
    component.isAdmin = true;
    component.currentUserId = 'admin-1';
    component.currentCompanyId = 'company-A';

    expect(component.canEdit(createExercise({
      trainerId: 'trainer-2',
      companyId: 'company-A'
    }))).toBeTrue();
  });

  it('admin cannot edit exercises from a different company', () => {
    const component = createComponent();
    component.isAdmin = true;
    component.currentUserId = 'admin-1';
    component.currentCompanyId = 'company-A';

    expect(component.canEdit(createExercise({
      trainerId: 'trainer-2',
      companyId: 'company-B'
    }))).toBeFalse();
  });
});
