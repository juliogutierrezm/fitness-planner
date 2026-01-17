/**
 * Purpose: define planner progression types used by the planner module.
 * Input/Output: interfaces consumed by planner component and services.
 * Error handling: not applicable (type definitions only).
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface ProgressionWeek {
  week: number;
  title?: string;
  note: string;
}

export interface PlanProgressions {
  showProgressions: boolean;
  totalWeeks: number;
  weeks: ProgressionWeek[];
}
