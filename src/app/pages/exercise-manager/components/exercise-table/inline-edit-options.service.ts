import { Injectable } from '@angular/core';
import { Exercise, InlineEditCatalogs } from '../../../../shared/models';

@Injectable({ providedIn: 'root' })
export class InlineEditOptionsService {
  buildCatalogs(exercises: Exercise[], difficultyOptions: string[]): InlineEditCatalogs {
    const categoryOptions = new Set<string>();
    const muscleGroupOptions = new Set<string>();
    const equipmentTypeOptions = new Set<string>();
    const exerciseTypeOptions = new Set<string>();

    exercises.forEach(exercise => {
      const category = this.getFieldValue(exercise, 'category');
      const muscleGroup = this.getFieldValue(exercise, 'muscle_group');
      const equipmentType = this.getFieldValue(exercise, 'equipment_type');
      const exerciseType = this.getFieldValue(exercise, 'exercise_type');

      if (category) categoryOptions.add(category);
      if (muscleGroup) muscleGroupOptions.add(muscleGroup);
      if (equipmentType) equipmentTypeOptions.add(equipmentType);
      if (exerciseType) exerciseTypeOptions.add(exerciseType);
    });

    return {
      categoryOptions: Array.from(categoryOptions).sort(),
      muscleGroupOptions: Array.from(muscleGroupOptions).sort(),
      equipmentTypeOptions: Array.from(equipmentTypeOptions).sort(),
      exerciseTypeOptions: Array.from(exerciseTypeOptions).sort(),
      difficultyOptions: [...difficultyOptions]
    };
  }

  private getFieldValue(exercise: Exercise, field: string): string {
    switch (field) {
      case 'name_es':
        return exercise.name_es || exercise.name || '';
      case 'equipment_type':
        return exercise.equipment_type || exercise.equipment || '';
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle || '';
      case 'exercise_type':
        return exercise.exercise_type || exercise.category || '';
      default:
        return String((exercise as any)[field] || '').trim();
    }
  }
}