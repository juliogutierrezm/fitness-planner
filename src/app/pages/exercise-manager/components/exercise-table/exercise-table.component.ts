import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Exercise, InlineEditCatalogs, PaginatorState } from '../../../../shared/models';
import { getThumbnailSource, getVideoSource } from '../../../../shared/video-utils';
import { ExerciseApiService } from '../../../../exercise-api.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-exercise-table',
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSortModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './exercise-table.component.html',
  styleUrl: './exercise-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseTableComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly uiLabelAliases: Record<string, string> = {
    Rings: 'Suspensión',
    Anillas: 'Suspensión',
    Bend: 'Hip'
  };

  displayedColumns: string[] = [
    'actions',
    'preview',
    'name_es',
    'muscle_group',
    'equipment_type',
    'category',
    'exercise_type',
    'difficulty'
  ];

  dataSource = new MatTableDataSource<Exercise>([]);

  @Input() exercises: Exercise[] | null = [];
  @Input() initialPaginatorState: PaginatorState | null = null;
  @Input() inlineCatalogs: InlineEditCatalogs | null = null;
  @Input() currentUserId: string | null = null;
  @Input() isAdmin = false;
  @Input() currentCompanyId: string | null = null;

  @Output() editExercise = new EventEmitter<Exercise>();
  @Output() deleteExercise = new EventEmitter<Exercise>();
  @Output() openVideoPreview = new EventEmitter<Exercise>();
  @Output() paginatorChanged = new EventEmitter<PaginatorState>();

  hoveredExercise: Exercise | null = null;
  previewPosition = { x: 0, y: 0 };

  private readonly PROCESSING_POLL_INTERVAL_MS = 3000;
  private readonly PROCESSING_POLL_TIMEOUT_MS = 60000;
  private processingExercises = new Map<string, { intervalId: ReturnType<typeof setInterval>; startedAt: number }>();
  processingIds = new Set<string>();
  timedOutIds = new Set<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private api: ExerciseApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.restorePaginatorState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['exercises']) {
      this.dataSource.data = this.exercises ?? [];
      this.resetPaginatorIfNeeded();
      this.detectProcessingExercises();
    }
  }

  ngOnDestroy(): void {
    this.processingExercises.forEach(entry => clearInterval(entry.intervalId));
    this.processingExercises.clear();
  }

  private restorePaginatorState(): void {
    if (this.initialPaginatorState && this.paginator) {
      this.paginator.pageIndex = this.initialPaginatorState.pageIndex;
      this.paginator.pageSize = this.initialPaginatorState.pageSize || 25;
    }
  }

  private resetPaginatorIfNeeded(): void {
    if (!this.paginator) {
      return;
    }

    const pageSize = this.paginator.pageSize || 25;
    const maxPageIndex = Math.max(Math.ceil(this.dataSource.data.length / pageSize) - 1, 0);
    if (this.paginator.pageIndex > maxPageIndex) {
      this.paginator.firstPage();
      this.onPageChange();
    }
  }

  onPageChange(): void {
    const state: PaginatorState = {
      pageIndex: this.paginator.pageIndex,
      pageSize: this.paginator.pageSize
    };
    this.paginatorChanged.emit(state);
  }

  getFieldValue(exercise: Exercise, field: string): any {
    switch (field) {
      case 'name_es':
        return exercise.name_es || exercise.name;
      case 'equipment_type':
        return exercise.equipment_type || exercise.equipment;
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      case 'exercise_type':
        return exercise.exercise_type || '';
      default:
        return (exercise as any)[field];
    }
  }

  getUiLabel(value: string | null | undefined): string {
    const normalized = value?.trim() || '';
    if (!normalized) return '';
    return this.uiLabelAliases[normalized] || normalized;
  }

  canEdit(exercise: Exercise | null | undefined): boolean {
    if (!exercise) return false;
    // Owner can always edit their own exercises
    if (Boolean(this.currentUserId) && exercise.trainerId === this.currentUserId) return true;
    // Admin can edit any exercise from the same company
    if (this.isAdmin && Boolean(this.currentCompanyId) && exercise.companyId === this.currentCompanyId) return true;
    return false;
  }

  onEditExercise(ex: Exercise): void {
    this.editExercise.emit(ex);
  }

  onDeleteExercise(ex: Exercise): void {
    this.deleteExercise.emit(ex);
  }

  onOpenVideo(ex: Exercise): void {
    this.openVideoPreview.emit(ex);
  }

  onVideoHover(ex: Exercise, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.hoveredExercise = ex;
    this.previewPosition = {
      x: rect.right + 10,
      y: rect.top
    };
  }

  onVideoLeave(): void {
    this.hoveredExercise = null;
    this.previewPosition = { x: 0, y: 0 };
  }

  hasPreview(exercise: Exercise): boolean {
    return Boolean(getVideoSource(exercise));
  }

  isProcessing(exercise: Exercise): boolean {
    return this.processingIds.has(exercise.id);
  }

  isTimedOut(exercise: Exercise): boolean {
    return this.timedOutIds.has(exercise.id);
  }

  getPreviewUrl(exercise: Exercise): string | null {
    return getThumbnailSource(exercise);
  }

  private detectProcessingExercises(): void {
    const exercises = this.exercises ?? [];
    const currentProcessing = new Set<string>();

    for (const ex of exercises) {
      if (this.isS3WithoutThumbnail(ex)) {
        currentProcessing.add(ex.id);
        if (!this.processingExercises.has(ex.id) && !this.timedOutIds.has(ex.id)) {
          this.startProcessingPoll(ex.id);
        }
      }
    }

    for (const [id, entry] of this.processingExercises) {
      if (!currentProcessing.has(id)) {
        clearInterval(entry.intervalId);
        this.processingExercises.delete(id);
        this.processingIds.delete(id);
      }
    }
  }

  private isS3WithoutThumbnail(exercise: Exercise): boolean {
    const hasS3Video = exercise.video?.type === 'S3'
      || Boolean(exercise.s3_key)
      || Boolean(exercise.preview_url)
      || Boolean(exercise.previewUrl);
    if (!hasS3Video) return false;
    return !getThumbnailSource(exercise);
  }

  private startProcessingPoll(exerciseId: string): void {
    this.processingIds.add(exerciseId);
    const startedAt = Date.now();

    const intervalId = setInterval(() => {
      if (Date.now() - startedAt > this.PROCESSING_POLL_TIMEOUT_MS) {
        this.stopProcessingPoll(exerciseId);
        this.timedOutIds.add(exerciseId);
        this.processingIds.delete(exerciseId);
        this.cdr.markForCheck();
        return;
      }

      this.api.getExerciseById(exerciseId, true).pipe(take(1)).subscribe({
        next: (refreshed) => {
          if (!refreshed) return;

          if (getThumbnailSource(refreshed)) {
            this.stopProcessingPoll(exerciseId);
            this.processingIds.delete(exerciseId);
            this.updateExerciseInDataSource(refreshed);
          }
        }
      });
    }, this.PROCESSING_POLL_INTERVAL_MS);

    this.processingExercises.set(exerciseId, { intervalId, startedAt });
  }

  private stopProcessingPoll(exerciseId: string): void {
    const entry = this.processingExercises.get(exerciseId);
    if (entry) {
      clearInterval(entry.intervalId);
      this.processingExercises.delete(exerciseId);
    }
  }

  private updateExerciseInDataSource(updated: Exercise): void {
    const index = this.dataSource.data.findIndex(ex => ex.id === updated.id);
    if (index === -1) return;

    const nextData = [...this.dataSource.data];
    nextData[index] = { ...nextData[index], ...updated };
    this.dataSource.data = nextData;
    this.cdr.markForCheck();
  }
}
