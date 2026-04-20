import { ChangeDetectorRef } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { Exercise } from '../../shared/models';
import { InlineEditOptionsService } from './components/exercise-table/inline-edit-options.service';
import { ExerciseEditDialogComponent } from './components/exercise-edit-dialog/exercise-edit-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
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
      'deleteExercise',
      'getExerciseById'
    ]);
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['isGymAdmin', 'getCurrentUserId', 'getCurrentCompanyId']);
    authService.isGymAdmin.and.returnValue(false);
    authService.getCurrentUserId.and.returnValue('trainer-1');
    authService.getCurrentCompanyId.and.returnValue('company-1');
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

    return { component, api, authService, dialog };
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

    api.getExerciseById.and.returnValue(of(refreshedExercises[0]));
    const loadExercisesSpy = spyOn(component, 'loadExercises');

    (component as any).startMediaRefreshPolling('ex-1');
    tick(2000);

    let currentExercises: Exercise[] = [];
    component.exercises$.subscribe(exercises => currentExercises = exercises);

    expect(loadExercisesSpy).not.toHaveBeenCalled();
    expect(api.getExerciseById).toHaveBeenCalledTimes(1);
    expect(currentExercises[0].id).toBe('ex-1');
    expect(currentExercises[0].video?.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
    expect(currentExercises[1]).toEqual(initialExercises[1]);

    tick(4000);
    expect(api.getExerciseById).toHaveBeenCalledTimes(1);
  }));

  it('stops polling after the configured max attempts when no thumbnail is found', fakeAsync(() => {
    const { component, api } = createComponent();
    const exercisesWithoutThumbnail = [
      createExercise('ex-1', { video: { type: 'S3', previewUrl: 'https://cdn.example.com/video.mp4' } })
    ];

    (component as any).exercisesSnapshot = exercisesWithoutThumbnail;
    component.exercises$ = of(exercisesWithoutThumbnail);
    (component as any).rebuildFilteredExercises();

    api.getExerciseById.and.returnValue(of(exercisesWithoutThumbnail[0]));

    (component as any).startMediaRefreshPolling('ex-1');
    tick(2000 * 15);
    tick(4000);

    expect(api.getExerciseById).toHaveBeenCalledTimes(15);
  }));

  it('opens the edit dialog with the wider layout config', () => {
    const { component, dialog } = createComponent();
    const exerciseSaved = new Subject<any>();
    const afterClosed = new Subject<any>();
    const dialogRef = {
      componentInstance: { exerciseSaved },
      afterClosed: () => afterClosed.asObservable()
    };

    dialog.open.and.returnValue(dialogRef as any);

    component.onCreateNewClicked();

    expect(dialog.open).toHaveBeenCalledWith(ExerciseEditDialogComponent, jasmine.objectContaining({
      width: '960px',
      maxWidth: '96vw'
    }));
  });

  it('allows create when current user is authenticated without relying on System', () => {
    const { component, authService } = createComponent();

    authService.getCurrentUserId.and.returnValue('trainer-1');

    expect(component.canModifyExercises).toBeTrue();
  });

  it('does not allow create when there is no authenticated user', () => {
    const { component, authService, dialog } = createComponent();

    authService.getCurrentUserId.and.returnValue(null);

    component.onCreateNewClicked();

    expect(component.canModifyExercises).toBeFalse();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('blocks editing exercises not owned by the current user', () => {
    const { component, dialog } = createComponent();
    const openEditDialogSpy = spyOn<any>(component, 'openEditDialog');

    component.onEditExercise(createExercise('ex-1', {
      source: 'CUSTOM',
      trainerId: 'trainer-2'
    }));

    expect(openEditDialogSpy).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('allows editing owned custom exercises', () => {
    const { component } = createComponent();
    const openEditDialogSpy = spyOn<any>(component, 'openEditDialog');
    const exercise = createExercise('ex-1', {
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    });

    component.onEditExercise(exercise);

    expect(openEditDialogSpy).toHaveBeenCalledOnceWith(exercise);
  });

  it('blocks deleting exercises not owned by the current user', () => {
    const { component, dialog, api } = createComponent();

    component.onDeleteExercise(createExercise('ex-1', {
      source: 'CUSTOM',
      trainerId: 'trainer-2'
    }));

    expect(dialog.open).not.toHaveBeenCalled();
    expect(api.deleteExercise).not.toHaveBeenCalled();
  });

  it('opens the delete confirmation for owned custom exercises', () => {
    const { component, dialog } = createComponent();
    const afterClosed = new Subject<boolean>();
    dialog.open.and.returnValue({
      afterClosed: () => afterClosed.asObservable()
    } as any);

    component.onDeleteExercise(createExercise('ex-1', {
      source: 'CUSTOM',
      trainerId: 'trainer-1'
    }));

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, jasmine.anything());
  });

  it('opens edit from video details only for own exercises', () => {
    const { component, dialog } = createComponent();
    const viewDetailsClicked = new Subject<Exercise>();
    const openEditDialogSpy = spyOn<any>(component, 'openEditDialog');

    dialog.open.and.returnValue({
      componentInstance: { viewDetailsClicked }
    } as any);

    component.onOpenVideo(createExercise('seed'));

    viewDetailsClicked.next(createExercise('foreign', { source: 'CUSTOM', trainerId: 'trainer-2' }));
    viewDetailsClicked.next(createExercise('no-trainer', { source: 'LIBRARY', trainerId: null }));
    viewDetailsClicked.next(createExercise('owned', { source: 'CUSTOM', trainerId: 'trainer-1' }));

    expect(openEditDialogSpy).toHaveBeenCalledTimes(1);
    expect(openEditDialogSpy).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'owned' }));
  });
});
