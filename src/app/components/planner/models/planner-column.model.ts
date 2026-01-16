/**
 * Purpose: describe planner column metadata for drag-drop connections.
 * Input/Output: consumed by planner services when needed.
 * Error handling: not applicable (type definitions only).
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface PlannerColumn {
  id: string;
  connectedTo: string[];
}
