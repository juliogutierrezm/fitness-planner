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

    return { component, api, dialogRef };
  }

  it('loads persisted fields into the form', () => {
    const existingExercise = createExercise({
      description_es: 'Descripcion actual',
      tips: [' Mantener core activo ', 'Bajar con control'],
      common_mistakes: [' No bloquear codos ', 'Perder alineacion'],
      secondary_muscles: ['Triceps', ' Deltoides '],
      video: {
        type: 'YOUTUBE',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
      }
    });

    const { component } = createComponent(existingExercise);

    expect(component.editForm.get('description_es')?.value).toBe('Descripcion actual');
    expect(component.editForm.get('tips')?.value).toBe(' Mantener core activo \nBajar con control');
    expect(component.editForm.get('common_mistakes')?.value).toBe(' No bloquear codos \nPerder alineacion');
    expect(component.editForm.get('secondary_muscles')?.value).toBe('Triceps,  Deltoides ');
    expect(component.editForm.get('videoType')?.value).toBe('YOUTUBE');
    expect(component.editForm.get('youtubeUrl')?.value).toBe('https://www.youtube.com/watch?v=abc123xyz99');
  });

  it('sanitizes multiline and csv fields before saving', () => {
    const { component, api } = createComponent(createExercise());

    component.editForm.patchValue({
      tips: ' tip 1 \n \n tip 2 ',
      common_mistakes: ' error 1 \n   \n error 2 ',
      aliases: ' alias 1 , , alias 2 ',
      secondary_muscles: ' triceps , , hombro ',
      videoType: 'NONE'
    });

    (component as any).persistExistingExercise(component.editForm.getRawValue(), null);

    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.tips).toEqual(['tip 1', 'tip 2']);
    expect(payload.common_mistakes).toEqual(['error 1', 'error 2']);
    expect(payload.aliases).toEqual(['alias 1', 'alias 2']);
    expect(payload.secondary_muscles).toEqual(['triceps', 'hombro']);
  });

  it('sends video as null when videoType is NONE', () => {
    const { component, api } = createComponent(createExercise({
      video: {
        type: 'S3',
        previewUrl: 'https://cdn.example.com/original.mp4',
        thumbnailUrl: 'https://cdn.example.com/original.jpg'
      }
    }));

    component.editForm.patchValue({ videoType: 'NONE' });
    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.video).toBeNull();
    expect((payload as any).functional).toBeUndefined();
  });

  it('builds an exclusive youtube payload with derived thumbnail', () => {
    const { component, api } = createComponent(createExercise());

    component.editForm.patchValue({
      videoType: 'YOUTUBE',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
    });
    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.video).toEqual({
      type: 'YOUTUBE',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99',
      thumbnailUrl: 'https://img.youtube.com/vi/abc123xyz99/hqdefault.jpg'
    });
  });

  it('keeps an exclusive s3 payload without youtube fields', () => {
    const { component, api } = createComponent(createExercise({
      video: {
        type: 'S3',
        previewUrl: 'https://cdn.example.com/original.mp4',
        thumbnailUrl: 'https://cdn.example.com/original.jpg'
      }
    }));

    component.editForm.patchValue({ videoType: 'S3' });
    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.video).toEqual({
      type: 'S3',
      previewUrl: 'https://cdn.example.com/original.mp4',
      thumbnailUrl: 'https://cdn.example.com/original.jpg'
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

  it('allows creating an exercise without video', () => {
    const { component, api } = createComponent(null);

    component.editForm.patchValue({
      name_es: 'Sentadilla',
      category: 'Strength',
      muscle_group: 'Legs',
      equipment_type: 'Bodyweight',
      difficulty: 'Intermedio',
      videoType: 'NONE'
    });

    component.onSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.video).toBeNull();
  });

  it('does not include functional in the form', () => {
    const { component } = createComponent(createExercise());
    expect(component.editForm.contains('functional')).toBeFalse();
  });
});
