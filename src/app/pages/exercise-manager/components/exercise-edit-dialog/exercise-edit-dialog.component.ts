import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Inject } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile, finalize } from 'rxjs/operators';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise, VideoSource } from '../../../../shared/models';
import { sanitizeName } from '../../../../shared/shared-utils';
import { AuthService } from '../../../../services/auth.service';

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
    MatSnackBarModule
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

  // Video state management
  videoState = {
    uploading: false,
    processing: false,
    ready: false,
    previewUrl: null as string | null,
    thumbnailUrl: null as string | null,
    s3Key: null as string | null
  };

  private pollingSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL_MS = 3000;
  private currentExerciseId: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Exercise | null,
    private dialogRef: MatDialogRef<ExerciseEditDialogComponent>,
    private fb: FormBuilder,
    private api: ExerciseApiService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.isCreationMode = !data;

    this.editForm = this.fb.group({
      // General Tab
      name: [data?.name || ''],
      name_es: [data?.name_es || data?.name || '', Validators.required],
      name_en: [data?.name_en || ''],
      category: [data?.category || '', Validators.required],
      exercise_type: [data?.exercise_type || data?.category || ''],  // Optional
      difficulty: [data?.difficulty || ''],
      training_goal: [data?.training_goal || ''],
      description_es: [data?.description_es || ''],
      description_en: [data?.description_en || ''],

      // Technique Tab
      tips: [Array.isArray(data?.tips) ? data.tips.join('\n') : data?.tips || ''],
      common_mistakes: [Array.isArray(data?.common_mistakes) ? data.common_mistakes.join('\n') : data?.common_mistakes || ''],
      plane_of_motion: [data?.plane_of_motion || ''],
      movement_pattern: [data?.movement_pattern || ''],
      secondary_muscles: [Array.isArray(data?.secondary_muscles) ? data.secondary_muscles.join(', ') : data?.secondary_muscles || ''],

      // Equipment Tab
      equipment: [data?.equipment || ''],
      equipment_type: [data?.equipment_type || data?.equipment || '', Validators.required],
      equipment_specific: [data?.equipment_specific || ''],
      muscle_group: [data?.muscle_group || data?.muscle || '', Validators.required],
      functional: [data?.functional || ''],
      aliases: [Array.isArray(data?.aliases) ? data.aliases.join(', ') : data?.aliases || ''],
      preview_url: [data?.preview_url || ''],
      s3_key: [data?.s3_key || ''],

      // Video type selection (creation only)
      videoType: ['upload'],
      videoUrl: ['']
    });
  }

  get isVideoValid(): boolean {
    if (!this.isCreationMode) return true;
    const videoType = this.editForm.get('videoType')?.value;
    if (videoType === 'upload') {
      // Block if uploading, processing, or not ready
      return this.videoState.ready && !!this.videoState.previewUrl;
    }
    if (videoType === 'url') {
      return !!this.editForm.get('videoUrl')?.value?.trim();
    }
    return true;
  }

  get isUploading(): boolean {
    return this.videoState.uploading;
  }

  get isProcessing(): boolean {
    return this.videoState.processing;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private startVideoStatusPolling(s3Key: string): void {
    this.stopPolling();
    
    this.pollingSubscription = interval(this.POLLING_INTERVAL_MS).pipe(
      switchMap(() => this.api.getVideoStatus(s3Key)),
      takeWhile(status => !status.ready, true),
      finalize(() => {
        console.log('📹 Polling stopped');
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (status) => {
        if (status.ready) {
          this.videoState.processing = false;
          this.videoState.ready = true;
          this.videoState.previewUrl = status.previewUrl || null;
          this.videoState.thumbnailUrl = status.thumbnailUrl || null;
          console.log('✅ Video ready:', status);
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('❌ Polling error:', err);
        this.videoState.processing = false;
        this.uploadError = 'Error verificando estado del video';
        this.cdr.markForCheck();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file type
    if (!file.type.startsWith('video/')) {
      this.uploadError = 'Solo se permiten archivos de video';
      return;
    }

    // Validate file size (50MB limit for videos)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      this.uploadError = 'El archivo no puede superar los 50MB';
      return;
    }

    this.uploadError = '';
    this.videoState = {
      uploading: true,
      processing: false,
      ready: false,
      previewUrl: null,
      thumbnailUrl: null,
      s3Key: null
    };
    this.cdr.markForCheck();

    const exerciseId = `${sanitizeName(this.editForm.get('name_es')?.value || this.editForm.get('name')?.value)}_${Date.now()}`;
    this.currentExerciseId = exerciseId;
    const fileName = `${exerciseId}.mp4`;

    // Get presigned URL
    this.api.getUploadUrl(fileName, file.type).subscribe({
      next: async (response: any) => {
        if (response?.uploadUrl) {
          try {
            // CRITICAL FIX: Upload to S3 using fetch WITHOUT headers
            // Presigned URLs fail with 403 if extra headers are sent
            const uploadResponse = await fetch(response.uploadUrl, {
              method: 'PUT',
              body: file
            });

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed: ${uploadResponse.status}`);
            }

            // Upload complete - start processing phase
            console.log('✅ Video uploaded to S3, starting processing...');
            this.videoState.uploading = false;
            this.videoState.processing = true;
            this.videoState.s3Key = response.s3_key;

            // If backend returns preview URLs immediately, use them
            if (response.preview_url) {
              this.videoState.previewUrl = response.preview_url;
              this.videoState.thumbnailUrl = response.thumbnail_url || null;
              this.videoState.processing = false;
              this.videoState.ready = true;
            } else {
              // Start polling for video processing completion
              this.startVideoStatusPolling(response.s3_key);
            }

            this.cdr.markForCheck();
          } catch (err) {
            console.error('❌ Error subiendo video:', err);
            this.uploadError = 'Error al subir el video';
            this.videoState.uploading = false;
            this.cdr.markForCheck();
          }
        } else {
          this.uploadError = 'Error obteniendo URL de subida';
          this.videoState.uploading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('❌ Error obteniendo URL de subida:', err);
        this.uploadError = 'Error obteniendo URL de subida';
        this.videoState.uploading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSave(): void {
    if (this.editForm.valid) {
      const formValue = this.editForm.value;

      if (this.isCreationMode) {
        const exerciseId = this.currentExerciseId || `${sanitizeName(this.editForm.get('name_es')?.value || this.editForm.get('name')?.value)}_${Date.now()}`;
        this.currentExerciseId = exerciseId;

        // Build video object based on videoType
        let video: VideoSource | undefined;
        const videoType = this.editForm.get('videoType')?.value;

        if (videoType === 'upload' && this.videoState.ready && this.videoState.previewUrl) {
          video = {
            type: 'S3',
            previewUrl: this.videoState.previewUrl,
            thumbnailUrl: this.videoState.thumbnailUrl || undefined
          };
        } else if (videoType === 'url') {
          const url = this.editForm.get('videoUrl')?.value?.trim();
          if (url) {
            video = {
              type: 'YOUTUBE',
              url
            };
          }
        }

        const exerciseData = {
          id: this.currentExerciseId,
          name_en: formValue.name || formValue.name_es,
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
        };

        this.api.createExercise(exerciseData).subscribe({
          next: (response) => {
            if (response) {
              this.exerciseSaved.emit(response);
              this.dialogRef.close(response);
            } else {
              this.snackBar.open('❌ Error al crear el ejercicio.', 'Cerrar', { duration: 4000 });
            }
          },
          error: (err) => {
            console.error('❌ Error creando ejercicio:', err);
            this.snackBar.open('❌ Error al crear el ejercicio.', 'Cerrar', { duration: 4000 });
          }
        });
      } else {
        // Edit mode - update existing exercise
        const updatedExercise: Exercise = {
          ...this.data!,
          ...formValue,
          tips: formValue.tips ? formValue.tips.split('\n').filter((t: string) => t.trim()) : [],
          common_mistakes: formValue.common_mistakes ? formValue.common_mistakes.split('\n').filter((m: string) => m.trim()) : [],
          aliases: formValue.aliases ? formValue.aliases.split(',').map((a: string) => a.trim()).filter((a: string) => a) : [],
          secondary_muscles: formValue.secondary_muscles ? formValue.secondary_muscles.split(',').map((m: string) => m.trim()).filter((m: string) => m) : []
        };

        this.api.updateExerciseLibraryItem(this.data!.id, updatedExercise).subscribe({
          next: (response: {ok: boolean, updated: Partial<Exercise>}) => {
            if (response.ok) {
              this.exerciseSaved.emit(response);
              this.dialogRef.close(response);
            } else {
              this.snackBar.open('❌ Error al guardar el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
            }
          },
          error: (err) => {
            console.error('❌ Error actualizando ejercicio:', err);
            this.snackBar.open('❌ Error al guardar el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
          }
        });
      }
    }
  }

  isFieldEditable(field: string): boolean {
    return ALLOWED_FIELDS.includes(field);
  }

  onClose(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }
}
