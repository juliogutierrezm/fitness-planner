/* ---------- Ejercicio base ---------- */
export interface Exercise {
  id: string;
  name: string;
  name_es?: string;
  name_en?: string;
  equipment: string;
  equipment_type?: string;
  equipment_specific?: string;
  muscle?: string;
  muscle_group?: string;
  secondary_muscles?: string[];
  category?: string;
  exercise_type?: string;
  difficulty?: string;
  training_goal?: string;
  description_es?: string;
  description_en?: string;
  common_mistakes?: string[];
  tips?: string[];
  functional?: boolean;
  plane_of_motion?: string;
  movement_pattern?: string;
  aliases?: string[];
  preview_url?: string;
  youtube_url?: string;
  thumbnail?: string;
  gif_url?: string;
  process_status?: string;
  created_at?: string;
  updated_at?: string;
  s3_key?: string;
}

export interface PlanItem {
  id: string;
  name: string;
  equipment: string;
  sets: number;
  reps: number | string;
  rest: number;
  notes?: string;
  selected?: boolean;
  isGroup?: boolean;
  children?: PlanItem[];
}


/* ---------- Sesión ---------- */
export interface Session {
  id: number;
  name: string;
  items: PlanItem[];
  collapsed?: boolean;
}

/* ---------- Plan completo ---------- */
export interface WorkoutPlan {
  id: string;
  name: string;
  date: string;
  sessions: Session[];

  generalNotes?: string;
  objective?: string;
  companyId?: string;
  trainerId?: string;
}

/* ---------- Exercise Manager Component Interfaces ---------- */

export interface ExerciseFilters {
  searchValue: string;
  categoryFilter: string;
  muscleGroupFilter: string;
  equipmentTypeFilter: string;
}

export interface FilterOptions {
  categoryOptions: string[];
  muscleGroupOptions: string[];
  equipmentTypeOptions: string[];
}

export interface ExerciseTableEvent {
  action: 'edit' | 'open_video';
  exercise: Exercise;
}

export interface PaginatorState {
  pageIndex: number;
  pageSize: number;
}
