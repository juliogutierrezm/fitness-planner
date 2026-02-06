import { Injectable } from '@angular/core';
import { Exercise, ExerciseFilters, FilterOptions, EXERCISE_DIFFICULTY_OPTIONS, EXERCISE_MUSCLE_TYPE_OPTIONS } from '../../../shared/models';

/**
 * Purpose: encapsulate planner exercise filtering, searching, and filter persistence.
 * Input/Output: accepts exercise/filter data and returns filtered lists + options.
 * Error handling: wraps storage access in try/catch and falls back to defaults.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class PlannerExerciseFilterService {
  getDefaultFilters(): ExerciseFilters {
    return {
      searchValue: '',
      categoryFilter: '',
      muscleGroupFilter: '',
      equipmentTypeFilter: '',
      difficultyFilter: '',
      groupTypeFilter: ''
    };
  }

  buildFilterOptions(exercises: Exercise[], functionalCategoryLabel: string): FilterOptions {
    const categories = new Set<string>();
    const muscleGroups = new Set<string>();
    const equipmentTypes = new Set<string>();

    exercises.forEach(exercise => {
      const category = this.getFieldValue(exercise, 'category');
      const muscleGroup = this.getFieldValue(exercise, 'muscle_group');
      const equipmentType = this.getFieldValue(exercise, 'equipment_type');

      if (category) categories.add(category);
      if (muscleGroup) muscleGroups.add(muscleGroup);
      if (equipmentType) equipmentTypes.add(equipmentType);
    });

    categories.add(functionalCategoryLabel);

    return {
      categoryOptions: Array.from(categories).sort(),
      muscleGroupOptions: Array.from(muscleGroups).sort(),
      equipmentTypeOptions: Array.from(equipmentTypes).sort(),
      difficultyOptions: EXERCISE_DIFFICULTY_OPTIONS,
      groupTypeOptions: EXERCISE_MUSCLE_TYPE_OPTIONS
    };
  }

  loadFiltersFromStorage(storageKey: string, fallback: ExerciseFilters): ExerciseFilters {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          searchValue: parsed.searchValue || '',
          categoryFilter: parsed.categoryFilter || '',
          muscleGroupFilter: parsed.muscleGroupFilter || '',
          equipmentTypeFilter: parsed.equipmentTypeFilter || '',
          difficultyFilter: parsed.difficultyFilter || '',
          groupTypeFilter: parsed.groupTypeFilter || ''
        };
      }
    } catch (error) {
      console.warn('Failed to load filters from storage:', error);
    }

    return { ...fallback };
  }

  saveFiltersToStorage(storageKey: string, filters: ExerciseFilters): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to storage:', error);
    }
  }

  applyCombinedFilter(
    exercises: Exercise[],
    filters: ExerciseFilters,
    functionalCategoryLabel: string,
    storageKey?: string
  ): Exercise[] {
    const filtered = exercises.filter(exercise => {
      const searchValue = filters.searchValue || '';
      const matchesSearch = !searchValue.trim() ||
        (this.getFieldValue(exercise, 'name_es') || '').toLowerCase()
          .includes(searchValue.toLowerCase());

      const selectedCategory = filters.categoryFilter;
      const matchesCategory = !selectedCategory ||
        (selectedCategory === functionalCategoryLabel
          ? this.isFunctionalExercise(exercise)
          : this.getFieldValue(exercise, 'category') === selectedCategory);

      const matchesMuscleGroup = !filters.muscleGroupFilter ||
        this.getFieldValue(exercise, 'muscle_group') === filters.muscleGroupFilter;

      const matchesEquipmentType = !filters.equipmentTypeFilter ||
        this.getFieldValue(exercise, 'equipment_type') === filters.equipmentTypeFilter;

      const matchesDifficulty = !filters.difficultyFilter ||
        this.getFieldValue(exercise, 'difficulty') === filters.difficultyFilter;

      const matchesGroupType = !filters.groupTypeFilter ||
        this.getFieldValue(exercise, 'group_type') === filters.groupTypeFilter;

      return matchesSearch && matchesCategory && matchesMuscleGroup && matchesEquipmentType && matchesDifficulty && matchesGroupType;
    });

    if (storageKey) {
      this.saveFiltersToStorage(storageKey, filters);
    }

    return filtered;
  }

  private getFieldValue(exercise: Exercise, field: string): any {
    switch (field) {
      case 'name_es':
        return exercise.name_es || '';
      case 'equipment_type':
        return exercise.equipment_type || '';
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      case 'exercise_type':
        return exercise.exercise_type || exercise.category;
      default:
        return (exercise as any)[field];
    }
  }

  private isFunctionalExercise(exercise: Exercise): boolean {
    const functionalValue = (exercise as any).functional;
    if (functionalValue === true) return true;
    if (typeof functionalValue === 'string') return functionalValue.trim().length > 0;
    return false;
  }
}
