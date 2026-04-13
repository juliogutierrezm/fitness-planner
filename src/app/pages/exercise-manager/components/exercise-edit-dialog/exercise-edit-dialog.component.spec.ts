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

  it('does not patch the partial exercise in the constructor', () => {
    const partialExercise = createExercise({
      description_es: 'Descripcion parcial',
      exercise_type: 'Compuesto'
    });

    const { component, api } = createComponent(partialExercise, false);

    expect(component.editForm.get('description_es')?.value).toBe('');
    expect(component.editForm.get('exercise_type')?.value).toBe('');
    expect(api.getExerciseById).not.toHaveBeenCalled();
  });

  it('starts on step one and loads persisted step-two values', () => {
    const existingExercise = createExercise({
      description_es: 'Descripcion actual',
      exercise_type: 'Compuesto',
      tips: [' Mantener core activo ', 'Bajar con control'],
      common_mistakes: [' No bloquear codos ', 'Perder alineacion'],
      video: {
        type: 'YOUTUBE',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
      }
    });

    const { component } = createComponent(existingExercise);

    expect(component.currentStep).toBe(1);
    expect(component.editForm.get('description_es')?.value).toBe('Descripcion actual');
    expect(component.editForm.get('exercise_type')?.value).toBe('Compuesto');
    expect(component.editForm.get('tips')?.value).toBe(' Mantener core activo \nBajar con control');
    expect(component.editForm.get('common_mistakes')?.value).toBe(' No bloquear codos \nPerder alineacion');
    expect(component.editForm.get('videoType')?.value).toBe('YOUTUBE');
    expect(component.editForm.get('youtubeUrl')?.value).toBe('https://www.youtube.com/watch?v=abc123xyz99');
  });

  it('loads the full exercise on init when editing', () => {
    const existingExercise = createExercise();
    const { component, api } = createComponent(existingExercise, false);

    component.ngOnInit();

    expect(api.getExerciseById).toHaveBeenCalledTimes(1);
    expect(api.getExerciseById).toHaveBeenCalledWith('exercise-1');
    expect((component as any).exercise).not.toBe(existingExercise);
  });

  it('patches optional arrays with empty fallbacks when they are missing', () => {
    const { component } = createComponent(createExercise({
      tips: undefined,
      common_mistakes: undefined
    }));

    expect(component.editForm.get('tips')?.value).toBe('');
    expect(component.editForm.get('common_mistakes')?.value).toBe('');
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
      exercise_type: 'Compuesto',
      description_es: '   ',
      tips: '  \n ',
      common_mistakes: ''
    }, 'full', 'exercise-1');

    expect(payload.name_en).toBe('Sentadilla');
    expect(payload.tips).toBeUndefined();
    expect(payload.common_mistakes).toBeUndefined();
    expect(payload.exercise_type).toBe('Compuesto');
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
      tips: 'tip ignorado',
      description_es: 'Descripcion opcional',
      exercise_type: 'Compuesto'
    }, 'quick', 'exercise-2');

    expect(payload).toEqual(jasmine.objectContaining({
      id: 'exercise-2',
      name_es: 'Sentadilla',
      name_en: 'Sentadilla',
      category: 'Strength',
      difficulty: 'Intermedio',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      exercise_type: 'Compuesto',
      video: null
    }));
    expect(payload.tips).toBeUndefined();
    expect(payload.description_es).toBeUndefined();
  });

  it('preserves existing optional fields on quick edit', () => {
    const { component } = createComponent(createExercise({
      description_es: 'Se conserva',
      exercise_type: 'Aislado',
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
      exercise_type: 'Aislado',
      videoType: 'NONE',
      tips: '',
      common_mistakes: '',
      description_es: ''
    }, 'quick', 'exercise-1');

    expect(payload.description_es).toBe('Se conserva');
    expect(payload.exercise_type).toBe('Aislado');
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
      exercise_type: 'Compuesto',
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
      exercise_type: 'Compuesto',
      videoType: 'NONE',
      tips: 'tip ignorado'
    });

    component.onQuickSave();

    const payload = api.createExercise.calls.mostRecent().args[0] as any;
    expect(payload.name_en).toBe('Sentadilla');
    expect(payload.exercise_type).toBe('Compuesto');
    expect(payload.tips).toBeUndefined();
    expect(payload.video).toBeNull();
  });

  it('prevents duplicate full-exercise loads while one is already in progress', () => {
    const { component, api } = createComponent(createExercise(), false);

    (component as any).loadingExercise = true;
    (component as any).loadFullExercise('exercise-1');

    expect(api.getExerciseById).not.toHaveBeenCalled();
  });

  it('uses the existing exercise as fallback when full load returns null', () => {
    const partialExercise = createExercise({
      description_es: 'Descripcion parcial',
      exercise_type: 'Compuesto',
      tips: ['Tip parcial']
    });
    const { component, api, snackBar, cdr } = createComponent(partialExercise, false);
    api.getExerciseById.and.returnValue(of(null));

    component.ngOnInit();

    expect(component.editForm.get('description_es')?.value).toBe('Descripcion parcial');
    expect(component.editForm.get('exercise_type')?.value).toBe('Compuesto');
    expect(component.editForm.get('tips')?.value).toBe('Tip parcial');
    expect(snackBar.open).toHaveBeenCalled();
    expect(cdr.detectChanges).toHaveBeenCalled();
  });

  it('disables critical actions while the full exercise is loading', () => {
    const { component } = createComponent(createExercise(), false);

    (component as any).loadingExercise = true;

    expect(component.isActionDisabled).toBeTrue();
  });

  it('keeps existing step-two values when quick saving an edit', () => {
    const existingExercise = createExercise({
      description_es: 'Se conserva',
      exercise_type: 'Compuesto',
      tips: ['Tip guardado'],
      common_mistakes: ['Error guardado']
    });
    const { component, api } = createComponent(existingExercise);

    component.editForm.patchValue({
      name_es: 'Lagartija actualizada',
      category: 'Strength',
      muscle_group: 'Chest',
      equipment_type: 'Bodyweight',
      difficulty: 'Avanzado',
      exercise_type: 'Aislado',
      videoType: 'NONE',
      description_es: '',
      tips: '',
      common_mistakes: ''
    });

    component.onQuickSave();

    const payload = api.updateExercise.calls.mostRecent().args[0] as any;
    expect(payload.name_es).toBe('Lagartija actualizada');
    expect(payload.description_es).toBe('Se conserva');
    expect(payload.exercise_type).toBe('Aislado');
    expect(payload.tips).toEqual(['Tip guardado']);
    expect(payload.common_mistakes).toEqual(['Error guardado']);
  });

  it('refreshes the form with getExerciseById after update', () => {
    const existingExercise = createExercise({
      description_es: 'Descripcion anterior',
      exercise_type: 'Aislado',
      tips: ['Tip viejo'],
      common_mistakes: ['Error viejo']
    });
    const refreshedExercise = createExercise({
      description_es: 'Descripcion refrescada',
      exercise_type: 'Compuesto',
      tips: ['Tip nuevo 1', 'Tip nuevo 2'],
      common_mistakes: ['Error nuevo'],
      video: {
        type: 'YOUTUBE',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123xyz99'
      }
    });

    const { component, api, dialogRef, cdr } = createComponent(existingExercise);
    api.updateExercise.and.returnValue(of({ ok: true, updated: { description_es: 'parcial' } }));
    api.getExerciseById.and.returnValue(of(refreshedExercise));
    spyOn(component.exerciseSaved, 'emit');

    component.onSave();

    expect(api.updateExercise).toHaveBeenCalled();
    expect(api.getExerciseById).toHaveBeenCalledWith('exercise-1');
    expect(component.editForm.get('description_es')?.value).toBe('Descripcion refrescada');
    expect(component.editForm.get('exercise_type')?.value).toBe('Compuesto');
    expect(component.editForm.get('tips')?.value).toBe('Tip nuevo 1\nTip nuevo 2');
    expect(component.editForm.get('common_mistakes')?.value).toBe('Error nuevo');
    expect(component.editForm.get('videoType')?.value).toBe('YOUTUBE');
    expect(component.editForm.get('youtubeUrl')?.value).toBe('https://www.youtube.com/watch?v=abc123xyz99');
    expect(component.exerciseSaved.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      exerciseId: 'exercise-1'
    }));
    expect(cdr.detectChanges).toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('patches step-two values when the refreshed exercise comes with exerciseId only', () => {
    const existingExercise = createExercise({ exercise_type: 'Aislado' });
    const backendExercise = {
      exerciseId: 'exercise-1',
      name_es: 'test 01',
      name_en: 'test',
      equipment_type: 'Barra',
      muscle_group: 'Bíceps',
      category: 'Complex',
      difficulty: 'Principiante',
      exercise_type: 'Compuesto',
      description_es: 'Test descripcion',
      tips: ['Test tips'],
      common_mistakes: ['Test errores'],
      video: null
    } as any;

    const { component, api } = createComponent(existingExercise);
    api.updateExercise.and.returnValue(of({ ok: true }));
    api.getExerciseById.and.returnValue(of(backendExercise));

    component.onQuickSave();
    component.goToStep(2);

    expect(component.editForm.get('exercise_type')?.value).toBe('Compuesto');
    expect(component.editForm.get('description_es')?.value).toBe('Test descripcion');
    expect(component.editForm.get('tips')?.value).toBe('Test tips');
    expect(component.editForm.get('common_mistakes')?.value).toBe('Test errores');
  });
});
