import { TrainingMethod } from './training-methods.config';

/**
 * Purpose: declare canonical training goals and AI-oriented profile metadata.
 * Input/Output: static typed configuration consumed by planner components/services.
 * Error handling: N/A (static configuration).
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */

export enum TrainingGoal {
  HYPERTROPHY = 'HYPERTROPHY',
  WEIGHT_LOSS = 'WEIGHT_LOSS',
  ENDURANCE = 'ENDURANCE',
  POWER = 'POWER',
  CARDIO = 'CARDIO'
}

export type PreferredExerciseType = 'compound' | 'mixed';

export interface TrainingGoalProfile {
  repRange: string;
  rest: string;
  volume: 'low' | 'high' | 'very_high';
  intensity: 'low-moderate' | 'moderate' | 'moderate-high' | 'very_high';
  preferredExerciseType: PreferredExerciseType;
  allowedTrainingMethods: TrainingMethod[];
}

export const GOAL_PROFILE: Record<TrainingGoal, TrainingGoalProfile> = {
  [TrainingGoal.HYPERTROPHY]: {
    repRange: '6-12',
    rest: '60-90s',
    volume: 'high',
    intensity: 'moderate-high',
    preferredExerciseType: 'compound',
    allowedTrainingMethods: ['standard', 'superset', 'pyramid', 'drop_set']
  },
  [TrainingGoal.WEIGHT_LOSS]: {
    repRange: '12-20',
    rest: '30-45s',
    volume: 'high',
    intensity: 'moderate',
    preferredExerciseType: 'mixed',
    allowedTrainingMethods: ['circuit', 'superset', 'emom']
  },
  [TrainingGoal.ENDURANCE]: {
    repRange: '15-25',
    rest: '20-40s',
    volume: 'very_high',
    intensity: 'low-moderate',
    preferredExerciseType: 'mixed',
    allowedTrainingMethods: ['circuit', 'amrap', 'emom']
  },
  [TrainingGoal.POWER]: {
    repRange: '3-5',
    rest: '2-3m',
    volume: 'low',
    intensity: 'very_high',
    preferredExerciseType: 'compound',
    allowedTrainingMethods: ['contrast', 'cluster', 'standard']
  },
  [TrainingGoal.CARDIO]: {
    repRange: 'time_based',
    rest: 'variable',
    volume: 'high',
    intensity: 'moderate-high',
    preferredExerciseType: 'mixed',
    allowedTrainingMethods: ['interval', 'steady_state', 'circuit']
  }
};

export function getGoalProfile(goal: TrainingGoal): TrainingGoalProfile {
  return GOAL_PROFILE[goal];
}

export function getAllowedTrainingMethods(goal: TrainingGoal): TrainingMethod[] {
  return GOAL_PROFILE[goal].allowedTrainingMethods;
}
