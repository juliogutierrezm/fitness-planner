import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { Exercise } from '../../../../shared/models';
import { ErrorMapper, DevLogger } from '../../../../shared/feedback-utils';

@Component({
  selector: 'app-exercise-detail',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './exercise-detail.component.html',
  styleUrl: './exercise-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ExerciseApiService);
  private cdr = inject(ChangeDetectorRef);

  exercise: Exercise | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.loadExercise(id);
    } else {
      this.error = 'ID de ejercicio no encontrado';
      this.loading = false;
    }
  }

  private loadExercise(id: string): void {
    const startTime = Date.now();

    // For now, since getExerciseLibrary doesn't have by ID, we can load all and find by ID
    this.api.getExerciseLibrary().pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck(); // Ensure UI updates with OnPush strategy
      })
    ).subscribe({
      next: (response) => {
        const exercise = response.items.find(ex => ex.id === id);
        if (exercise) {
          this.exercise = exercise;
          // Log operation success following DEVELOPER.md Section O
          const elapsedMs = Date.now() - startTime;
          DevLogger.logOperation('loadExerciseDetail', { exerciseId: id, elapsedMs }, true);
        } else {
          this.error = 'Ejercicio no encontrado';
        }
      },
      error: (err) => {
        DevLogger.logError('loadExerciseDetail', err);
        this.error = ErrorMapper.mapGenericError(err.message || 'Error al cargar el ejercicio');
      }
    });
  }

  goBack(): void {
    window.history.back();
  }
}
