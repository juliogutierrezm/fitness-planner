import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExerciseEditDialogComponent, ExerciseEditDialogData } from './exercise-edit-dialog.component';
import { Exercise, FilterOptions } from '../../../../shared/models';
import { ExerciseApiService } from '../../../../exercise-api.service';

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

  it('preserves youtubeUrl when building a new S3 payload for an existing exercise', () => {
    const existingExercise = createExercise({
      video: {
        type: 'S3',
        previewUrl: 'https://cdn.example.com/original.mp4',
        thumbnailUrl: 'https://cdn.example.com/original.jpg',
        youtubeUrl: 'https://youtube.com/watch?v=keepme',
        url: 'https://cdn.example.com/original-download.mp4'
      }
    });
    const { component, api } = createComponent(existingExercise);

    component.editForm.patchValue({
      youtubeUrl: '',
      tips: '',
      common_mistakes: '',
      aliases: '',
      secondary_muscles: ''
    });

    const uploadedVideo = (component as any).buildS3VideoPayload(
      'https://cdn.example.com/new.mp4',
      'https://cdn.example.com/new.jpg'
    );

    (component as any).persistExistingExercise(component.editForm.value, uploadedVideo, 's3-key');

    expect(api.updateExercise).toHaveBeenCalled();
    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.video).toEqual(jasmine.objectContaining({
      type: 'S3',
      previewUrl: 'https://cdn.example.com/new.mp4',
      thumbnailUrl: 'https://cdn.example.com/new.jpg',
      youtubeUrl: 'https://youtube.com/watch?v=keepme',
      url: 'https://cdn.example.com/original-download.mp4'
    }));
  });

  it('preserves the complete existing video object when saving without a new upload', () => {
    const existingExercise = createExercise({
      video: {
        type: 'S3',
        previewUrl: 'https://cdn.example.com/original.mp4',
        thumbnailUrl: 'https://cdn.example.com/original.jpg',
        youtubeUrl: 'https://youtube.com/watch?v=keepme',
        url: 'https://cdn.example.com/original-download.mp4'
      }
    });
    const { component, api } = createComponent(existingExercise);

    component.editForm.patchValue({
      youtubeUrl: '',
      tips: '',
      common_mistakes: '',
      aliases: '',
      secondary_muscles: ''
    });

    (component as any).persistExistingExercise(component.editForm.value);

    expect(api.updateExercise).toHaveBeenCalled();
    const payload = api.updateExercise.calls.mostRecent().args[0] as Exercise;
    expect(payload.video).toEqual({
      type: 'S3',
      previewUrl: 'https://cdn.example.com/original.mp4',
      thumbnailUrl: 'https://cdn.example.com/original.jpg',
      youtubeUrl: 'https://youtube.com/watch?v=keepme',
      url: 'https://cdn.example.com/original-download.mp4'
    });
  });

  it('normalizes video without changing type or dropping existing fields', () => {
    const { component } = createComponent(null);
    const originalVideo = {
      type: 'YOUTUBE',
      previewUrl: 'https://cdn.example.com/preview.mp4',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      youtubeUrl: 'https://youtube.com/watch?v=keepme',
      url: 'https://youtube.com/watch?v=keepme',
      customField: 'preserve-me'
    } as any;

    const normalizedVideo = (component as any).normalizeVideoPayload(originalVideo);

    expect(normalizedVideo).toEqual(originalVideo);
    expect(normalizedVideo.type).toBe('YOUTUBE');
    expect(normalizedVideo.customField).toBe('preserve-me');
  });
});
