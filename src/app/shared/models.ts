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
  name_es?: string;
  equipment?: string;
  equipment_type?: string;
  notes?: string;
  sets: number;
  reps: number | string;
  rest: number;
  weight?: number;
  selected?: boolean;
  // Legacy grouping (will be phased out)
  isGroup?: boolean;
  children?: PlanItem[];
  // New flattened grouping flags
  isGroupHeader?: boolean; // true only for virtual header rows
  isChild?: boolean;       // true for items belonging to a group
  groupId?: string;        // identifier shared by header and its children
  // Video fields for consistency with Exercise
  preview_url?: string;
  thumbnail?: string;
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

/* ---------- AI Plan Generation ---------- */
export interface AiPlanRequest {
  gender: string;
  difficulty: string;
  trainingGoal: string;
  totalSessions: number;
  sessionDuration: number;
  availableEquipment: string[];
  excludeMuscles: string[];
  includeSupersets: boolean;
  includeMobility: boolean;
  expectedExercisesPerSession: number;
  sessionBlueprint: {
    name: string;
    targets: string[];
  }[];
  generalNotes: string;
  userId?: string;
  age?: number;
  userContext?: {
    injuries?: string;
    notes?: string;
  };
}

export type AiStep =
  | 'VALIDATING_INPUT'
  | 'FILTERING_EXERCISES'
  | 'STRUCTURING_PLAN'
  | 'MATCHING_EXERCISES'
  | 'OPTIMIZING_LOAD'
  | 'FINAL_VALIDATION';

export type PollingResponse =
  | { status: 'IN_PROGRESS'; currentStep: AiStep; updatedAt: string }
  | { status: 'COMPLETED'; plan: WorkoutPlan }
  | { status: 'PENDING' };

/* ---------- Exercise Manager Component Interfaces ---------- */

export interface ExerciseFilters {
  searchValue: string;
  categoryFilter: string;
  muscleGroupFilter: string;
  equipmentTypeFilter: string;
  functionalOnly?: boolean;
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
