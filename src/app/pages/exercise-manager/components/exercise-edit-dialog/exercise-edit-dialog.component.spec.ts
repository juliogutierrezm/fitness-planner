import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise, FilterOptions } from '../../../../shared/models';
import { ExerciseEditDialogComponent, ExerciseEditDialogData } from './exercise-edit-dialog.component';

describe('ExerciseEditDialogComponent', () => {
  const filterOptions: FilterOptions = {
    categoryOptions: [],
    muscleGroupOptions: [],
    equipmentTypeOptions: [],
    difficultyOptions: [],
    groupTypeOptions: []
  };

  function createExercise(overrides: Partial<Exercise> = {}): Exercise {
    return {
      id: 'exercise-1',
      name: 'Push Up',
      name_es: 'Lagartija',
      name_en: 'Push Up',
      equipment: 'Bodyweight',
      equipment_type: 'Bodyweight',
      muscle: 'Chest',
      muscle_group: 'Chest',
      category: 'Strength',
      difficulty: 'Intermedio',
      source: 'CUSTOM',
      ...overrides
    } as Exercise;
  }

  function createComponent(exercise: Exercise | null) {
    const api = jasmine.createSpyObj<ExerciseApiService>('ExerciseApiService', [
      'updateExercise',
      'updateExerciseLibraryItem',
      'createExercise',
      'getUploadUrl',
      'getVideoStatus'
    ]);
    api.updateExercise.and.returnValue(of({ ok: true }));
    api.updateExerciseLibraryItem.and.returnValue(of({ ok: true, updated: {} }));
    api.createExercise.and.returnValue(of({ ok: true }));
    api.getUploadUrl.and.returnValue(of(null));
    api.getVideoStatus.and.returnValue(of({ ready: false }));

    const dialogRef = jasmine.createSpyObj<MatDialogRef<ExerciseEditDialogComponent>>('MatDialogRef', ['close']);
    const snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    const sanitizer = {
      bypassSecurityTrustResourceUrl: (value: string) => value
    } as unknown as DomSanitizer;
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);

    const data: ExerciseEditDialogData = {
      exercise,
      filterOptions
    };

    const component = new ExerciseEditDialogComponent(
      data,
      dialogRef,
      new FormBuilder(),
      api,
      snackBar,
      sanitizer,
      cdr
    );

    return { component, api, dialogRef, snackBar };
  }

  it('starts on step one and loads persisted values', () => {
    const existingExercise = createExercise({
      description_es: 'Descripcion actual',
      exercise_type: 'Compuesto',
      training_goal: 'Fuerza',
      tips: [' Mantener core activo ', 'Bajar con control'],
      common_mistakes: [' No bloquear codos ', 'Perder alineacion'],
      secondary_muscles: ['Triceps', ' Deltoides '],
      video: {
        type: 'YOUTUBE',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
      }
    });

    const { component } = createComponent(existingExercise);

    expect(component.currentStep).toBe(1);
    expect(component.editForm.get('description_es')?.value).toBe('Descripcion actual');
    expect(component.editForm.get('exercise_type')?.value).toBe('Compuesto');
    expect(component.editForm.get('training_goal')?.value).toBe('Fuerza');
    expect(component.editForm.get('tips')?.value).toBe(' Mantener core activo \nBajar con control');
    expect(component.editForm.get('common_mistakes')?.value).toBe(' No bloquear codos \nPerder alineacion');
    expect(component.editForm.get('secondary_muscles')?.value).toBe('Triceps,  Deltoides ');
    expect(component.editForm.get('videoType')?.value).toBe('YOUTUBE');
    expect(component.editForm.get('youtubeUrl')?.value).toBe('https://www.youtube.com/watch?v=abc123xyz99');
  });

  it('cleanArray removes empty values and returns undefined when nothing remains', () => {
    const { component } = createComponent(null);

    expect((component as any).cleanArray(['  ', '', ' tip 1 ', ' tip 2 '])).toEqual(['tip 1', 'tip 2']);
    expect((component as any).cleanArray(['  ', '', '   '])).toBeUndefined();
  });

  it('builds a full create payload without empty optional fields and with name_en fallback', () => {
    const { component } = createComponent(null);

    const payload = (component as any).buildExercisePayload({
      name_es: 'Sentadilla',
      name_en: '   ',
      category: 'Strength',
      difficulty: 'Intermedio',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      videoType: 'NONE',
      training_goal: '   ',
      exercise_type: '',
      description_es: '   ',
      tips: '  \n ',
      common_mistakes: '',
      secondary_muscles: ', ,'
    }, 'full', 'exercise-1');

    expect(payload.name_en).toBe('Sentadilla');
    expect(payload.tips).toBeUndefined();
    expect(payload.common_mistakes).toBeUndefined();
    expect(payload.secondary_muscles).toBeUndefined();
    expect(payload.training_goal).toBeUndefined();
    expect(payload.exercise_type).toBeUndefined();
    expect(payload.description_es).toBeUndefined();
    expect(payload.video).toBeNull();
  });

  it('builds a quick create payload with only the minimum valid fields', () => {
    const { component } = createComponent(null);

    const payload = (component as any).buildExercisePayload({
      name_es: 'Sentadilla',
      name_en: '',
      category: 'Strength',
      difficulty: 'Intermedio',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      videoType: 'NONE',
      tips: 'tip 1',
      description_es: 'Descripcion opcional'
    }, 'quick', 'exercise-2');

    expect(payload).toEqual(jasmine.objectContaining({
      id: 'exercise-2',
      name_es: 'Sentadilla',
      name_en: 'Sentadilla',
      category: 'Strength',
      difficulty: 'Intermedio',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      video: null
    }));
    expect(payload.tips).toBeUndefined();
    expect(payload.description_es).toBeUndefined();
  });

  it('preserves existing optional fields on quick edit', () => {
    const { component } = createComponent(createExercise({
      description_es: 'Se conserva',
      tips: ['Tip guardado'],
      common_mistakes: ['Error guardado']
    }));

    const payload = (component as any).buildExercisePayload({
      name_es: 'Lagartija',
      name_en: '',
      category: 'Strength',
      difficulty: 'Avanzado',
      equipment_type: 'Bodyweight',
      muscle_group: 'Chest',
      videoType: 'NONE',
      tips: '',
      common_mistakes: '',
      description_es: ''
    }, 'quick', 'exercise-1');

    expect(payload.description_es).toBe('Se conserva');
    expect(payload.tips).toEqual(['Tip guardado']);
    expect(payload.common_mistakes).toEqual(['Error guardado']);
    expect(payload.difficulty).toBe('Avanzado');
  });

  it('builds an exclusive youtube payload with derived thumbnail', () => {
    const { component } = createComponent(createExercise());

    component.editForm.patchValue({
      videoType: 'YOUTUBE',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
    });

    const payload = (component as any).buildExercisePayload(component.editForm.getRawValue(), 'full', 'exercise-1');

    expect(payload.video).toEqual({
      type: 'YOUTUBE',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123xyz99/hqdefault.jpg'
    });
  });

  it('clears incompatible state when switching video type', () => {
    const { component } = createComponent(createExercise({
      video: {
        type: 'YOUTUBE',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
      }
    }));

    component.editForm.patchValue({ youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99' });
    component.editForm.patchValue({ videoType: 'S3' });

    expect(component.editForm.get('youtubeUrl')?.value).toBe('');

    (component as any).selectedVideoFileName = 'video.mp4';
    (component as any).videoState.previewUrl = 'https://cdn.example.com/new.mp4';
    component.editForm.patchValue({ videoType: 'NONE' });

    expect((component as any).selectedVideoFileName).toBeNull();
    expect((component as any).videoState.previewUrl).toBeNull();
    expect(component.editForm.get('youtubeUrl')?.value).toBe('');
  });

  it('moves to the optional step only when step one is valid', () => {
    const { component } = createComponent(null);

    component.goToOptionalStep();
    expect(component.currentStep).toBe(1);

    component.editForm.patchValue({
      name_es: 'Sentadilla',
      category: 'Strength',
      difficulty: 'Intermedio',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      videoType: 'NONE'
    });

    component.goToOptionalStep();
    expect(component.currentStep).toBe(2);
  });

  it('supports quick save with a minimum payload', () => {
    const { component, api } = createComponent(null);

    component.editForm.patchValue({
      name_es: 'Sentadilla',
      category: 'Strength',
      muscle_group: 'Legs',
      equipment_type: 'Bodyweight',
      difficulty: 'Intermedio',
      videoType: 'NONE',
      tips: 'tip ignorado'
    });

    component.onQuickSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.name_en).toBe('Sentadilla');
    expect(payload.tips).toBeUndefined();
    expect(payload.video).toBeNull();
  });
});
