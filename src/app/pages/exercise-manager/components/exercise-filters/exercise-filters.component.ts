import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ExerciseFilters, FilterOptions } from '../../../../shared/models';

@Component({
  selector: 'app-exercise-filters',
  imports: [
    CommonModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './exercise-filters.component.html',
  styleUrl: './exercise-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseFiltersComponent {
  @Input() currentFilters!: ExerciseFilters;
  @Input() filterOptions!: FilterOptions;
  @Input() isLoading = false;
  @Input() canModify = true;

  @Output() filtersChanged = new EventEmitter<ExerciseFilters>();
  @Output() createNewClicked = new EventEmitter<void>();
  @Output() refreshClicked = new EventEmitter<void>();

  onSearchChange(): void {
    this.filtersChanged.emit(this.currentFilters);
  }

  onFilterChange(): void {
    this.filtersChanged.emit(this.currentFilters);
  }

  onCreateNew(): void {
    this.createNewClicked.emit();
  }

  onRefresh(): void {
    this.refreshClicked.emit();
  }
}
