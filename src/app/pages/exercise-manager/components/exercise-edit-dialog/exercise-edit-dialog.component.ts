import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Inject } from '@angular/core';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise } from '../../../../shared/models';

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
    MatTabsModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './exercise-edit-dialog.component.html',
  styleUrl: './exercise-edit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseEditDialogComponent {
  @Output() exerciseSaved = new EventEmitter<any>();
  @Output() dialogClosed = new EventEmitter<void>();

  editForm: FormGroup;
  isCreationMode = false;
  isUploading = false;
  uploadedVideoUrl = '';
  uploadError = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Exercise | null,
    private dialogRef: MatDialogRef<ExerciseEditDialogComponent>,
    private fb: FormBuilder,
    private api: ExerciseApiService,
    private http: HttpClient,
    private snackBar: MatSnackBar
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
      s3_key: [data?.s3_key || '']
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

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      this.uploadError = 'El archivo no puede superar los 5MB';
      return;
    }

    this.uploadError = '';
    this.isUploading = true;

    // Get presigned URL
    this.api.getUploadUrl(file.name, file.type).subscribe({
      next: (response: any) => {
        if (response.uploadUrl) {
          // Upload to S3
          this.http.put(response.uploadUrl, file, {
            headers: {
              'Content-Type': file.type
            },
            reportProgress: true,
            observe: 'events'
          }).subscribe({
            next: (event) => {
              if (event.type === 4) { // HttpEventType.Response
                // Upload complete
                this.uploadedVideoUrl = response.preview_url;
                this.editForm.patchValue({
                  preview_url: response.preview_url,
                  s3_key: response.s3_key
                });
                this.isUploading = false;
              }
            },
            error: (err) => {
              console.error('❌ Error subiendo video:', err);
              this.uploadError = 'Error al subir el video';
              this.isUploading = false;
            }
          });
        } else {
          this.uploadError = 'Error obteniendo URL de subida';
          this.isUploading = false;
        }
      },
      error: (err) => {
        console.error('❌ Error obteniendo URL de subida:', err);
        this.uploadError = 'Error obteniendo URL de subida';
        this.isUploading = false;
      }
    });
  }

  onSave(): void {
    if (this.editForm.valid) {
      const formValue = this.editForm.value;

      if (this.isCreationMode) {
        // Convert form arrays back to arrays
        const exerciseData: Exercise = {
          ...formValue,
          tips: formValue.tips ? formValue.tips.split('\n').filter((t: string) => t.trim()) : [],
          common_mistakes: formValue.common_mistakes ? formValue.common_mistakes.split('\n').filter((m: string) => m.trim()) : [],
          aliases: formValue.aliases ? formValue.aliases.split(',').map((a: string) => a.trim()).filter((a: string) => a) : [],
          secondary_muscles: formValue.secondary_muscles ? formValue.secondary_muscles.split(',').map((m: string) => m.trim()).filter((m: string) => m) : []
        };

        this.api.createExercise(exerciseData).subscribe({
          next: (response) => {
            if (response) {
              this.exerciseSaved.emit(exerciseData);
              this.dialogRef.close(exerciseData);
            } else {
              this.snackBar.open('❌ Error al crear el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
            }
          },
          error: (err) => {
            console.error('❌ Error creando ejercicio:', err);
            this.snackBar.open('❌ Error al crear el ejercicio. Intente nuevamente.', 'Cerrar', { duration: 4000 });
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
