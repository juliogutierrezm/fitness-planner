import { Exercise } from '../../../../shared/models';
import { ExerciseTableComponent } from './exercise-table.component';

describe('ExerciseTableComponent', () => {
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
    const component = new ExerciseTableComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    }))).toBeTrue();
  });

  it('hides actions for custom exercises owned by another user', () => {
    const component = new ExerciseTableComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'CUSTOM',
      trainerId: 'trainer-2'
    }))).toBeFalse();
  });

  it('hides actions for library exercises even when trainerId matches', () => {
    const component = new ExerciseTableComponent();
    component.currentUserId = 'trainer-1';

    expect(component.canEdit(createExercise({
      source: 'LIBRARY',
      trainerId: 'trainer-1'
    }))).toBeFalse();
  });

  it('treats missing current user or trainerId as not editable', () => {
    const component = new ExerciseTableComponent();

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
