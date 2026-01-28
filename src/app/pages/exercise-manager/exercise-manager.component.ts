import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ExerciseApiService } from '../../exercise-api.service';
import { Exercise, ExerciseFilters, FilterOptions, InlineEditCatalogs, PaginatorState, EXERCISE_DIFFICULTY_OPTIONS, EXERCISE_MUSCLE_TYPE_OPTIONS } from '../../shared/models';
import { FeedbackConfig, ExerciseMessages, ErrorMapper, DevLogger } from '../../shared/feedback-utils';
import { ExerciseFiltersComponent } from './components/exercise-filters/exercise-filters.component';
import { ExerciseTableComponent } from './components/exercise-table/exercise-table.component';
import { ExerciseVideoDialogComponent } from './components/exercise-video-dialog/exercise-video-dialog.component';
import { ExerciseEditDialogComponent } from './components/exercise-edit-dialog/exercise-edit-dialog.component';
import { InlineEditOptionsService } from './components/exercise-table/inline-edit-options.service';

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
export class ExerciseManagerComponent implements OnInit {
  loading = false;
  dataSource = new MatTableDataSource<Exercise>();
  exercises: Exercise[] = [];

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

  constructor(
    private api: ExerciseApiService,
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private inlineOptionsService: InlineEditOptionsService
  ) {}

  ngOnInit(): void {
    this.loadFiltersFromStorage();
    this.loadExercises();
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

  private populateFilterOptions(): void {
    const categories = new Set<string>();
    const muscleGroups = new Set<string>();
    const equipmentTypes = new Set<string>();

    this.exercises.forEach(ex => {
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

  loadExercises(): void {
    const startTime = Date.now();
    this.loading = true;

    this.api.getExerciseLibrary().pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck(); // Ensure UI updates with OnPush strategy
      })
    ).subscribe({
      next: (res) => {
        this.exercises = res.items;

        // Populate filter options from data
        this.populateFilterOptions();

        // Build inline edit catalogs from backend data/cache
        const catalogs = this.inlineOptionsService.buildCatalogs(
          this.exercises,
          EXERCISE_DIFFICULTY_OPTIONS
        );
        this.inlineCatalogs = {
          ...catalogs,
          exerciseTypeOptions: [...EXERCISE_MUSCLE_TYPE_OPTIONS]
        };

        // Apply combined filtering
        this.applyCombinedFilter();

        // Log operation success following DEVELOPER.md Section O
        const elapsedMs = Date.now() - startTime;
        DevLogger.logOperation('loadExercises', {
          count: res.items.length,
          elapsedMs
        }, true);

        console.log('📚 Biblioteca de ejercicios cargada:', res.count, 'ejercicios');
      },
      error: (err) => {
        DevLogger.logError('loadExercises', err);
        const errorMsg = ErrorMapper.mapHttpError(err);
        this.snackBar.open(errorMsg, 'Cerrar', FeedbackConfig.errorConfig());
      }
    });
  }

  onFiltersChanged(filters: ExerciseFilters): void {
    this.currentFilters = filters;
    this.applyCombinedFilter();
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

  onViewDetails(exercise: Exercise): void {
    this.router.navigate(['/exercise-detail', exercise.id]);
  }

  onOpenVideo(exercise: Exercise): void {
    this.openVideoDialog(exercise);
  }

  onPaginatorChanged(state: PaginatorState): void {
    this.paginatorState = state;
    this.savePaginatorState();
  }

  private applyCombinedFilter(): void {
    // Combine all filters and apply to data source
    const filteredData = this.exercises.filter(exercise => {
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
    });

    this.dataSource.data = filteredData;
    this.saveFiltersToStorage();
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
      this.openEditDialog(selectedExercise);
    });
  }

  private openEditDialog(exercise: Exercise | null): void {
    const dialogRef = this.dialog.open(ExerciseEditDialogComponent, {
      data: exercise,
      width: '800px'
    });

    dialogRef.componentInstance.exerciseSaved.subscribe(result => {
      if (exercise) {
        // Update mode
        if (result.ok) {
          // Merge updated fields into local exercise
          const index = this.exercises.findIndex(ex => ex.id === exercise.id);
          if (index !== -1) {
            this.exercises[index] = { ...this.exercises[index], ...result.updated };
            this.applyCombinedFilter(); // Refresh the table
            this.cdr.markForCheck(); // Ensure UI updates with OnPush strategy
          }
          this.snackBar.open(ExerciseMessages.UPDATED_SUCCESS, 'Cerrar', FeedbackConfig.successConfig());
        } else {
          this.snackBar.open(ExerciseMessages.SAVE_ERROR, 'Cerrar', FeedbackConfig.errorConfig());
        }
      } else {
        // Create mode
        this.loadExercises(); // Refresh to get the new exercise
        this.snackBar.open(ExerciseMessages.CREATED_SUCCESS, 'Cerrar', FeedbackConfig.successConfig());
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      // Dialog closed without save - no action needed
    });
  }
}
