/* ---------- Ejercicio base ---------- */
export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  muscle?: string;
  category?: string;
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
  pinned?: boolean;
  collapsed?: boolean;
}

/* ---------- Plan completo ---------- */
export interface WorkoutPlan {
  id: string;
  name: string;
  date: string;
  sessions: Session[];

  generalNotes?: string;
  companyId?: string;
  trainerId?: string;
}
