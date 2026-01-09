import { WorkoutSession } from '../services/client-data.service';

export interface SessionExercise {
  id?: string;
  name?: string;
  name_es?: string;
  thumbnail?: string;
  preview_url?: string;
  youtube_url?: string;
  sets?: number;
  reps?: number | string;
  rest?: number;
  muscle_group?: string;
  secondary_muscles?: string[];
  functional?: boolean;
  difficulty?: string;
  tips?: string[];
  common_mistakes?: string[];
  description_es?: string;
  description_en?: string;
  equipment_type?: string;
  equipment_specific?: string;
  isGroup?: boolean;
  children?: unknown[];
}

/**
 * Purpose: normalize session exercise items into a flattened list for display.
 * Input: unknown array of items. Output: SessionExercise[].
 * Error handling: skips invalid items and returns empty list on bad input.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const flattenSessionItems = (items: unknown): SessionExercise[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const flattened: SessionExercise[] = [];

  items.forEach(item => {
    const exercise = toExercise(item);
    if (!exercise) {
      return;
    }

    if (exercise.isGroup && Array.isArray(exercise.children) && exercise.children.length > 0) {
      exercise.children.forEach(child => {
        const childExercise = toExercise(child);
        if (childExercise) {
          flattened.push(childExercise);
        }
      });
      return;
    }

    flattened.push(exercise);
  });

  return flattened;
};

/**
 * Purpose: compute exercise count for a session including grouped children.
 * Input: WorkoutSession. Output: number.
 * Error handling: returns 0 for missing data.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const getSessionExerciseCount = (session: WorkoutSession | null): number => {
  if (!session) {
    return 0;
  }
  return flattenSessionItems(session.items).length;
};

/**
 * Purpose: resolve the first available primary muscle group from a session.
 * Input: WorkoutSession. Output: string | null.
 * Error handling: returns null when none exists.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const getSessionPrimaryMuscle = (session: WorkoutSession | null): string | null => {
  const exercises = flattenSessionItems(session?.items);
  const found = exercises.find(item => typeof item?.muscle_group === 'string' && item.muscle_group.trim().length > 0);
  return found?.muscle_group ? found.muscle_group.trim() : null;
};

/**
 * Purpose: detect if a session includes at least one functional exercise.
 * Input: WorkoutSession. Output: boolean.
 * Error handling: returns false on missing data.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const hasFunctionalExercise = (session: WorkoutSession | null): boolean => {
  const exercises = flattenSessionItems(session?.items);
  return exercises.some(item => item?.functional === true);
};

/**
 * Purpose: cast unknown values to SessionExercise safely.
 * Input: unknown. Output: SessionExercise | null.
 * Error handling: returns null for non-object inputs.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
const toExercise = (value: unknown): SessionExercise | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as SessionExercise;
};
