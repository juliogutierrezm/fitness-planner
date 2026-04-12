import { ChangeDetectorRef } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { Exercise } from '../../shared/models';
import { InlineEditOptionsService } from './components/exercise-table/inline-edit-options.service';
import { ExerciseManagerComponent } from './exercise-manager.component';

describe('ExerciseManagerComponent', () => {
  function createExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
    return {
      id,
      name: `Exercise ${id}`,
      equipment: 'Bodyweight',
      muscle: 'Chest',
      ...overrides
    } as Exercise;
  }

  function createComponent() {
    const api = jasmine.createSpyObj<ExerciseApiService>('ExerciseApiService', [
      'getAllExercises',
      'deleteExercise'
    ]);
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['isGymAdmin', 'isSystem']);
    authService.isGymAdmin.and.returnValue(false);
    authService.isSystem.and.returnValue(true);
    const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    const snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    const inlineOptionsService = jasmine.createSpyObj<InlineEditOptionsService>('InlineEditOptionsService', ['buildCatalogs']);
    inlineOptionsService.buildCatalogs.and.returnValue({
      categoryOptions: [],
      muscleGroupOptions: [],
      equipmentTypeOptions: [],
      exerciseTypeOptions: [],
      difficultyOptions: []
    });

    const component = new ExerciseManagerComponent(
      api,
      authService,
      dialog,
      snackBar,
      cdr,
      inlineOptionsService
    );

    return { component, api };
  }

  it('uses polling with getAllExercises and updates only the refreshed exercise in memory', fakeAsync(() => {
    const { component, api } = createComponent();
    const initialExercises = [
      createExercise('ex-1', { video: { type: 'S3', previewUrl: 'https://cdn.example.com/video.mp4' } }),
      createExercise('ex-2', { thumbnail: 'https://cdn.example.com/keep.jpg' })
    ];
    const refreshedExercises = [
      createExercise('ex-1', {
        video: {
          type: 'S3',
          previewUrl: 'https://cdn.example.com/video.mp4',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg'
        }
      }),
      createExercise('ex-2', { thumbnail: 'https://cdn.example.com/changed-on-server.jpg' })
    ];

    (component as any).exercisesSnapshot = initialExercises;
    component.exercises$ = of(initialExercises);
    (component as any).rebuildFilteredExercises();

    api.getAllExercises.and.returnValue(of(refreshedExercises));
    const loadExercisesSpy = spyOn(component, 'loadExercises');

    (component as any).startMediaRefreshPolling('ex-1');
    tick(2000);

    let currentExercises: Exercise[] = [];
    component.exercises$.subscribe(exercises => currentExercises = exercises);

    expect(loadExercisesSpy).not.toHaveBeenCalled();
    expect(api.getAllExercises).toHaveBeenCalledTimes(1);
    expect(currentExercises[0].id).toBe('ex-1');
    expect(currentExercises[0].video?.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
    expect(currentExercises[1]).toEqual(initialExercises[1]);

    tick(4000);
    expect(api.getAllExercises).toHaveBeenCalledTimes(1);
  }));

  it('stops polling after the configured max attempts when no thumbnail is found', fakeAsync(() => {
    const { component, api } = createComponent();
    const exercisesWithoutThumbnail = [
      createExercise('ex-1', { video: { type: 'S3', previewUrl: 'https://cdn.example.com/video.mp4' } })
    ];

    (component as any).exercisesSnapshot = exercisesWithoutThumbnail;
    component.exercises$ = of(exercisesWithoutThumbnail);
    (component as any).rebuildFilteredExercises();

    api.getAllExercises.and.returnValue(of(exercisesWithoutThumbnail));

    (component as any).startMediaRefreshPolling('ex-1');
    tick(2000 * 15);
    tick(4000);

    expect(api.getAllExercises).toHaveBeenCalledTimes(15);
  }));
});
