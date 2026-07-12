import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subscription, interval } from 'rxjs';
import { finalize, switchMap, takeWhile } from 'rxjs/operators';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise, FilterOptions, VideoSource } from '../../../../shared/models';
import { sanitizeName } from '../../../../shared/shared-utils';
import { buildYoutubeEmbedUrl, getS3PreviewUrl, getThumbnailSource, getYoutubeUrl } from '../../../../shared/video-utils';

export interface ExerciseEditDialogData {
  exercise: Exercise | null;
  filterOptions: FilterOptions;
}

type VideoMode = 'NONE' | 'YOUTUBE' | 'S3';

@Component({
  selector: 'app-exercise-edit-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSnackBarModule,
    MatIconModule,
    MatTabsModule
  ],
  templateUrl: './exercise-edit-dialog.component.html',
  styleUrl: './exercise-edit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseEditDialogComponent implements OnDestroy, OnInit {
  @Output() exerciseSaved = new EventEmitter<any>();
  @Output() dialogClosed = new EventEmitter<void>();

  editForm: FormGroup;
  isCreationMode = false;
  uploadError = '';
  saving = false;
  loadingExercise = false;
  refreshingExercise = false;
  private exerciseId: string | null = null;

  categoryOptions: string[];
  muscleGroupOptions: string[];
  equipmentTypeOptions: string[];
  difficultyOptions: string[];

  selectedVideoFile: File | null = null;
  selectedVideoFileName: string | null = null;
  selectedVideoPreviewUrl: string | null = null;

  videoState = {
    uploading: false,
    processing: false,
    ready: false,
    previewUrl: null as string | null,
    thumbnailUrl: null as string | null,
    s3Key: null as string | null
  };

  private exercise: Exercise | null;
  private pollingSubscription: Subscription | null = null;
  private videoModeSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL_MS = 3000;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ExerciseEditDialogData,
    private dialogRef: MatDialogRef<ExerciseEditDialogComponent>,
    private fb: FormBuilder,
    private api: ExerciseApiService,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    this.exercise = data.exercise;
    this.isCreationMode = !this.exercise;

    this.categoryOptions = data.filterOptions.categoryOptions;
    this.muscleGroupOptions = data.filterOptions.muscleGroupOptions;
    this.equipmentTypeOptions = data.filterOptions.equipmentTypeOptions;
    this.difficultyOptions = data.filterOptions.difficultyOptions;

    this.editForm = this.createForm();
    this.videoModeSubscription = this.editForm.get('videoMode')?.valueChanges.subscribe((mode: VideoMode) => {
      this.handleVideoModeChange(mode);
    }) || null;
    this.editForm.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    if (this.isCreationMode) {
      return;
    }

    const exerciseId = this.getExerciseId(this.exercise);
    if (exerciseId) {
      this.loadFullExercise(exerciseId);
      return;
    }

    if (this.exercise) {
      this.resetAndPatchForm(this.exercise);
    }
  }

  get isActionDisabled(): boolean {
    return this.loadingExercise || this.saving || this.refreshingExercise || this.videoState.uploading || this.videoState.processing;
  }

  get selectedVideoMode(): VideoMode {
    return (this.editForm.get('videoMode')?.value || 'NONE') as VideoMode;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.videoModeSubscription?.unsubscribe();
    this.revokeSelectedVideoPreviewUrl();
  }

  onFileSelected(event: Event): void {
    if (this.isActionDisabled) {
      return;
    }

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('video/')) {
      this.uploadError = 'Solo se permiten archivos de video';
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      this.uploadError = 'El archivo no puede superar los 50MB';
      return;
    }

    this.uploadError = '';
    this.clearS3Selection(false);
    this.selectedVideoFile = file;
    this.selectedVideoFileName = file.name;
    this.selectedVideoPreviewUrl = URL.createObjectURL(file);
    this.editForm.patchValue({ videoFileSelected: true }, { emitEvent: false });
    this.editForm.get('videoFileSelected')?.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (this.editForm.invalid || this.isActionDisabled) {
      this.editForm.markAllAsTouched();
      if (this.editForm.invalid) {
        this.snackBar.open('Complete los campos obligatorios para crear el ejercicio.', 'Cerrar', { duration: 3500 });
      }
      this.cdr.markForCheck();
      return;
    }

    this.saveExercise();
  }

  onClose(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }

  getYoutubePreviewUrl(): SafeResourceUrl | null {
    if (this.selectedVideoMode !== 'YOUTUBE') {
      return null;
    }

    const embedUrl = buildYoutubeEmbedUrl(this.editForm.get('youtubeUrl')?.value);
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  getExistingS3PreviewUrl(): string | null {
    return this.videoState.previewUrl || getS3PreviewUrl(this.exercise);
  }

  private getExerciseId(exercise: Partial<Exercise> | null | undefined): string | null {
    return exercise?.id || (exercise as any)?.exerciseId || null;
  }

  private loadFullExercise(id: string): void {
    if (this.loadingExercise) {
      return;
    }

    this.loadingExercise = true;
    this.cdr.markForCheck();

    this.api.getExerciseById(id).pipe(
      finalize(() => {
        this.loadingExercise = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (fullExercise) => {
        if (fullExercise) {
          this.exercise = { ...fullExercise };
          this.exerciseId = this.getExerciseId(fullExercise);
          this.resetAndPatchForm(this.exercise);
          return;
        }

        if (this.exercise) {
          this.resetAndPatchForm(this.exercise);
          this.snackBar.open('No se pudo cargar el ejercicio completo. Se usan datos parciales.', 'Cerrar', { duration: 3500 });
        }
      },
      error: (err) => {
        console.error('Error cargando ejercicio completo:', err);
        if (this.exercise) {
          this.resetAndPatchForm(this.exercise);
        }
        this.snackBar.open('No se pudo cargar el ejercicio completo. Se usan datos parciales.', 'Cerrar', { duration: 3500 });
      }
    });
  }

  private resetAndPatchForm(exercise: Exercise | null): void {
    this.editForm.reset({}, { emitEvent: false });
    this.patchExerciseIntoForm(exercise);
    this.editForm.updateValueAndValidity({ emitEvent: false });
    this.cdr.detectChanges();
  }

  private saveExercise(): void {
    const formValue = this.editForm.getRawValue();
    this.exerciseId = this.isCreationMode
      ? `${sanitizeName((formValue.name_es?.trim() || ''))}_${Date.now()}`
      : this.getExerciseId(this.exercise);

    if (formValue.videoMode === 'S3' && this.selectedVideoFile) {
      if (this.isCreationMode) {
        this.uploadVideoAndCreate(this.exerciseId!, formValue);
        return;
      }

      this.uploadVideoAndUpdateExisting(formValue);
      return;
    }

    if (this.isCreationMode) {
      const youtubeVideo = this.buildYoutubeVideoPayload(formValue.youtubeUrl) || undefined;
      this.createExercise(this.exerciseId!, formValue, youtubeVideo);
      return;
    }

    this.persistExistingExercise(formValue);
  }

  private uploadVideoAndCreate(exerciseId: string, formValue: any): void {
    this.saving = true;
    this.videoState.uploading = true;
    this.cdr.markForCheck();

    const fileName = `${exerciseId}.mp4`;
    const file = this.selectedVideoFile!;

    this.api.getUploadUrl(fileName, file.type).subscribe({
      next: async (response: any) => {
        if (!response?.uploadUrl) {
          this.handleUploadFailure('Error obteniendo URL de subida');
          return;
        }

        try {
          const uploadResponse = await fetch(response.uploadUrl, {
            method: 'PUT',
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }

          this.videoState.uploading = false;
          this.videoState.s3Key = response.s3_key || null;

          if (response.preview_url) {
            this.videoState.previewUrl = response.preview_url || null;
            this.videoState.thumbnailUrl = response.thumbnail_url || null;
            this.createExercise(exerciseId, formValue, this.buildS3VideoPayload(response.preview_url, response.thumbnail_url, formValue.youtubeUrl));
            return;
          }

          this.videoState.processing = true;
          this.cdr.markForCheck();
          this.pollAndCreate(response.s3_key, exerciseId, formValue);
        } catch (err) {
          console.error('Error subiendo video:', err);
          this.handleUploadFailure('Error al subir el video');
        }
      },
      error: (err) => {
        console.error('Error obteniendo URL de subida:', err);
        this.handleUploadFailure('Error obteniendo URL de subida');
      }
    });
  }

  private pollAndCreate(s3Key: string, exerciseId: string, formValue: any): void {
    this.stopPolling();

    this.pollingSubscription = interval(this.POLLING_INTERVAL_MS).pipe(
      switchMap(() => this.api.getVideoStatus(s3Key)),
      takeWhile(status => !status.ready, true),
      finalize(() => this.cdr.markForCheck())
    ).subscribe({
      next: (status) => {
        if (!status.ready) {
          return;
        }

        this.videoState.processing = false;
        this.videoState.ready = true;
        this.videoState.previewUrl = status.previewUrl || null;
        this.videoState.thumbnailUrl = status.thumbnailUrl || null;
        this.createExercise(exerciseId, formValue, this.buildS3VideoPayload(status.previewUrl, status.thumbnailUrl, formValue.youtubeUrl));
      },
      error: (err) => {
        console.error('Polling error:', err);
        this.videoState.processing = false;
        this.uploadError = 'Error verificando estado del video';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private createExercise(
    exerciseId: string,
    formValue: any,
    videoOverride?: VideoSource
  ): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = exerciseId;

    const exerciseData = this.buildExercisePayload(formValue, exerciseId, videoOverride);

    this.api.createExercise(exerciseData).subscribe({
      next: (response) => {
        this.saving = false;
        if (response) {
          const shouldPollForThumbnail = !!(this.selectedVideoFile && exerciseData.video?.type === 'S3' && !exerciseData.video.thumbnailUrl);
          this.exerciseSaved.emit({
            response,
            exerciseId: exerciseData.id,
            shouldPollForThumbnail
          });
          this.dialogRef.close({
            saved: true,
            exerciseId: exerciseData.id,
            shouldPollForThumbnail
          });
        } else {
          this.snackBar.open('Error al crear el ejercicio.', 'Cerrar', { duration: 4000 });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error creando ejercicio:', err);
        this.saving = false;
        this.snackBar.open('Error al crear el ejercicio.', 'Cerrar', { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
  }

  private uploadVideoAndUpdateExisting(formValue: any): void {
    const exerciseId = this.getExerciseId(this.exercise);
    const file = this.selectedVideoFile;
    if (!exerciseId || !file) {
      this.persistExistingExercise(formValue);
      return;
    }

    this.exerciseId = exerciseId;
    this.saving = true;
    this.videoState.uploading = true;
    this.cdr.markForCheck();

    this.api.getUploadUrl(`${exerciseId}.mp4`, file.type || 'video/mp4').subscribe({
      next: async (response: any) => {
        if (!response?.uploadUrl) {
          this.handleUploadFailure('Error obteniendo URL de subida');
          return;
        }

        try {
          const uploadResponse = await fetch(response.uploadUrl, {
            method: 'PUT',
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }

          this.videoState.uploading = false;
          this.videoState.s3Key = response.s3_key || this.exercise?.s3_key || null;

          if (response.preview_url) {
            this.videoState.previewUrl = response.preview_url || null;
            this.videoState.thumbnailUrl = response.thumbnail_url || null;
            this.persistExistingExercise(formValue, this.buildS3VideoPayload(response.preview_url, response.thumbnail_url, formValue.youtubeUrl), response.s3_key || null);
            return;
          }

          this.videoState.processing = true;
          this.cdr.markForCheck();
          this.pollAndUpdateExisting(response.s3_key, formValue);
        } catch (err) {
          console.error('Error subiendo video en edición:', err);
          this.handleUploadFailure('Error al subir el video');
        }
      },
      error: (err) => {
        console.error('Error obteniendo URL de subida para edición:', err);
        this.handleUploadFailure('Error obteniendo URL de subida');
      }
    });
  }

  private pollAndUpdateExisting(s3Key: string, formValue: any): void {
    this.stopPolling();

    this.pollingSubscription = interval(this.POLLING_INTERVAL_MS).pipe(
      switchMap(() => this.api.getVideoStatus(s3Key)),
      takeWhile(status => !status.ready, true),
      finalize(() => this.cdr.markForCheck())
    ).subscribe({
      next: (status) => {
        if (!status.ready) {
          return;
        }

        this.videoState.processing = false;
        this.videoState.ready = true;
        this.videoState.previewUrl = status.previewUrl || null;
        this.videoState.thumbnailUrl = status.thumbnailUrl || null;
        this.persistExistingExercise(formValue, this.buildS3VideoPayload(status.previewUrl, status.thumbnailUrl, formValue.youtubeUrl), s3Key);
      },
      error: (err) => {
        console.error('Polling error en edición:', err);
        this.videoState.processing = false;
        this.uploadError = 'Error verificando estado del video';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private persistExistingExercise(
    formValue: any,
    videoOverride?: VideoSource,
    uploadedS3Key?: string | null
  ): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = this.getExerciseId(this.exercise) || this.exerciseId;

    const updatedExercise = this.buildExercisePayload(formValue, this.exerciseId!, videoOverride);

    if (updatedExercise.video?.type === 'S3' && (uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key)) {
      (updatedExercise as any).s3_key = uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key;
    }

    this.getUpdateRequest(updatedExercise as Exercise).subscribe({
      next: (response) => {
        this.saving = false;
        this.videoState.uploading = false;
        this.videoState.processing = false;

        if (!this.wasSaveSuccessful(response)) {
          this.snackBar.open('Error al guardar el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
          this.cdr.markForCheck();
          return;
        }

        const shouldPollForThumbnail = !!(
          updatedExercise.video?.type === 'S3' &&
          (uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key) &&
          !getThumbnailSource(updatedExercise as Exercise)
        );

        this.exerciseSaved.emit({
          response,
          exerciseId: this.exerciseId,
          shouldPollForThumbnail
        });
        this.dialogRef.close({
          saved: true,
          exerciseId: this.exerciseId,
          shouldPollForThumbnail
        });
      },
      error: (err) => {
        console.error('Error actualizando ejercicio:', err);
        this.saving = false;
        this.videoState.uploading = false;
        this.videoState.processing = false;
        this.snackBar.open('Error al guardar el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
  }

  private getUpdateRequest(updatedExercise: Exercise): Observable<any> {
    return this.api.updateExercise(updatedExercise);
  }

  private wasSaveSuccessful(response: any): boolean {
    return !!response;
  }

  private clearS3Selection(markForCheck = true): void {
    this.selectedVideoFile = null;
    this.selectedVideoFileName = null;
    this.revokeSelectedVideoPreviewUrl();
    this.editForm?.patchValue({ videoFileSelected: false }, { emitEvent: false });
    this.editForm?.get('videoFileSelected')?.updateValueAndValidity({ emitEvent: false });
    if (markForCheck) {
      this.cdr.markForCheck();
    }
  }

  private revokeSelectedVideoPreviewUrl(): void {
    if (this.selectedVideoPreviewUrl) {
      URL.revokeObjectURL(this.selectedVideoPreviewUrl);
      this.selectedVideoPreviewUrl = null;
    }
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private handleUploadFailure(message: string): void {
    this.uploadError = message;
    this.saving = false;
    this.videoState.uploading = false;
    this.videoState.processing = false;
    this.cdr.markForCheck();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name_es: ['', Validators.required],
      category: ['', Validators.required],
      equipment_type: ['', Validators.required],
      difficulty: ['', Validators.required],
      muscle_group: ['', Validators.required],
      exercise_type: ['', Validators.required],
      description_es: [''],
      description_en: [''],
      training_goal: [''],
      tips: [''],
      common_mistakes: [''],
      plane_of_motion: [''],
      movement_pattern: [''],
      secondary_muscles: [''],
      equipment_specific: [''],
      aliases: [''],
      videoMode: ['NONE' as VideoMode],
      youtubeUrl: [''],
      videoFileSelected: [false]
    });
  }

  private requiredYoutubeUrlValidator(control: AbstractControl): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
      return { required: true };
    }

    return buildYoutubeEmbedUrl(value) ? null : { youtubeUrl: true };
  }

  private handleVideoModeChange(mode: VideoMode): void {
    const youtubeControl = this.editForm.get('youtubeUrl');
    const videoFileControl = this.editForm.get('videoFileSelected');
    this.uploadError = '';

    if (mode === 'YOUTUBE') {
      this.clearS3Selection(false);
      if (!this.cleanOptionalString(youtubeControl?.value)) {
        youtubeControl?.patchValue(getYoutubeUrl(this.exercise) || '', { emitEvent: false });
      }
      youtubeControl?.setValidators([this.requiredYoutubeUrlValidator]);
      videoFileControl?.clearValidators();
    } else if (mode === 'S3') {
      youtubeControl?.patchValue('', { emitEvent: false });
      youtubeControl?.clearValidators();
      if (this.getExistingS3PreviewUrl()) {
        videoFileControl?.clearValidators();
      } else {
        videoFileControl?.setValidators([Validators.requiredTrue]);
      }
    } else {
      youtubeControl?.patchValue('', { emitEvent: false });
      youtubeControl?.clearValidators();
      videoFileControl?.clearValidators();
      this.clearS3Selection(false);
    }

    youtubeControl?.updateValueAndValidity({ emitEvent: false });
    videoFileControl?.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  private resolveInitialVideoMode(exercise: Exercise | null): VideoMode {
    if (getS3PreviewUrl(exercise)) {
      return 'S3';
    }

    if (getYoutubeUrl(exercise)) {
      return 'YOUTUBE';
    }

    return 'NONE';
  }

  private patchExerciseIntoForm(exercise: Exercise | null): void {
    if (!exercise) {
      return;
    }

    const youtubeUrl = getYoutubeUrl(exercise) || '';
    const videoMode = this.resolveInitialVideoMode(exercise);
    this.uploadError = '';
    this.stopPolling();
    this.videoState.uploading = false;
    this.videoState.processing = false;
    this.videoState.ready = false;
    this.clearS3Selection(false);
    this.videoState.previewUrl = getS3PreviewUrl(exercise);
    this.videoState.thumbnailUrl = getThumbnailSource(exercise);
    this.videoState.s3Key = exercise.s3_key || null;

    this.editForm.patchValue({
      name_es: exercise.name_es || exercise.name || '',
      category: exercise.category || '',
      difficulty: exercise.difficulty || '',
      equipment_type: exercise.equipment_type || '',
      muscle_group: exercise.muscle_group || '',
      exercise_type: exercise.exercise_type || '',
      description_es: exercise.description_es || '',
      description_en: exercise.description_en || '',
      training_goal: exercise.training_goal || '',
      tips: this.joinMultiline(exercise.tips || []),
      common_mistakes: this.joinMultiline(exercise.common_mistakes || []),
      plane_of_motion: exercise.plane_of_motion || '',
      movement_pattern: exercise.movement_pattern || '',
      secondary_muscles: this.joinMultiline(exercise.secondary_muscles || []),
      equipment_specific: this.joinMultiline(exercise.equipment_specific || []),
      aliases: this.joinMultiline(exercise.aliases || []),
      videoMode,
      youtubeUrl
    }, { emitEvent: false });

    this.handleVideoModeChange(videoMode);

    this.cdr.markForCheck();
  }

  private joinMultiline(values?: string[] | string | null): string {
    if (Array.isArray(values)) {
      return values.join('\n');
    }

    return typeof values === 'string' ? values : '';
  }

  private cleanArray(values: Array<string | null | undefined>): string[] | undefined {
    const cleaned = values
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(Boolean);

    return cleaned.length ? cleaned : undefined;
  }

  private cleanOptionalString(value: string | null | undefined): string | undefined {
    const cleaned = typeof value === 'string' ? value.trim() : '';
    return cleaned ? cleaned : undefined;
  }

  private parseMultilineToOptionalArray(value: string | null | undefined): string[] | undefined {
    return this.cleanArray((value || '').split('\n'));
  }

  private buildYoutubeVideoPayload(youtubeUrl: string | null | undefined): VideoSource | undefined {
    const resolvedYoutubeUrl = this.cleanOptionalString(youtubeUrl);
    if (!resolvedYoutubeUrl) {
      return undefined;
    }

    return {
      type: 'YOUTUBE',
      youtubeUrl: resolvedYoutubeUrl,
      url: resolvedYoutubeUrl
    };
  }

  private buildS3VideoPayload(
    previewUrl: string | null | undefined,
    thumbnailUrl: string | null | undefined,
    youtubeUrl?: string | null
  ): VideoSource | undefined {
    const resolvedPreviewUrl = this.cleanOptionalString(previewUrl);
    const resolvedThumbnailUrl = this.cleanOptionalString(thumbnailUrl);

    if (!resolvedPreviewUrl) {
      return undefined;
    }

    const payload: VideoSource = {
      type: 'S3',
      previewUrl: resolvedPreviewUrl,
      thumbnailUrl: resolvedThumbnailUrl
    };

    const resolvedYoutubeUrl = this.cleanOptionalString(youtubeUrl);
    if (resolvedYoutubeUrl) {
      payload.youtubeUrl = resolvedYoutubeUrl;
    }

    return payload;
  }

  private buildVideoPayload(formValue: any, videoOverride?: VideoSource): VideoSource | undefined {
    if (videoOverride) {
      return videoOverride;
    }

    if (formValue.videoMode === 'YOUTUBE') {
      const youtubeUrl = this.cleanOptionalString(formValue.youtubeUrl);
      if (!this.isCreationMode && youtubeUrl && youtubeUrl === getYoutubeUrl(this.exercise) && this.exercise?.video) {
        return this.exercise.video;
      }

      return this.buildYoutubeVideoPayload(formValue.youtubeUrl);
    }

    if (formValue.videoMode === 'S3') {
      if (!this.isCreationMode && getS3PreviewUrl(this.exercise)) {
        return this.exercise?.video
          || this.buildS3VideoPayload(getS3PreviewUrl(this.exercise), getThumbnailSource(this.exercise), getYoutubeUrl(this.exercise));
      }

      return undefined;
    }

    if (!this.isCreationMode) {
      return this.exercise?.video
        || this.buildS3VideoPayload(getS3PreviewUrl(this.exercise), getThumbnailSource(this.exercise), getYoutubeUrl(this.exercise))
        || this.buildYoutubeVideoPayload(getYoutubeUrl(this.exercise));
    }

    return undefined;
  }

  private buildExercisePayload(
    formValue: any,
    exerciseId: string,
    videoOverride?: VideoSource
  ): any {
    const nameEs = this.cleanOptionalString(formValue.name_es) || '';
    const payload: Record<string, any> = {
      ...(this.isCreationMode ? {} : this.exercise),
      id: exerciseId,
      name_es: nameEs,
      name_en: this.cleanOptionalString((this.exercise as any)?.name_en) || nameEs,
      category: this.cleanOptionalString(formValue.category) || '',
      difficulty: this.cleanOptionalString(formValue.difficulty) || '',
      equipment_type: this.cleanOptionalString(formValue.equipment_type) || '',
      muscle_group: this.cleanOptionalString(formValue.muscle_group) || '',
      exercise_type: this.cleanOptionalString(formValue.exercise_type) || '',
      description_es: this.cleanOptionalString(formValue.description_es),
      description_en: this.cleanOptionalString(formValue.description_en),
      training_goal: this.cleanOptionalString(formValue.training_goal),
      tips: this.parseMultilineToOptionalArray(formValue.tips),
      common_mistakes: this.parseMultilineToOptionalArray(formValue.common_mistakes),
      plane_of_motion: this.cleanOptionalString(formValue.plane_of_motion),
      movement_pattern: this.cleanOptionalString(formValue.movement_pattern),
      secondary_muscles: this.parseMultilineToOptionalArray(formValue.secondary_muscles),
      equipment_specific: this.parseMultilineToOptionalArray(formValue.equipment_specific),
      aliases: this.parseMultilineToOptionalArray(formValue.aliases)
    };

    const video = this.buildVideoPayload(formValue, videoOverride);
    if (video) {
      payload['video'] = video;
    } else if (!this.isCreationMode && Object.prototype.hasOwnProperty.call(payload, 'video')) {
      delete payload['video'];
    }

    return this.buildCleanExercisePayload(payload);
  }

  private buildCleanExercisePayload<T extends Record<string, any>>(exerciseData: T): T {
    const payload: Record<string, any> = { ...exerciseData };
    const optionalKeys = [
      'description_es',
      'description_en',
      'training_goal',
      'tips',
      'common_mistakes',
      'plane_of_motion',
      'movement_pattern',
      'secondary_muscles',
      'equipment_specific',
      'aliases'
    ];

    optionalKeys.forEach(key => {
      const value = payload[key];
      if (value === undefined || value === null || value === false) {
        delete payload[key];
        return;
      }

      if (typeof value === 'string' && !value.trim()) {
        delete payload[key];
        return;
      }

      if (Array.isArray(value) && value.length === 0) {
        delete payload[key];
      }
    });

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    delete payload['previewUrl'];
    delete payload['thumbnailUrl'];
    delete payload['preview_url'];
    delete payload['s3_key'];
    delete payload['videoMode'];
    delete payload['videoFileSelected'];
    delete payload['functional'];
    delete payload['youtubeUrl'];
    delete payload['youtube_url'];
    delete payload['thumbnail'];

    return payload as T;
  }
}
