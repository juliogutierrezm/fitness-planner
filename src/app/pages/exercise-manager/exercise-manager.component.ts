import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, of } from 'rxjs';
import { finalize, map, shareReplay, take, tap } from 'rxjs/operators';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { Exercise, ExerciseFilters, FilterOptions, InlineEditCatalogs, PaginatorState, EXERCISE_DIFFICULTY_OPTIONS, EXERCISE_MUSCLE_TYPE_OPTIONS } from '../../shared/models';
import { FeedbackConfig, ExerciseMessages, DevLogger } from '../../shared/feedback-utils';
import { ExerciseFiltersComponent } from './components/exercise-filters/exercise-filters.component';
import { ExerciseTableComponent } from './components/exercise-table/exercise-table.component';
import { ExerciseVideoDialogComponent } from './components/exercise-video-dialog/exercise-video-dialog.component';
import { ExerciseEditDialogComponent } from './components/exercise-edit-dialog/exercise-edit-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { InlineEditOptionsService } from './components/exercise-table/inline-edit-options.service';
import { getThumbnailSource } from '../../shared/video-utils';

@Component({
  selector: 'app-exercise-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    ExerciseFiltersComponent,
    ExerciseTableComponent
  ],
  templateUrl: './exercise-manager.component.html',
  styleUrls: ['./exercise-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseManagerComponent implements OnInit, OnDestroy {
  loading = false;
  exercises$!: Observable<Exercise[]>;
  filteredExercises$!: Observable<Exercise[]>;

  // Current filters data
  currentFilters: ExerciseFilters = {
    searchValue: '',
    categoryFilter: '',
    muscleGroupFilter: '',
    equipmentTypeFilter: '',
    difficultyFilter: '',
    groupTypeFilter: ''
  };

  // Filter options populated from data
  filterOptions: FilterOptions = {
    categoryOptions: [],
    muscleGroupOptions: [],
    equipmentTypeOptions: [],
    difficultyOptions: [],
    groupTypeOptions: []
  };

  // Pagination state
  paginatorState: PaginatorState | null = null;

  inlineCatalogs: InlineEditCatalogs | null = null;

  // Persistence key
  private readonly STORAGE_KEY = 'exercise-manager-filters';
  private readonly MEDIA_REFRESH_INTERVAL_MS = 2000;
  private readonly MEDIA_REFRESH_MAX_ATTEMPTS = 15;
  private mediaRefreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private exercisesSnapshot: Exercise[] = [];

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private inlineOptionsService: InlineEditOptionsService
  ) {}

  get isGymAdmin(): boolean {
    return this.authService.isGymAdmin();
  }

  /**
   * Purpose: determine if current user can modify exercises (create/edit/delete).
   * Only users belonging to the System Cognito group have modification permissions.
   * Input: none. Output: boolean.
   * Error handling: returns false when user lacks System group.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get canModifyExercises(): boolean {
    return this.authService.isSystem();
  }

  ngOnInit(): void {
    this.loadFiltersFromStorage();
    this.loadExercises();
  }

  ngOnDestroy(): void {
    this.stopMediaRefreshPolling();
  }

  private loadFiltersFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved);
        this.currentFilters = {
          searchValue: filters.searchValue || '',
          categoryFilter: filters.categoryFilter || '',
          muscleGroupFilter: filters.muscleGroupFilter || '',
          equipmentTypeFilter: filters.equipmentTypeFilter || '',
          difficultyFilter: filters.difficultyFilter || '',
          groupTypeFilter: filters.groupTypeFilter || ''
        };
      }
    } catch (error) {
      console.warn('Failed to load filters from storage:', error);
    }
  }

  private saveFiltersToStorage(): void {
    try {
      const filters = this.currentFilters;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to storage:', error);
    }
  }

  private populateFilterOptions(exercises: Exercise[]): void {
    const categories = new Set<string>();
    const muscleGroups = new Set<string>();
    const equipmentTypes = new Set<string>();

    exercises.forEach(ex => {
      const category = this.getFieldValue(ex, 'category');
      const muscleGroup = this.getFieldValue(ex, 'muscle_group');
      const equipmentType = this.getFieldValue(ex, 'equipment_type');

      if (category) categories.add(category);
      if (muscleGroup) muscleGroups.add(muscleGroup);
      if (equipmentType) equipmentTypes.add(equipmentType);
    });

    this.filterOptions = {
      categoryOptions: Array.from(categories).sort(),
      muscleGroupOptions: Array.from(muscleGroups).sort(),
      equipmentTypeOptions: Array.from(equipmentTypes).sort(),
      difficultyOptions: EXERCISE_DIFFICULTY_OPTIONS,
      groupTypeOptions: EXERCISE_MUSCLE_TYPE_OPTIONS
    };
  }

  getFieldValue(exercise: Exercise, field: string): any {
    // Handle field fallbacks for legacy data
    switch (field) {
      case 'name_es':
        return exercise.name_es || exercise.name;
      case 'equipment_type':
        return exercise.equipment_type || exercise.equipment;
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      case 'exercise_type':
        return exercise.exercise_type || exercise.category;
      default:
        return (exercise as any)[field];
    }
  }

  loadExercises(onLoaded?: (exercises: Exercise[]) => void): void {
    const startTime = Date.now();
    this.loading = true;

    this.exercises$ = this.api.getAllExercises().pipe(
      tap((exercises) => {
        this.exercisesSnapshot = [...exercises];
        this.populateFilterOptions(exercises);

        const catalogs = this.inlineOptionsService.buildCatalogs(
          exercises,
          EXERCISE_DIFFICULTY_OPTIONS
        );
        this.inlineCatalogs = {
          ...catalogs,
          exerciseTypeOptions: [...EXERCISE_MUSCLE_TYPE_OPTIONS]
        };

        const elapsedMs = Date.now() - startTime;
        DevLogger.logOperation('loadExercises', {
          count: exercises.length,
          elapsedMs
        }, true);

        console.log('📚 Ejercicios combinados cargados:', exercises.length);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
      shareReplay(1)
    );

    this.rebuildFilteredExercises();

    if (onLoaded) {
      this.exercises$.pipe(take(1)).subscribe({
        next: onLoaded,
        error: () => {
          // Errors are already handled in the source observable.
        }
      });
    }
  }

  onFiltersChanged(filters: ExerciseFilters): void {
    this.currentFilters = { ...filters };
    this.saveFiltersToStorage();
    this.rebuildFilteredExercises();
  }

  onCreateNewClicked(): void {
    this.openEditDialog(null);
  }

  onRefreshClicked(): void {
    this.loadExercises();
  }

  onEditExercise(exercise: Exercise): void {
    this.openEditDialog(exercise);
  }

  /**
   * Purpose: delete a custom exercise after user confirmation.
   * Input: Exercise to delete. Output: void.
   * Error handling: shows snackbar on error, reloads list on success.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onDeleteExercise(exercise: Exercise): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar Ejercicio',
        message: `¿Estás seguro de que deseas eliminar "${exercise.name_es || exercise.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        icon: 'delete'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.loading = true;
      this.cdr.markForCheck();

      this.api.deleteExercise(exercise.id).pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (response) => {
          if (response) {
            this.snackBar.open('Ejercicio eliminado correctamente.', 'Cerrar', FeedbackConfig.successConfig());
            this.loadExercises();
          } else {
            this.snackBar.open('Error al eliminar el ejercicio.', 'Cerrar', FeedbackConfig.errorConfig());
          }
        },
        error: (err) => {
          console.error('Error deleting exercise:', err);
          this.snackBar.open('Error al eliminar el ejercicio.', 'Cerrar', FeedbackConfig.errorConfig());
        }
      });
    });
  }

  onOpenVideo(exercise: Exercise): void {
    this.openVideoDialog(exercise);
  }

  onPaginatorChanged(state: PaginatorState): void {
    this.paginatorState = state;
    this.savePaginatorState();
  }

  private rebuildFilteredExercises(): void {
    this.filteredExercises$ = this.exercises$.pipe(
      map(exercises => exercises.filter(exercise => {
      // Text search on name_es only
      const matchesSearch = !this.currentFilters.searchValue.trim() ||
        (this.getFieldValue(exercise, 'name_es') || '').toLowerCase()
          .includes(this.currentFilters.searchValue.toLowerCase());

      // Category filter
      const matchesCategory = !this.currentFilters.categoryFilter ||
        this.getFieldValue(exercise, 'category') === this.currentFilters.categoryFilter;

      // Muscle group filter
      const matchesMuscleGroup = !this.currentFilters.muscleGroupFilter ||
        this.getFieldValue(exercise, 'muscle_group') === this.currentFilters.muscleGroupFilter;

      // Equipment type filter
      const matchesEquipmentType = !this.currentFilters.equipmentTypeFilter ||
        this.getFieldValue(exercise, 'equipment_type') === this.currentFilters.equipmentTypeFilter;

      // Difficulty filter
      const matchesDifficulty = !this.currentFilters.difficultyFilter ||
        this.getFieldValue(exercise, 'difficulty') === this.currentFilters.difficultyFilter;

      // Group type filter
      const matchesGroupType = !this.currentFilters.groupTypeFilter ||
      this.getFieldValue(exercise, 'exercise_type') === this.currentFilters.groupTypeFilter;


      return matchesSearch && matchesCategory && matchesMuscleGroup && matchesEquipmentType && matchesDifficulty && matchesGroupType;
    }))
    );
  }

  private savePaginatorState(): void {
    if (this.paginatorState) {
      try {
        localStorage.setItem(`${this.STORAGE_KEY}-paginator`, JSON.stringify(this.paginatorState));
      } catch (error) {
        console.warn('Failed to save paginator state:', error);
      }
    }
  }

  private openVideoDialog(exercise: Exercise): void {
    this.dialog.open(ExerciseVideoDialogComponent, {
      data: exercise,
      width: '600px'
    }).componentInstance.viewDetailsClicked.subscribe(selectedExercise => {
      // Only open edit dialog for custom exercises
      if ((selectedExercise as any)?.source === 'CUSTOM') {
        this.openEditDialog(selectedExercise);
      }
      // System exercises: no action (edit not allowed)
    });
  }

  private openEditDialog(exercise: Exercise | null): void {
    const dialogRef = this.dialog.open(ExerciseEditDialogComponent, {
      data: { exercise, filterOptions: this.filterOptions },
      width: '800px'
    });

    let saveHandled = false;
    dialogRef.componentInstance.exerciseSaved.subscribe((event?: {
      exerciseId?: string;
      shouldPollForThumbnail?: boolean;
    }) => {
      saveHandled = true;
      this.loadExercises();
      if (event?.shouldPollForThumbnail && event.exerciseId) {
        this.startMediaRefreshPolling(event.exerciseId);
      } else {
        this.stopMediaRefreshPolling();
      }
    });

    dialogRef.afterClosed().subscribe((result?: {
      saved?: boolean;
      exerciseId?: string;
      shouldPollForThumbnail?: boolean;
    }) => {
      if (result?.saved && !saveHandled) {
        this.loadExercises();
        if (result.shouldPollForThumbnail && result.exerciseId) {
          this.startMediaRefreshPolling(result.exerciseId);
        }
      }

      if (!result?.saved) {
        return;
      }

      const message = exercise
        ? ExerciseMessages.UPDATED_SUCCESS
        : ExerciseMessages.CREATED_SUCCESS;
      this.snackBar.open(message, 'Cerrar', FeedbackConfig.successConfig());
    });
  }

  private startMediaRefreshPolling(exerciseId: string): void {
    this.stopMediaRefreshPolling();

    let attempts = 0;
    this.mediaRefreshIntervalId = setInterval(() => {
      attempts += 1;
      this.api.getExerciseById(exerciseId).pipe(take(1)).subscribe({
        next: (refreshedExercise) => {
          if (refreshedExercise) {
            this.replaceExerciseInMemory(refreshedExercise);
          }

          const hasThumbnail = Boolean(refreshedExercise && getThumbnailSource(refreshedExercise));
          if (hasThumbnail || attempts >= this.MEDIA_REFRESH_MAX_ATTEMPTS) {
            this.stopMediaRefreshPolling();
          }
        },
        error: () => {
          if (attempts >= this.MEDIA_REFRESH_MAX_ATTEMPTS) {
            this.stopMediaRefreshPolling();
          }
        }
      });
    }, this.MEDIA_REFRESH_INTERVAL_MS);
  }

  private replaceExerciseInMemory(updatedExercise: Exercise): void {
    if (!this.exercisesSnapshot.length) {
      return;
    }

    const exerciseIndex = this.exercisesSnapshot.findIndex(ex => ex.id === updatedExercise.id);
    if (exerciseIndex === -1) {
      return;
    }

    const nextExercises = [...this.exercisesSnapshot];
    nextExercises[exerciseIndex] = updatedExercise;

    this.exercisesSnapshot = nextExercises;
    this.exercises$ = of(nextExercises).pipe(shareReplay(1));
    this.rebuildFilteredExercises();
    this.cdr.markForCheck();
  }

  private stopMediaRefreshPolling(): void {
    if (this.mediaRefreshIntervalId) {
      clearInterval(this.mediaRefreshIntervalId);
      this.mediaRefreshIntervalId = null;
    }
  }
}
