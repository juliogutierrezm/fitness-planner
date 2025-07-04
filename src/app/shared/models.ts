// Modelo base de ejercicio que usás en el planner
export interface Exercise {
  id: number;
  name: string;
  equipment: string;
}

// Elemento dentro de una sesión de entrenamiento (basado en un ejercicio)
export interface PlanItem extends Exercise {
  sets: number;
  reps: number;
  rest: number;    // en segundos
  weight?: number; // opcional
}

// Una sesión de entrenamiento (por ejemplo, Día 1, Día 2...)
export interface Session {
  id: number;
  name: string;
  items: PlanItem[];
}

// Un plan completo con múltiples sesiones (por ahora no se usa, pero es útil)
export interface WorkoutPlan {
  id: number;
  name: string;
  sessions: Session[];
}

// Equipamiento disponible (usado para mapear IDs a nombres)
export interface EquipmentItem {
  id: number;
  name: string;
}

// Ejercicio según la API de WGER (con traducciones y equipo en IDs)
export interface WgerExercise {
  id: number;
  equipment: number[];
  translations: {
    id: number;
    language: number; // 2 = Español
    name: string;
    description: string;
  }[];
}
