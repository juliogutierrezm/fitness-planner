import { AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Exercise, InlineEditCatalogs, PaginatorState } from '../../../../shared/models';
import { getThumbnailSource, getVideoSource } from '../../../../shared/video-utils';

@Component({
  selector: 'app-exercise-table',
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSortModule
  ],
  templateUrl: './exercise-table.component.html',
  styleUrl: './exercise-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseTableComponent implements AfterViewInit, OnChanges {
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

  @Output() editExercise = new EventEmitter<Exercise>();
  @Output() deleteExercise = new EventEmitter<Exercise>();
  @Output() openVideoPreview = new EventEmitter<Exercise>();
  @Output() paginatorChanged = new EventEmitter<PaginatorState>();

  hoveredExercise: Exercise | null = null;
  previewPosition = { x: 0, y: 0 };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.restorePaginatorState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['exercises']) {
      this.dataSource.data = this.exercises ?? [];
      this.resetPaginatorIfNeeded();
    }
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

  canEdit(exercise: any): boolean {
    return exercise?.source === 'CUSTOM';
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

  getPreviewUrl(exercise: Exercise): string | null {
    return getThumbnailSource(exercise);
  }
}
