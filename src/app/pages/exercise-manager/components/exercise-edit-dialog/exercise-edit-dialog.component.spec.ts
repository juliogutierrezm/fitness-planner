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
    categoryOptions: ['Strength'],
    muscleGroupOptions: ['Chest', 'Legs'],
    equipmentTypeOptions: ['Bodyweight'],
    difficultyOptions: ['Principiante', 'Intermedio'],
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
      exercise_type: 'Compuesto',
      source: 'CUSTOM',
      ...overrides
    } as Exercise;
  }

  function createComponent(exercise: Exercise | null, initialize = true) {
    const api = jasmine.createSpyObj<ExerciseApiService>('ExerciseApiService', [
      'updateExercise',
      'createExercise',
      'getUploadUrl',
      'getVideoStatus',
      'getExerciseById'
    ]);
    api.updateExercise.and.returnValue(of({ ok: true }));
    api.createExercise.and.returnValue(of({ ok: true }));
    api.getUploadUrl.and.returnValue(of(null));
    api.getVideoStatus.and.returnValue(of({ ready: false }));
    api.getExerciseById.and.callFake((id: string) => of(exercise ? { ...exercise, id } : null));

    const dialogRef = jasmine.createSpyObj<MatDialogRef<ExerciseEditDialogComponent>>('MatDialogRef', ['close']);
    const snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    const sanitizer = {
      bypassSecurityTrustResourceUrl: (value: string) => value
    } as unknown as DomSanitizer;
    const cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck', 'detectChanges']);

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

    if (initialize) {
      component.ngOnInit();
    }

    return { component, api, dialogRef, snackBar, cdr };
  }

  function fillRequiredFields(component: ExerciseEditDialogComponent): void {
    component.editForm.patchValue({
      name_es: 'Sentadilla',
      category: 'Strength',
      equipment_type: 'Bodyweight',
      difficulty: 'Intermedio',
      muscle_group: 'Legs',
      exercise_type: 'Compuesto'
    });
  }

  it('selects no video by default', () => {
    const { component } = createComponent(null);

    expect(component.editForm.get('videoMode')?.value).toBe('NONE');
    expect(component.selectedVideoMode).toBe('NONE');
    expect(component.editForm.get('youtubeUrl')?.validator).toBeNull();
    expect(component.editForm.get('videoFileSelected')?.validator).toBeNull();
  });

  it('creates a valid exercise without video', () => {
    const { component, api } = createComponent(null);
    fillRequiredFields(component);

    expect(component.editForm.valid).toBeTrue();

    component.onSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.name_en).toBe('Sentadilla');
    expect(Object.prototype.hasOwnProperty.call(payload, 'video')).toBeFalse();
  });

  it('blocks saving when YouTube is selected without a URL', () => {
    const { component, api, snackBar } = createComponent(null);
    fillRequiredFields(component);

    component.editForm.patchValue({ videoMode: 'YOUTUBE' });

    expect(component.editForm.get('youtubeUrl')?.hasError('required')).toBeTrue();
    expect(component.editForm.invalid).toBeTrue();

    component.onSave();

    expect(api.createExercise).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      'Complete los campos obligatorios para crear el ejercicio.',
      'Cerrar',
      { duration: 3500 }
    );
  });

  it('creates a YouTube video payload when YouTube is selected with a valid URL', () => {
    const { component, api } = createComponent(null);
    fillRequiredFields(component);

    component.editForm.patchValue({ videoMode: 'YOUTUBE' });
    component.editForm.patchValue({ youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99' });

    expect(component.editForm.valid).toBeTrue();

    component.onSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.video).toEqual({
      type: 'YOUTUBE',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99',
      url: 'https://www.youtube.com/watch?v=abc123xyz99'
    });
  });

  it('blocks saving when local upload is selected without a file', () => {
    const { component, api } = createComponent(null);
    fillRequiredFields(component);

    component.editForm.patchValue({ videoMode: 'S3' });

    expect(component.editForm.get('videoFileSelected')?.hasError('required')).toBeTrue();
    expect(component.editForm.invalid).toBeTrue();

    component.onSave();

    expect(api.createExercise).not.toHaveBeenCalled();
  });

  it('uploads a selected local file before creating the exercise', async () => {
    const { component, api } = createComponent(null);
    fillRequiredFields(component);
    component.editForm.patchValue({ videoMode: 'S3' });
    api.getUploadUrl.and.returnValue(of({
      uploadUrl: 'https://upload.example.com/video',
      s3_key: 'videos/exercise.mp4',
      preview_url: 'https://cdn.example.com/video.mp4',
      thumbnail_url: 'https://cdn.example.com/thumb.jpg'
    }));
    spyOn(window, 'fetch').and.returnValue(Promise.resolve({ ok: true } as Response));

    const file = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    component.selectedVideoFile = file;
    component.selectedVideoFileName = file.name;
    component.editForm.patchValue({ videoFileSelected: true });

    expect(component.editForm.valid).toBeTrue();

    component.onSave();
    await Promise.resolve();
    await Promise.resolve();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(api.getUploadUrl).toHaveBeenCalledWith(jasmine.stringMatching(/\.mp4$/), 'video/mp4');
    expect(window.fetch).toHaveBeenCalled();
    expect(payload.video).toEqual({
      type: 'S3',
      previewUrl: 'https://cdn.example.com/video.mp4',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg'
    });
  });

  it('cleans mode-specific validation when switching between video modes', () => {
    const { component } = createComponent(null);
    fillRequiredFields(component);

    component.editForm.patchValue({ videoMode: 'YOUTUBE' });
    component.editForm.patchValue({ youtubeUrl: 'https://example.com/video' });
    expect(component.editForm.get('youtubeUrl')?.hasError('youtubeUrl')).toBeTrue();

    component.editForm.patchValue({ videoMode: 'NONE' });
    expect(component.editForm.get('youtubeUrl')?.value).toBe('');
    expect(component.editForm.get('youtubeUrl')?.errors).toBeNull();
    expect(component.editForm.valid).toBeTrue();

    component.editForm.patchValue({ videoMode: 'S3' });
    expect(component.editForm.get('videoFileSelected')?.hasError('required')).toBeTrue();

    component.editForm.patchValue({ videoMode: 'NONE' });
    expect(component.editForm.get('videoFileSelected')?.value).toBeFalse();
    expect(component.editForm.get('videoFileSelected')?.errors).toBeNull();
    expect(component.editForm.valid).toBeTrue();
  });

  it('preserves existing video when editing without a replacement', () => {
    const existingVideo = {
      type: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=old123xyz99',
      url: 'https://www.youtube.com/watch?v=old123xyz99'
    };
    const { component, api } = createComponent(createExercise({ video: existingVideo }));

    expect(component.editForm.get('videoMode')?.value).toBe('YOUTUBE');
    expect(component.editForm.get('youtubeUrl')?.value).toBe('https://www.youtube.com/watch?v=old123xyz99');

    component.editForm.patchValue({ name_es: 'Lagartija actualizada' });
    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as any;
    expect(payload.name_es).toBe('Lagartija actualizada');
    expect(payload.video).toEqual(existingVideo);
  });

  it('selects local upload when editing an exercise with an existing S3 video', () => {
    const existingVideo = {
      type: 'S3' as const,
      previewUrl: 'https://cdn.example.com/existing.mp4',
      thumbnailUrl: 'https://cdn.example.com/existing.jpg'
    };
    const { component, api } = createComponent(createExercise({ video: existingVideo }));

    expect(component.editForm.get('videoMode')?.value).toBe('S3');
    expect(component.editForm.get('videoFileSelected')?.errors).toBeNull();
    expect(component.getExistingS3PreviewUrl()).toBe('https://cdn.example.com/existing.mp4');

    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as any;
    expect(payload.video).toEqual(existingVideo);
  });

  it('hides an existing YouTube preview when the user switches to no video', () => {
    const existingVideo = {
      type: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=old123xyz99',
      url: 'https://www.youtube.com/watch?v=old123xyz99'
    };
    const { component } = createComponent(createExercise({ video: existingVideo }));

    expect(component.editForm.get('videoMode')?.value).toBe('YOUTUBE');
    expect(component.getYoutubePreviewUrl()).toBeTruthy();

    component.editForm.patchValue({ videoMode: 'NONE' });

    expect(component.editForm.get('youtubeUrl')?.value).toBe('');
    expect(component.getYoutubePreviewUrl()).toBeNull();
    expect(component.editForm.valid).toBeTrue();
  });

  it('updates existing video when a new YouTube URL is selected in edit mode', () => {
    const existingVideo = {
      type: 'YOUTUBE' as const,
      youtubeUrl: 'https://www.youtube.com/watch?v=old123xyz99',
      url: 'https://www.youtube.com/watch?v=old123xyz99'
    };
    const { component, api } = createComponent(createExercise({ video: existingVideo }));

    component.editForm.patchValue({ videoMode: 'YOUTUBE' });
    component.editForm.patchValue({ youtubeUrl: 'https://youtu.be/new123xyz99' });
    component.onSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as any;
    expect(payload.video).toEqual({
      type: 'YOUTUBE',
      youtubeUrl: 'https://youtu.be/new123xyz99',
      url: 'https://youtu.be/new123xyz99'
    });
  });

  it('keeps optional fields outside video validation', () => {
    const { component, api } = createComponent(null);
    fillRequiredFields(component);
    component.editForm.patchValue({
      tips: 'Respira\n',
      common_mistakes: '',
      aliases: 'Squat\n',
      secondary_muscles: ''
    });

    expect(component.editForm.valid).toBeTrue();

    component.onSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.tips).toEqual(['Respira']);
    expect(payload.aliases).toEqual(['Squat']);
    expect(payload.functional).toBeUndefined();
    expect(payload.common_mistakes).toBeUndefined();
    expect(payload.secondary_muscles).toBeUndefined();
  });
});
