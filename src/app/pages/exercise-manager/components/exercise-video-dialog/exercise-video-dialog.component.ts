import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Inject } from '@angular/core';
import { Exercise } from '../../../../shared/models';
import { buildYoutubeEmbedUrl, getVideoSource } from '../../../../shared/video-utils';

@Component({
  selector: 'app-exercise-video-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule
  ],
  templateUrl: './exercise-video-dialog.component.html',
  styleUrl: './exercise-video-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseVideoDialogComponent {
  @Output() viewDetailsClicked = new EventEmitter<Exercise>();
  @Output() dialogClosed = new EventEmitter<void>();
  readonly cacheBustToken = Date.now();

  constructor(
    @Inject(MAT_DIALOG_DATA) public exercise: Exercise,
    private dialogRef: MatDialogRef<ExerciseVideoDialogComponent>,
    private sanitizer: DomSanitizer
  ) {}

  getFieldValue(exercise: Exercise, field: string): any {
    switch (field) {
      case 'name_es':
        return exercise.name_es || exercise.name;
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      default:
        return (exercise as any)[field];
    }
  }

  getVideoSource(exercise: Exercise) {
    return getVideoSource(exercise);
  }

  sanitizeYoutubeUrl(url: string): SafeResourceUrl | null {
    const embedUrl = buildYoutubeEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }

  getCacheBustedUrl(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${this.cacheBustToken}`;
  }

  onViewDetails(): void {
    this.viewDetailsClicked.emit(this.exercise);
    this.dialogRef.close();
  }

  onClose(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }
}
