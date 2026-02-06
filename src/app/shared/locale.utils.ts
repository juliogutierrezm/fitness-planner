import { PlanItem } from './models';

export type SupportedLocale = 'es' | 'en';

/**
 * Purpose: Detect user locale based on browser settings.
 * Input: none. Output: 'es' | 'en'.
 * Error handling: defaults to 'en' if detection fails.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function detectUserLocale(): SupportedLocale {
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
    return browserLang.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Purpose: Get localized exercise name based on locale with fallback chain.
 * Input: PlanItem, locale. Output: string.
 * Error handling: falls back through name_es -> name_en -> name -> default label.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getLocalizedExerciseName(item: PlanItem | null | undefined, locale: SupportedLocale): string {
  if (!item) return 'Nombre no disponible';
  
  if (locale === 'es') {
    return item.name_es?.trim() || item.name_en?.trim() || item.name?.trim() || 'Nombre no disponible';
  }
  
  return item.name_en?.trim() || item.name_es?.trim() || item.name?.trim() || 'Name not available';
}

/**
 * Purpose: Get localized equipment label.
 * Input: PlanItem, locale. Output: string.
 * Error handling: returns default label when equipment_type is missing.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getLocalizedEquipmentLabel(item: PlanItem | null | undefined, locale: SupportedLocale): string {
  if (!item) {
    return locale === 'es' ? 'Equipo no definido' : 'Equipment not defined';
  }
  
  const equipment = item.equipment_type?.trim();
  if (!equipment) {
    return locale === 'es' ? 'Equipo no definido' : 'Equipment not defined';
  }
  
  return equipment;
}

/**
 * Purpose: Get localized labels for PDF generation.
 * Input: locale. Output: object with all labels.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export function getPdfLabels(locale: SupportedLocale) {
  if (locale === 'es') {
    return {
      workoutPlan: 'Plan de Entrenamiento',
      client: 'Cliente',
      date: 'Fecha',
      objective: 'Objetivo',
      generalNotes: 'Notas Generales',
      session: 'Sesión',
      exercise: 'Ejercicio',
      equipment: 'Equipo',
      sets: 'Series',
      reps: 'Reps',
      rest: 'Descanso',
      weight: 'Peso',
      superset: 'Superserie',
      progressions: 'Progresiones',
      week: 'Semana',
      weeks: 'semanas',
      video: 'Ver video',
      noNotes: 'Sin notas',
      notes: 'Notas',
      generatedBy: 'Generado con',
      seconds: 's',
      kg: 'kg',
      trainer: 'Entrenador'
    };
  }
  
  return {
    workoutPlan: 'Workout Plan',
    client: 'Client',
    date: 'Date',
    objective: 'Objective',
    generalNotes: 'General Notes',
    session: 'Session',
    exercise: 'Exercise',
    equipment: 'Equipment',
    sets: 'Sets',
    reps: 'Reps',
    rest: 'Rest',
    weight: 'Weight',
    superset: 'Superset',
    progressions: 'Progressions',
    week: 'Week',
    weeks: 'weeks',
    video: 'Watch video',
    noNotes: 'No notes',
    notes: 'Notes',
    generatedBy: 'Generated with',
    seconds: 's',
    kg: 'kg',
    trainer: 'Trainer'
  };
}
