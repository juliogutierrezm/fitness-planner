import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Inject } from '@angular/core';
import { Observable, interval, Subscription } from 'rxjs';
import { switchMap, takeWhile, finalize } from 'rxjs/operators';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise, FilterOptions, VideoSource } from '../../../../shared/models';
import { sanitizeName } from '../../../../shared/shared-utils';
import { buildYoutubeEmbedUrl, getS3PreviewUrl, getThumbnailSource, getVideoSource, getYoutubeUrl } from '../../../../shared/video-utils';

export interface ExerciseEditDialogData {
  exercise: Exercise | null;
  filterOptions: FilterOptions;
}

// Allowed fields for update (from Lambda)
const ALLOWED_FIELDS = [
  "name_es",
  "difficulty",
  "category",
  "equipment_type",
  "muscle_group",
  "secondary_muscles",
  "exercise_type",
  "training_goal",
  "common_mistakes",
  "tips",
  "functional",
  "description_es",
  "aliases"
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
    MatTabsModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatIconModule
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
  private exerciseId: string | null = null;

  // Dropdown options from catalog
  categoryOptions: string[];
  muscleGroupOptions: string[];
  equipmentTypeOptions: string[];
  difficultyOptions: string[];

  // Video: file held in memory until save
  selectedVideoFile: File | null = null;
  selectedVideoFileName: string | null = null;
  selectedVideoPreviewUrl: string | null = null;

  // Video state (only active during save flow)
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

    // Populate dropdown options from catalog
    this.categoryOptions = data.filterOptions.categoryOptions;
    this.muscleGroupOptions = data.filterOptions.muscleGroupOptions;
    this.equipmentTypeOptions = data.filterOptions.equipmentTypeOptions;
    this.difficultyOptions = data.filterOptions.difficultyOptions;

    const ex = this.exercise;
    const existingYoutubeUrl = ex?.video?.youtubeUrl || getYoutubeUrl(ex) || '';
    this.editForm = this.fb.group({
      // General Tab
      name_es: [ex?.name_es || ex?.name || '', Validators.required],
      name_en: [ex?.name_en || ''],
      category: [ex?.category || '', Validators.required],
      exercise_type: [ex?.exercise_type || ''],
      difficulty: [ex?.difficulty || '', Validators.required],
      training_goal: [ex?.training_goal || ''],
      description_es: [ex?.description_es || ''],
      description_en: [ex?.description_en || ''],

      // Technique Tab
      tips: [Array.isArray(ex?.tips) ? ex.tips.join('\n') : ex?.tips || ''],
      common_mistakes: [Array.isArray(ex?.common_mistakes) ? ex.common_mistakes.join('\n') : ex?.common_mistakes || ''],
      plane_of_motion: [ex?.plane_of_motion || ''],
      movement_pattern: [ex?.movement_pattern || ''],
      secondary_muscles: [Array.isArray(ex?.secondary_muscles) ? ex.secondary_muscles.join(', ') : ex?.secondary_muscles || ''],

      // Equipment Tab
      equipment_type: [ex?.equipment_type || '', Validators.required],
      equipment_specific: [ex?.equipment_specific || ''],
      muscle_group: [ex?.muscle_group || '', Validators.required],
      functional: [ex?.functional || false],
      aliases: [Array.isArray(ex?.aliases) ? ex.aliases.join(', ') : ex?.aliases || ''],

      // Video type selection (creation only)
      videoType: ['upload'],
      videoUrl: [''],

      // YouTube URL (always available for both create and edit)
      youtubeUrl: [existingYoutubeUrl]
    });
  }

  get isVideoValid(): boolean {
    if (!this.isCreationMode) return true;
    const videoType = this.editForm.get('videoType')?.value;
    if (videoType === 'upload') {
      return !!this.selectedVideoFile;
    }
    if (videoType === 'url') {
      return !!this.editForm.get('videoUrl')?.value?.trim();
    }
    return true;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.selectedVideoPreviewUrl) {
      URL.revokeObjectURL(this.selectedVideoPreviewUrl);
    }
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    console.log('📦 FILE SELECTED:', file);
    console.log('🆔 GENERATED exerciseId:', this.exerciseId);
    console.log('📛 CURRENT name_es:', this.editForm.value.name_es);
    console.log('📛 CURRENT name_en:', this.editForm.value.name_en);

    // Validate file type
    if (!file.type.startsWith('video/')) {
      this.uploadError = 'Solo se permiten archivos de video';
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      this.uploadError = 'El archivo no puede superar los 50MB';
      return;
    }

    // Store file in memory — no upload until save
    this.uploadError = '';
    this.selectedVideoFile = file;
    this.selectedVideoFileName = file.name;

    // Generate preview URL
    if (this.selectedVideoPreviewUrl) {
      URL.revokeObjectURL(this.selectedVideoPreviewUrl);
    }
    this.selectedVideoPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (!this.editForm.valid || this.saving) return;

    const formValue = this.editForm.value;
    this.exerciseId = this.isCreationMode
      ? `${sanitizeName((formValue.name_es?.trim() || formValue.name_en?.trim() || ''))}_${Date.now()}`
      : this.exercise?.id || null;
    console.log('🆔 GENERATED exerciseId:', this.exerciseId);
    console.log('📛 CURRENT name_es:', this.editForm.value.name_es);
    console.log('📛 CURRENT name_en:', this.editForm.value.name_en);

    if (this.isCreationMode) {
      this.saveNewExercise(formValue);
    } else {
      this.saveExistingExercise(formValue);
    }
  }

  private saveNewExercise(formValue: any): void {
    // Validate name before proceeding
    const nameEs = formValue.name_es?.trim();
    const nameEn = formValue.name_en?.trim();
    if (!nameEs && !nameEn) {
      this.snackBar.open('El nombre del ejercicio es obligatorio.', 'Cerrar', { duration: 4000 });
      return;
    }

    // Generate exerciseId at save time only
    const exerciseId = this.exerciseId || `${sanitizeName(nameEs || nameEn)}_${Date.now()}`;
    this.exerciseId = exerciseId;
    const videoType = this.editForm.get('videoType')?.value;

    if (videoType === 'upload' && this.selectedVideoFile) {
      this.uploadVideoAndCreate(exerciseId, formValue);
    } else if (videoType === 'url') {
      const video = this.buildVideoPayload(undefined, this.editForm.get('videoUrl')?.value, null, null);
      this.createExercise(exerciseId, formValue, video);
    } else {
      this.createExercise(exerciseId, formValue, undefined);
    }
  }

  private uploadVideoAndCreate(exerciseId: string, formValue: any): void {
    this.saving = true;
    this.videoState.uploading = true;
    this.cdr.markForCheck();

    const fileName = `${exerciseId}.mp4`;
    const file = this.selectedVideoFile!;
    console.log('⬆️ Upload request:', {
      fileName,
      exerciseId: this.exerciseId
    });

    this.api.getUploadUrl(fileName, file.type).subscribe({
      next: async (response: any) => {
        if (!response?.uploadUrl) {
          this.uploadError = 'Error obteniendo URL de subida';
          this.saving = false;
          this.videoState.uploading = false;
          this.cdr.markForCheck();
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
          this.videoState.s3Key = response.s3_key;
          console.log('✅ Upload completed:', {
            previewUrl: response.preview_url || this.videoState.previewUrl
          });

          if (response.preview_url) {
            // Backend returned URLs immediately
            const video = this.buildVideoPayload(undefined, this.editForm.get('youtubeUrl')?.value, response.preview_url, response.thumbnail_url);
            this.createExercise(exerciseId, formValue, video);
          } else {
            // Poll for processing completion, then create
            this.videoState.processing = true;
            this.cdr.markForCheck();
            this.pollAndCreate(response.s3_key, exerciseId, formValue);
          }
        } catch (err) {
          console.error('Error subiendo video:', err);
          this.uploadError = 'Error al subir el video';
          this.saving = false;
          this.videoState.uploading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error obteniendo URL de subida:', err);
        this.uploadError = 'Error obteniendo URL de subida';
        this.saving = false;
        this.videoState.uploading = false;
        this.cdr.markForCheck();
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
        if (status.ready) {
          this.videoState.processing = false;
          this.videoState.ready = true;
          this.videoState.previewUrl = status.previewUrl || null;
          this.videoState.thumbnailUrl = status.thumbnailUrl || null;
          console.log('✅ Upload completed:', {
            previewUrl: this.videoState.previewUrl
          });
          this.cdr.markForCheck();

          const video = this.buildVideoPayload(undefined, this.editForm.get('youtubeUrl')?.value, status.previewUrl, status.thumbnailUrl);
          this.createExercise(exerciseId, formValue, video);
        }
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

  private createExercise(exerciseId: string, formValue: any, video: VideoSource | undefined): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = exerciseId;

    const exerciseData = this.buildCleanExercisePayload({
      id: exerciseId,
      name_en: formValue.name_en || formValue.name_es,
      name_es: formValue.name_es,
      equipment_type: formValue.equipment_type,
      muscle_group: formValue.muscle_group,
      category: formValue.category,
      description_en: formValue.description_en,
      description_es: formValue.description_es,
      exercise_type: formValue.exercise_type,
      difficulty: formValue.difficulty,
      movement_pattern: formValue.movement_pattern,
      training_goal: formValue.training_goal,
      functional: !!formValue.functional,
      tips: formValue.tips ? formValue.tips.split('\n').filter((t: string) => t.trim()) : [],
      common_mistakes: formValue.common_mistakes ? formValue.common_mistakes.split('\n').filter((m: string) => m.trim()) : [],
      aliases: formValue.aliases ? formValue.aliases.split(',').map((a: string) => a.trim()).filter((a: string) => a) : [],
      secondary_muscles: formValue.secondary_muscles ? formValue.secondary_muscles.split(',').map((m: string) => m.trim()).filter((m: string) => m) : [],
      video
    });
    console.log('🔍 ID consistency check:', {
      generatedId: this.exerciseId,
      payloadId: exerciseData.id
    });
    console.log('🚀 FINAL PAYLOAD:', JSON.stringify(exerciseData, null, 2));

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

  private saveExistingExercise(formValue: any): void {
    if (this.selectedVideoFile) {
      this.uploadVideoAndUpdateExisting(formValue);
      return;
    }

    this.persistExistingExercise(formValue);
  }

  private uploadVideoAndUpdateExisting(formValue: any): void {
    const exerciseId = this.exercise?.id;
    const file = this.selectedVideoFile;
    if (!exerciseId || !file) {
      this.persistExistingExercise(formValue);
      return;
    }
    this.exerciseId = exerciseId;

    this.saving = true;
    this.videoState.uploading = true;
    this.cdr.markForCheck();
    console.log('⬆️ Upload request:', {
      fileName: `${exerciseId}.mp4`,
      exerciseId: this.exerciseId
    });

    this.api.getUploadUrl(`${exerciseId}.mp4`, file.type || 'video/mp4').subscribe({
      next: async (response: any) => {
        if (!response?.uploadUrl) {
          this.uploadError = 'Error obteniendo URL de subida';
          this.saving = false;
          this.videoState.uploading = false;
          this.cdr.markForCheck();
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
          console.log('✅ Upload completed:', {
            previewUrl: response.preview_url || this.videoState.previewUrl
          });

          if (response.preview_url) {
            this.persistExistingExercise(
              formValue,
              this.buildVideoPayload(this.getExistingVideoPayload(), this.editForm.get('youtubeUrl')?.value, response.preview_url, response.thumbnail_url),
              response.s3_key || null
            );
            return;
          }

          this.videoState.processing = true;
          this.cdr.markForCheck();
          this.pollAndUpdateExisting(response.s3_key, formValue);
        } catch (err) {
          console.error('Error subiendo video en edición:', err);
          this.uploadError = 'Error al subir el video';
          this.saving = false;
          this.videoState.uploading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Error obteniendo URL de subida para edición:', err);
        this.uploadError = 'Error obteniendo URL de subida';
        this.saving = false;
        this.videoState.uploading = false;
        this.cdr.markForCheck();
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
        console.log('✅ Upload completed:', {
          previewUrl: this.videoState.previewUrl
        });
        this.persistExistingExercise(
          formValue,
          this.buildVideoPayload(this.getExistingVideoPayload(), this.editForm.get('youtubeUrl')?.value, status.previewUrl, status.thumbnailUrl),
          s3Key
        );
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
    uploadedVideo?: VideoSource,
    uploadedS3Key?: string | null
  ): void {
    this.saving = true;
    this.cdr.markForCheck();
    this.exerciseId = this.exercise?.id || this.exerciseId;

    const updatedExercise: Exercise = {
      ...this.exercise!,
      ...formValue,
      tips: formValue.tips ? formValue.tips.split('\n').filter((t: string) => t.trim()) : [],
      common_mistakes: formValue.common_mistakes ? formValue.common_mistakes.split('\n').filter((m: string) => m.trim()) : [],
      aliases: formValue.aliases ? formValue.aliases.split(',').map((a: string) => a.trim()).filter((a: string) => a) : [],
      secondary_muscles: formValue.secondary_muscles ? formValue.secondary_muscles.split(',').map((m: string) => m.trim()).filter((m: string) => m) : []
    };

    const video = uploadedVideo || this.buildVideoPayload(
      this.getExistingVideoPayload(),
      this.editForm.get('youtubeUrl')?.value,
      null,
      null
    );
    if (video) {
      updatedExercise.video = video;
    }

    // Clean form-only fields that should not leak to payload root
    delete (updatedExercise as any).youtubeUrl;
    delete (updatedExercise as any).videoType;
    delete (updatedExercise as any).videoUrl;

    if (uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key) {
      updatedExercise.s3_key = uploadedS3Key || this.videoState.s3Key || this.exercise?.s3_key;
    }
    const payloadToSave = this.canSaveAsCustom(this.exercise)
      ? this.buildCleanExercisePayload(updatedExercise)
      : updatedExercise;
    console.log('🔍 ID consistency check:', {
      generatedId: this.exerciseId,
      payloadId: payloadToSave.id
    });
    console.log('🚀 FINAL PAYLOAD:', JSON.stringify(payloadToSave, null, 2));

    this.getUpdateRequest(payloadToSave).subscribe({
      next: (response) => {
        this.saving = false;
        this.videoState.uploading = false;
        this.videoState.processing = false;
        if (this.wasSaveSuccessful(response)) {
          const shouldPollForThumbnail = !!(uploadedVideo && payloadToSave.video?.type === 'S3' && !payloadToSave.video.thumbnailUrl);
          this.exerciseSaved.emit({
            response,
            exerciseId: payloadToSave.id,
            shouldPollForThumbnail
          });
          this.dialogRef.close({
            saved: true,
            exerciseId: payloadToSave.id,
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

  getCurrentVideoSource() {
    return getVideoSource(this.getCurrentMediaContext());
  }

  getCurrentThumbnail(): string | null {
    return this.videoState.thumbnailUrl
      || getThumbnailSource(this.getCurrentMediaContext());
  }

  getCurrentYoutubeUrl(): string | null {
    return getYoutubeUrl(this.getCurrentMediaContext());
  }

  getCurrentS3PreviewUrl(): string | null {
    return this.videoState.previewUrl
      || getS3PreviewUrl(this.getCurrentMediaContext());
  }

  hasExistingVideo(): boolean {
    return Boolean(this.getCurrentVideoSource());
  }

  sanitizeYoutubeUrl(url: string): SafeResourceUrl | null {
    const embedUrl = buildYoutubeEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }

  private getCurrentMediaContext(): Exercise {
    const baseExercise = { ...(this.exercise || {}) } as Exercise;
    if (this.videoState.previewUrl || this.videoState.thumbnailUrl) {
      baseExercise.video = this.buildVideoPayload(
        this.getExistingVideoPayload(),
        this.editForm.get('youtubeUrl')?.value,
        this.videoState.previewUrl,
        this.videoState.thumbnailUrl
      );
      baseExercise.preview_url = this.videoState.previewUrl || baseExercise.preview_url;
      baseExercise.thumbnail = this.videoState.thumbnailUrl || baseExercise.thumbnail;
    }
    return baseExercise;
  }

  private getExistingVideoPayload(): VideoSource | undefined {
    const existingVideo = this.exercise?.video;
    const previewUrl = getS3PreviewUrl(this.exercise) || undefined;
    const thumbnailUrl = getThumbnailSource(this.exercise) || undefined;
    const youtubeUrl = getYoutubeUrl(this.exercise) || undefined;

    if (existingVideo) {
      return {
        ...existingVideo,
        previewUrl: existingVideo.previewUrl ?? previewUrl,
        thumbnailUrl: existingVideo.thumbnailUrl ?? thumbnailUrl,
        youtubeUrl: existingVideo.youtubeUrl ?? youtubeUrl
      };
    }

    if (!previewUrl && !thumbnailUrl && !youtubeUrl) {
      return undefined;
    }

    const type: VideoSource['type'] = previewUrl ? 'S3' : 'YOUTUBE';
    return {
      type,
      previewUrl,
      thumbnailUrl,
      youtubeUrl,
      url: type === 'YOUTUBE' ? youtubeUrl : undefined
    };
  }

  private buildVideoPayload(
    existingVideo: VideoSource | undefined,
    formYoutubeUrl: string | null | undefined,
    previewUrl: string | null | undefined,
    thumbnailUrl: string | null | undefined
  ): VideoSource | undefined {
    const resolvedPreviewUrl = previewUrl ?? existingVideo?.previewUrl;
    const resolvedThumbnailUrl = thumbnailUrl ?? existingVideo?.thumbnailUrl;
    const resolvedYoutubeUrl = formYoutubeUrl?.trim() || existingVideo?.youtubeUrl;

    if (!resolvedPreviewUrl && !resolvedThumbnailUrl && !resolvedYoutubeUrl) {
      return undefined;
    }

    return {
      type: resolvedPreviewUrl ? 'S3' : 'YOUTUBE',
      previewUrl: resolvedPreviewUrl,
      thumbnailUrl: resolvedThumbnailUrl,
      youtubeUrl: resolvedYoutubeUrl
    };
  }

  private buildCleanExercisePayload<T extends Record<string, any>>(exerciseData: T): T {
    const payload: Record<string, any> = { ...exerciseData };
    payload['video'] = this.normalizeVideoPayload(payload['video']);

    delete payload['previewUrl'];
    delete payload['thumbnailUrl'];
    delete payload['preview_url'];
    delete payload['s3_key'];
    delete payload['videoType'];
    delete payload['videoUrl'];
    delete payload['youtubeUrl'];
    delete payload['youtube_url'];
    delete payload['thumbnail'];

    return payload as T;
  }

  private normalizeVideoPayload(video: VideoSource | undefined): VideoSource | undefined {
    if (!video) {
      return undefined;
    }

    const normalizedVideo = { ...video } as VideoSource;
    if (video.previewUrl !== undefined) {
      normalizedVideo.previewUrl = video.previewUrl;
    }
    if (video.thumbnailUrl !== undefined) {
      normalizedVideo.thumbnailUrl = video.thumbnailUrl;
    }
    if (video.youtubeUrl !== undefined) {
      normalizedVideo.youtubeUrl = video.youtubeUrl;
    }
    return normalizedVideo;
  }

  isFieldEditable(field: string): boolean {
    return ALLOWED_FIELDS.includes(field);
  }

  onClose(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }
}
