//   src/app/shared/models.ts
export interface Exercise {
  id: number;
  name: string;
  equipment: string;
}

export interface PlanItem extends Exercise {
  sets: number;
  reps: number;
  rest: number;
  selected?: boolean;
  supersetId?: number;  // nuevo campo para indicar pertenencia
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

export interface PlanItem {
  id: number;
  name: string;
  equipment: string;
  sets: number;
  reps: number;
  rest: number;
  selected?: boolean;
  isGroup?: boolean;
  children?: PlanItem[];
  notes?: string; // 🆕 nueva propiedad
}

