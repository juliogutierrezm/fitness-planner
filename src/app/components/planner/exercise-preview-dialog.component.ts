import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Exercise } from '../../shared/models';

@Component({
  selector: 'app-exercise-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="preview-dialog-container">
      <div class="preview-header">
        <h2 mat-dialog-title>{{ data.exercise.name_es || data.exercise.name }}</h2>
        <button mat-icon-button (click)="close()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="preview-content">
        <ng-container *ngIf="data.exercise.preview_url; else noPreview">
          <video
            class="preview-video"
            [src]="data.exercise.preview_url"
            controls
            autoplay
            muted
            (error)="onVideoError($event)"
            (loadeddata)="onVideoLoaded()"
            preload="metadata">
            Tu navegador no soporta el elemento de video.
          </video>
        </ng-container>
        <ng-template #noPreview>
          <div class="no-preview-message">
            <mat-icon class="no-preview-icon">videocam_off</mat-icon>
            <h3>Sin vista previa disponible</h3>
            <p>Este ejercicio no tiene un video de preview disponible.</p>
          </div>
        </ng-template>
      </div>
      <div class="preview-actions">
        <button mat-stroked-button color="primary" (click)="close()">
          Cerrar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .preview-dialog-container {
      padding: 24px;
      max-width: 600px;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: hidden;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      width: 100%;
    }

    .preview-header h2 {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      white-space: normal;
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }

    .preview-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      margin-bottom: 16px;
      width: 100%;
    }

    .preview-video {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .no-preview-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
      border: 2px dashed rgba(0, 0, 0, 0.12);
    }

    .no-preview-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: rgba(0, 0, 0, 0.3);
      margin-bottom: 16px;
    }

    .no-preview-message h3 {
      margin: 0 0 8px 0;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
    }

    .no-preview-message p {
      margin: 0;
      color: rgba(0, 0, 0, 0.6);
    }

    .preview-actions {
      display: flex;
      justify-content: flex-end;
    }

    @media (max-width: 480px) {
      .preview-dialog-container {
        padding: 16px;
      }

      .preview-content {
        min-height: 250px;
      }
    }
  `]
})
export class ExercisePreviewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ExercisePreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { exercise: Exercise },
    private snackBar: MatSnackBar
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  onVideoError(event: Event): void {
    console.error('Error loading video:', this.data.exercise.preview_url);
    this.snackBar.open('Error al cargar el video de preview', undefined, { duration: 3000 });
  }

  onVideoLoaded(): void {
    console.log('Video preview loaded:', this.data.exercise.preview_url);
  }
}
