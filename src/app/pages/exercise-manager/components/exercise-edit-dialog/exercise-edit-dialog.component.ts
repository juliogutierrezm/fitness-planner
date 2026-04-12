import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Inject } from '@angular/core';
import { Observable, Subscription, interval } from 'rxjs';
import { finalize, switchMap, takeWhile } from 'rxjs/operators';
import { MatRadioModule } from '@angular/material/radio';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise, FilterOptions, VideoSource } from '../../../../shared/models';
import { sanitizeName } from '../../../../shared/shared-utils';
import { buildYoutubeEmbedUrl, buildYoutubeThumbnailUrl, getS3PreviewUrl, getThumbnailSource, getYoutubeUrl } from '../../../../shared/video-utils';

export interface ExerciseEditDialogData {
  exercise: Exercise | null;
  filterOptions: FilterOptions;
}

type VideoSelectorType = 'S3' | 'YOUTUBE' | 'NONE';
type SaveMode = 'full' | 'quick';

const ALLOWED_FIELDS = [
  'name_es',
  'difficulty',
  'category',
  'equipment_type',
  'muscle_group',
  'secondary_muscles',
  'exercise_type',
  'training_goal',
  'common_mistakes',
  'tips',
  'description_es',
  'aliases'
];

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
    MatSnackBarModule,
    MatIconModule,
    MatRadioModule
  ],
  templateUrl: './exercise-edit-dialog.component.html',
  styleUrl: './exercise-edit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseEditDialogComponent implements OnDestroy {
  @Output() exerciseSaved = new EventEmitter<any>();
  @Output() dialogClosed = new EventEmitter<void>();

  editForm: FormGroup;
  isCreationMode = false;
  uploadError = '';
  saving = false;
  currentStep: 1 | 2 = 1;
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
  private videoTypeSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL_MS = 3000;
  private readonly STEP_ONE_FIELDS = ['name_es', 'category', 'difficulty', 'equipment_type', 'muscle_group'] as const;

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

    const ex = this.exercise;
    const initialVideoType = this.resolveInitialVideoType(ex);
    const initialYoutubeUrl = initialVideoType === 'YOUTUBE' ? (getYoutubeUrl(ex) || '') : '';

    this.editForm = this.fb.group({
      name_es: [ex?.name_es || ex?.name || '', Validators.required],
      name_en: [ex?.name_en || ''],
      category: [ex?.category || '', Validators.required],
      difficulty: [ex?.difficulty || '', Validators.required],
      equipment_type: [ex?.equipment_type || '', Validators.required],
      muscle_group: [ex?.muscle_group || '', Validators.required],
      videoType: [initialVideoType],
      youtubeUrl: [initialYoutubeUrl],
      exercise_type: [ex?.exercise_type || ''],
      training_goal: [ex?.training_goal || ''],
      description_es: [ex?.description_es || ''],
      description_en: [ex?.description_en || ''],
      tips: [this.joinMultiline(ex?.tips)],
      common_mistakes: [this.joinMultiline(ex?.common_mistakes)],
      secondary_muscles: [this.joinCsv(ex?.secondary_muscles)],
      aliases: [this.joinCsv(ex?.aliases)],
      plane_of_motion: [ex?.plane_of_motion || ''],
      movement_pattern: [ex?.movement_pattern || ''],
      equipment_specific: [ex?.equipment_specific || '']
    });

    this.videoTypeSubscription = this.editForm.get('videoType')?.valueChanges.subscribe((type: VideoSelectorType) => {
      this.handleVideoTypeChange(type);
    }) || null;
  }

  get selectedVideoType(): VideoSelectorType {
    return (this.editForm.get('videoType')?.value || 'NONE') as VideoSelectorType;
  }

  get isVideoValid(): boolean {
    if (this.selectedVideoType === 'NONE') {
      return true;
    }

    if (this.selectedVideoType === 'YOUTUBE') {
      return Boolean(buildYoutubeEmbedUrl(this.editForm.get('youtubeUrl')?.value));
    }

    return Boolean(this.selectedVideoFile || this.getExistingS3PreviewUrl() || this.videoState.previewUrl);
  }

  get isStepOneValid(): boolean {
    return this.STEP_ONE_FIELDS.every(field => this.editForm.get(field)?.valid) && this.isVideoValid;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.videoTypeSubscription?.unsubscribe();
    this.revokeSelectedVideoPreviewUrl();
  }

  onFileSelected(event: Event): void {
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

    if (this.selectedVideoType !== 'S3') {
      this.editForm.patchValue({ videoType: 'S3' });
    }

    this.uploadError = '';
    this.clearS3Selection(false);
    this.selectedVideoFile = file;
    this.selectedVideoFileName = file.name;
    this.selectedVideoPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  onQuickSave(): void {
    if (!this.isStepOneValid || this.saving) {
      this.markStepOneTouched();
      return;
    }

    this.saveExercise('quick');
  }

  onSave(): void {
    if (!this.isStepOneValid || this.saving) {
      this.markStepOneTouched();
      return;
    }

    this.saveExercise('full');
  }

  onClose(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }

  goToStep(step: 1 | 2): void {
    if (step === 2 && !this.isStepOneValid) {
      this.markStepOneTouched();
      return;
    }

    this.currentStep = step;
    this.cdr.markForCheck();
  }

  goToOptionalStep(): void {
    this.goToStep(2);
  }

  getYoutubePreviewUrl(): SafeResourceUrl | null {
    if (this.selectedVideoType !== 'YOUTUBE') {
      return null;
    }

    const embedUrl = buildYoutubeEmbedUrl(this.editForm.get('youtubeUrl')?.value);
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  getExistingS3PreviewUrl(): string | null {
    if (this.selectedVideoType !== 'S3') {
      return null;
    }

    return this.videoState.previewUrl || getS3PreviewUrl(this.exercise);
  }

  isFieldEditable(field: string): boolean {
    return ALLOWED_FIELDS.includes(field);
  }

  private saveExercise(saveMode: SaveMode): void {
    const formValue = this.editForm.getRawValue();
    this.exerciseId = this.isCreationMode
      ? `${sanitizeName((formValue.name_es?.trim() || formValue.name_en?.trim() || ''))}_${Date.now()}`
      : this.exercise?.id || null;

    if (this.selectedVideoType === 'S3' && this.selectedVideoFile) {
      if (this.isCreationMode) {
        this.uploadVideoAndCreate(this.exerciseId!, formValue, saveMode);
        return;
      }

      this.uploadVideoAndUpdateExisting(formValue, saveMode);
      return;
    }

    if (this.isCreationMode) {
      this.createExercise(this.exerciseId!, formValue, saveMode);
      return;
    }

    this.persistExistingExercise(formValue, saveMode);
  }

  private uploadVideoAndCreate(exerciseId: string, formValue: any, saveMode: SaveMode): void {
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
            this.createExercise(exerciseId, formValue, saveMode, this.buildS3VideoPayload(response.preview_url, response.thumbnail_url));
            return;
          }

          this.videoState.processing = true;
          this.cdr.markForCheck();
          this.pollAndCreate(response.s3_key, exerciseId, formValue, saveMode);
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

  private pollAndCreate(s3Key: string, exerciseId: string, formValue: any, saveMode: SaveMode): void {
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
        this.createExercise(exerciseId, formValue, saveMode, this.buildS3VideoPayload(status.previewUrl, status.thumbnailUrl));
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
    saveMode: SaveMode,
    videoOverride?: VideoSource | null
  ): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = exerciseId;

    const exerciseData = this.buildExercisePayload(formValue, saveMode, exerciseId, videoOverride);

    this.api.createExercise(exerciseData).subscribe({
      next: (response) => {
        this.saving = false;
        if (response) {
          const shouldPollForThumbnail = !!(this.selectedVideoType === 'S3' && this.selectedVideoFile && exerciseData.video?.type === 'S3' && !exerciseData.video.thumbnailUrl);
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

  private uploadVideoAndUpdateExisting(formValue: any, saveMode: SaveMode): void {
    const exerciseId = this.exercise?.id;
    const file = this.selectedVideoFile;
    if (!exerciseId || !file) {
      this.persistExistingExercise(formValue, saveMode);
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
            this.persistExistingExercise(formValue, saveMode, this.buildS3VideoPayload(response.preview_url, response.thumbnail_url), response.s3_key || null);
            return;
          }

          this.videoState.processing = true;
          this.cdr.markForCheck();
          this.pollAndUpdateExisting(response.s3_key, formValue, saveMode);
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

  private pollAndUpdateExisting(s3Key: string, formValue: any, saveMode: SaveMode): void {
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
        this.persistExistingExercise(formValue, saveMode, this.buildS3VideoPayload(status.previewUrl, status.thumbnailUrl), s3Key);
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
    saveMode: SaveMode,
    videoOverride?: VideoSource | null,
    uploadedS3Key?: string | null
  ): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = this.exercise?.id || this.exerciseId;

    const updatedExercise = this.buildExercisePayload(formValue, saveMode, this.exerciseId!, videoOverride);

    if (updatedExercise.video?.type === 'S3' && (uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key)) {
      (updatedExercise as any).s3_key = uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key;
    }

    this.getUpdateRequest(updatedExercise as Exercise).subscribe({
      next: (response) => {
        this.saving = false;
        this.videoState.uploading = false;
        this.videoState.processing = false;
        if (this.wasSaveSuccessful(response)) {
          const shouldPollForThumbnail = !!(updatedExercise.video?.type === 'S3' && this.selectedVideoFile && !updatedExercise.video.thumbnailUrl);
          this.exerciseSaved.emit({
            response,
            exerciseId: updatedExercise.id,
            shouldPollForThumbnail
          });
          this.dialogRef.close({
            saved: true,
            exerciseId: updatedExercise.id,
            shouldPollForThumbnail
          });
        } else {
          this.snackBar.open('Error al guardar el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
        }
        this.cdr.markForCheck();
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
    if (this.canSaveAsCustom(this.exercise)) {
      return this.api.updateExercise(updatedExercise);
    }

    return this.api.updateExerciseLibraryItem(this.exercise!.id, updatedExercise);
  }

  private canSaveAsCustom(exercise: Exercise | null): boolean {
    return (exercise as any)?.source === 'CUSTOM';
  }

  private wasSaveSuccessful(response: any): boolean {
    if (this.canSaveAsCustom(this.exercise)) {
      return !!response;
    }

    return !!response?.ok;
  }

  private resolveInitialVideoType(exercise: Exercise | null): VideoSelectorType {
    if (getS3PreviewUrl(exercise)) {
      return 'S3';
    }

    if (getYoutubeUrl(exercise)) {
      return 'YOUTUBE';
    }

    return 'NONE';
  }

  private handleVideoTypeChange(type: VideoSelectorType): void {
    this.uploadError = '';
    this.stopPolling();
    this.videoState.uploading = false;
    this.videoState.processing = false;
    this.videoState.ready = false;

    if (type === 'NONE') {
      this.clearS3Selection();
      this.clearS3State();
      this.editForm.patchValue({ youtubeUrl: '' }, { emitEvent: false });
      this.cdr.markForCheck();
      return;
    }

    if (type === 'YOUTUBE') {
      this.clearS3Selection();
      this.clearS3State();
      this.cdr.markForCheck();
      return;
    }

    this.editForm.patchValue({ youtubeUrl: '' }, { emitEvent: false });
    this.cdr.markForCheck();
  }

  private clearS3Selection(markForCheck = true): void {
    this.selectedVideoFile = null;
    this.selectedVideoFileName = null;
    this.revokeSelectedVideoPreviewUrl();
    if (markForCheck) {
      this.cdr.markForCheck();
    }
  }

  private clearS3State(): void {
    this.videoState.previewUrl = null;
    this.videoState.thumbnailUrl = null;
    this.videoState.s3Key = null;
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

  private markStepOneTouched(): void {
    this.STEP_ONE_FIELDS.forEach(field => this.editForm.get(field)?.markAsTouched());
  }

  private joinMultiline(values?: string[] | string | null): string {
    if (Array.isArray(values)) {
      return values.join('\n');
    }

    return typeof values === 'string' ? values : '';
  }

  private joinCsv(values?: string[] | string | null): string {
    if (Array.isArray(values)) {
      return values.join(', ');
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

  private parseCsvToOptionalArray(value: string | null | undefined): string[] | undefined {
    return this.cleanArray((value || '').split(','));
  }

  private buildYoutubeVideoPayload(youtubeUrl: string | null | undefined): VideoSource | null {
    const resolvedYoutubeUrl = this.cleanOptionalString(youtubeUrl);
    if (!resolvedYoutubeUrl) {
      return null;
    }

    return {
      type: 'YOUTUBE',
      youtubeUrl: resolvedYoutubeUrl,
      thumbnailUrl: buildYoutubeThumbnailUrl(resolvedYoutubeUrl) || undefined
    };
  }

  private buildS3VideoPayload(previewUrl: string | null | undefined, thumbnailUrl: string | null | undefined): VideoSource | null {
    const resolvedPreviewUrl = this.cleanOptionalString(previewUrl);
    const resolvedThumbnailUrl = this.cleanOptionalString(thumbnailUrl);

    if (!resolvedPreviewUrl) {
      return null;
    }

    return {
      type: 'S3',
      previewUrl: resolvedPreviewUrl,
      thumbnailUrl: resolvedThumbnailUrl
    };
  }

  private buildVideoPayloadFromSelection(): VideoSource | null {
    if (this.selectedVideoType === 'NONE') {
      return null;
    }

    if (this.selectedVideoType === 'YOUTUBE') {
      return this.buildYoutubeVideoPayload(this.editForm.get('youtubeUrl')?.value);
    }

    return this.buildS3VideoPayload(
      this.videoState.previewUrl || getS3PreviewUrl(this.exercise),
      this.videoState.thumbnailUrl || getThumbnailSource(this.exercise)
    );
  }

  private buildExercisePayload(
    formValue: any,
    saveMode: SaveMode,
    exerciseId: string,
    videoOverride?: VideoSource | null
  ): any {
    const nameEs = this.cleanOptionalString(formValue.name_es) || '';
    const requiredPayload: Record<string, any> = {
      id: exerciseId,
      name_es: nameEs,
      name_en: this.cleanOptionalString(formValue.name_en) || nameEs,
      category: this.cleanOptionalString(formValue.category) || '',
      difficulty: this.cleanOptionalString(formValue.difficulty) || '',
      equipment_type: this.cleanOptionalString(formValue.equipment_type) || '',
      muscle_group: this.cleanOptionalString(formValue.muscle_group) || '',
      video: videoOverride !== undefined ? videoOverride : this.buildVideoPayloadFromSelection()
    };

    const optionalPayload = saveMode === 'full'
      ? {
          description_es: this.cleanOptionalString(formValue.description_es),
          description_en: this.cleanOptionalString(formValue.description_en),
          exercise_type: this.cleanOptionalString(formValue.exercise_type),
          training_goal: this.cleanOptionalString(formValue.training_goal),
          plane_of_motion: this.cleanOptionalString(formValue.plane_of_motion),
          movement_pattern: this.cleanOptionalString(formValue.movement_pattern),
          equipment_specific: this.cleanOptionalString(formValue.equipment_specific),
          aliases: this.parseCsvToOptionalArray(formValue.aliases),
          tips: this.parseMultilineToOptionalArray(formValue.tips),
          common_mistakes: this.parseMultilineToOptionalArray(formValue.common_mistakes),
          secondary_muscles: this.parseCsvToOptionalArray(formValue.secondary_muscles)
        }
      : {};

    const basePayload = this.isCreationMode
      ? requiredPayload
      : { ...this.exercise, ...requiredPayload };

    const payload = {
      ...basePayload,
      ...optionalPayload
    };

    return this.buildCleanExercisePayload(payload);
  }

  private buildCleanExercisePayload<T extends Record<string, any>>(exerciseData: T): T {
    const payload: Record<string, any> = { ...exerciseData };
    const optionalKeys = [
      'description_es',
      'description_en',
      'exercise_type',
      'training_goal',
      'plane_of_motion',
      'movement_pattern',
      'equipment_specific',
      'aliases',
      'tips',
      'common_mistakes',
      'secondary_muscles'
    ];

    optionalKeys.forEach(key => {
      const value = payload[key];
      if (value === undefined || value === null) {
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
    delete payload['videoType'];
    delete payload['videoUrl'];
    delete payload['youtubeUrl'];
    delete payload['youtube_url'];
    delete payload['thumbnail'];
    delete payload['functional'];

    return payload as T;
  }
}
