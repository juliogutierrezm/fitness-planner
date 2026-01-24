import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { Exercise, InlineEditCatalogs, PaginatorState } from '../../../../shared/models';
import { ExerciseApiService } from '../../../../exercise-api.service';

type EditableField = 'name_es' | 'muscle_group' | 'equipment_type' | 'category' | 'functional' | 'exercise_type' | 'difficulty';

interface RowEditState {
  draft: Partial<Exercise>;
  dirtyFields: Set<EditableField>;
  saving: boolean;
  error?: string;
  savedAt?: number;
}

@Component({
  selector: 'app-exercise-table',
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSortModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  templateUrl: './exercise-table.component.html',
  styleUrl: './exercise-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseTableComponent implements AfterViewInit {
  // Fixed columns for the simplified table
  displayedColumns: string[] = [
    'actions',
    'preview_url',
    'name_es',
    'muscle_group',
    'equipment_type',
    'category',
    'functional',
    'exercise_type',
    'difficulty'
  ];

  @Input() dataSource!: MatTableDataSource<Exercise>;
  @Input() initialPaginatorState: PaginatorState | null = null;
  @Input() inlineCatalogs: InlineEditCatalogs | null = null;

  @Output() editExercise = new EventEmitter<Exercise>();
  @Output() viewDetails = new EventEmitter<Exercise>();
  @Output() openVideoPreview = new EventEmitter<Exercise>();
  @Output() paginatorChanged = new EventEmitter<PaginatorState>();

  // Hover preview state
  hoveredExercise: Exercise | null = null;
  previewPosition = { x: 0, y: 0 };

  editingCell: { id: string; field: EditableField } | null = null;
  rowStates = new Map<string, RowEditState>();
  private readonly saveSuccessDurationMs = 1800;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private api: ExerciseApiService,
    private cdr: ChangeDetectorRef
  ) {}

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

  startEdit(exercise: Exercise, field: EditableField, event?: Event): void {
    event?.stopPropagation();
    this.editingCell = { id: exercise.id, field };
    this.ensureRowState(exercise);
    this.cdr.markForCheck();
  }

  isEditingCell(exercise: Exercise, field: EditableField): boolean {
    return this.editingCell?.id === exercise.id && this.editingCell.field === field;
  }

  updateDraft(exercise: Exercise, field: EditableField, value: any): void {
    const state = this.ensureRowState(exercise);
    state.draft[field] = value;
    state.dirtyFields.add(field);
    state.error = undefined;
    state.savedAt = undefined;
    this.cdr.markForCheck();
  }

  commitEdit(exercise: Exercise, field: EditableField): void {
    const state = this.ensureRowState(exercise);
    if (!state.dirtyFields.has(field)) {
      this.editingCell = null;
      this.cdr.markForCheck();
      return;
    }
    this.saveRow(exercise, [field]);
  }

  saveRow(exercise: Exercise, fields?: EditableField[]): void {
    const state = this.ensureRowState(exercise);
    const dirtyFields = fields?.length ? fields : Array.from(state.dirtyFields);
    if (!dirtyFields.length) {
      return;
    }

    const payload = dirtyFields.reduce((acc, field) => {
      let value = state.draft[field];
      if (field === 'functional') {
        value = Boolean(value);
      }
      return { ...acc, [field]: value };
    }, {} as Partial<Exercise>);

    state.saving = true;
    state.error = undefined;
    this.cdr.markForCheck();

    this.api.updateExerciseLibraryItem(exercise.id, payload as Exercise).subscribe({
      next: (response) => {
        state.saving = false;
        if (response.ok) {
          dirtyFields.forEach(field => state.dirtyFields.delete(field));
          state.savedAt = Date.now();
          state.error = undefined;
          this.applyRowUpdate(exercise, response.updated);
          this.editingCell = null;
          setTimeout(() => this.cdr.markForCheck(), this.saveSuccessDurationMs);
        } else {
          state.error = 'No se pudo guardar';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        state.saving = false;
        state.error = 'No se pudo guardar';
        this.cdr.markForCheck();
      }
    });
  }

  retrySave(exercise: Exercise, event?: Event): void {
    event?.stopPropagation();
    this.saveRow(exercise);
  }

  hasRowError(exercise: Exercise): boolean {
    return Boolean(this.ensureRowState(exercise).error);
  }

  isRowSaving(exercise: Exercise): boolean {
    return this.ensureRowState(exercise).saving;
  }

  showRowSaved(exercise: Exercise): boolean {
    const savedAt = this.ensureRowState(exercise).savedAt;
    return !!savedAt && Date.now() - savedAt < this.saveSuccessDurationMs;
  }

  getFunctionalLabel(exercise: Exercise): string {
    const raw = this.getFunctionalValue(exercise);
    return raw ? 'Sí' : 'No';
  }

  getFunctionalValue(exercise: Exercise): boolean {
    const state = this.rowStates.get(exercise.id);
    if (state?.draft?.functional !== undefined) {
      return Boolean(state.draft.functional);
    }
    const value = (exercise as any).functional;
    if (value === true) return true;
    if (typeof value === 'string') return value.trim().length > 0;
    return false;
  }

  getInlineValue(exercise: Exercise, field: EditableField): any {
    const state = this.rowStates.get(exercise.id);
    if (state?.draft?.[field] !== undefined) {
      return state.draft[field];
    }
    if (field === 'functional') {
      return this.getFunctionalValue(exercise);
    }
    return this.getFieldValue(exercise, field);
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

  private ensureRowState(exercise: Exercise): RowEditState {
    const existing = this.rowStates.get(exercise.id);
    if (existing) {
      return existing;
    }
    const draft: Partial<Exercise> = {
      name_es: this.getFieldValue(exercise, 'name_es') || '',
      muscle_group: this.getFieldValue(exercise, 'muscle_group') || '',
      equipment_type: this.getFieldValue(exercise, 'equipment_type') || '',
      category: this.getFieldValue(exercise, 'category') || '',
      functional: this.getFunctionalValue(exercise),
      exercise_type: this.getFieldValue(exercise, 'exercise_type') || '',
      difficulty: this.getFieldValue(exercise, 'difficulty') || ''
    };
    const state: RowEditState = {
      draft,
      dirtyFields: new Set<EditableField>(),
      saving: false
    };
    this.rowStates.set(exercise.id, state);
    return state;
  }

  private applyRowUpdate(exercise: Exercise, updated: Partial<Exercise>): void {
    Object.assign(exercise, updated);
    this.dataSource.data = this.dataSource.data.slice();
  }
}
