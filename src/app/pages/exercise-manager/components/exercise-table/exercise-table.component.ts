import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource } from '@angular/material/table';
import { Exercise, ExerciseFilters, PaginatorState } from '../../../../shared/models';

interface ExerciseWithModified extends Exercise {}

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
export class ExerciseTableComponent implements AfterViewInit {
  // Fixed columns for the simplified table
  displayedColumns: string[] = ['actions', 'preview_url', 'name_es', 'muscle_group', 'equipment_type', 'category'];

  @Input() dataSource!: MatTableDataSource<ExerciseWithModified>;
  @Input() initialPaginatorState: PaginatorState | null = null;

  @Output() editExercise = new EventEmitter<Exercise>();
  @Output() viewDetails = new EventEmitter<Exercise>();
  @Output() openVideoPreview = new EventEmitter<Exercise>();
  @Output() paginatorChanged = new EventEmitter<PaginatorState>();

  // Hover preview state
  hoveredExercise: Exercise | null = null;
  previewPosition = { x: 0, y: 0 };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.restorePaginatorState();
  }

  private restorePaginatorState(): void {
    if (this.initialPaginatorState && this.paginator) {
      this.paginator.pageIndex = this.initialPaginatorState.pageIndex;
      this.paginator.pageSize = this.initialPaginatorState.pageSize || 25;
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

  getAliasesDisplay(exercise: Exercise): string {
    const aliases = this.getFieldValue(exercise, 'aliases') || [];
    if (aliases.length === 0) return '';
    if (aliases.length === 1) return aliases[0];
    return `Alias (${aliases.length})`;
  }

  getInlineAliasDisplay(exercise: Exercise): string {
    const aliases = this.getFieldValue(exercise, 'aliases') || [];
    if (aliases.length === 0) return '';

    const firstAlias = aliases.length > 0 ? aliases[0] : '';
    if (aliases.length === 1) {
      return ` — ${firstAlias}`;
    } else {
      return ` — ${firstAlias} +${aliases.length - 1}`;
    }
  }

  getAliasesOptions(exercise: Exercise): string[] {
    const aliases = this.getFieldValue(exercise, 'aliases') || [];
    return aliases;
  }

  getAliasesTooltip(exercise: Exercise): string {
    const aliases = this.getFieldValue(exercise, 'aliases') || [];
    return aliases.length > 0 ? aliases.join(', ') : 'Sin alias';
  }

  onAliasClick(exercise: Exercise, alias: string, event: Event): void {
    event.stopPropagation();
    console.log('Alias clicked for exercise:', exercise.name_es, 'selected alias:', alias);
  }

  onEditExercise(ex: Exercise): void {
    this.editExercise.emit(ex);
  }

  onViewDetails(ex: Exercise): void {
    this.viewDetails.emit(ex);
  }

  onOpenVideo(ex: Exercise): void {
    this.openVideoPreview.emit(ex);
  }

  onVideoHover(ex: Exercise, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.hoveredExercise = ex;
    this.previewPosition = {
      x: rect.right + 10, // Position to the right of the button
      y: rect.top
    };
  }

  onVideoLeave(): void {
    this.hoveredExercise = null;
    this.previewPosition = { x: 0, y: 0 };
  }

  getPreviewUrl(exercise: Exercise): string | null {
    return exercise.thumbnail || exercise.preview_url || null;
  }
}
