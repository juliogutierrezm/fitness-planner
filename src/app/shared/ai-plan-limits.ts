/**
 * Purpose: centralise AI plan quota constants shared across trainer-facing views.
 * Input/Output: none – pure constants.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */

/** Maximum AI-generated plans a trainer can create (trial version). */
export const MAX_AI_PLANS_PER_TRAINER = 30;

/** Quota snapshot used by planner, dashboard, and admin views. */
export interface AiPlanQuota {
  used: number;
  limit: number;
  remaining: number;
  limitReached: boolean;
}
