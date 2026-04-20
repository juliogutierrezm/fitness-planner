/**
 * Purpose: centralize training method metadata for AI plan generation prompts.
 * Input/Output: static dictionary keyed by method identifier.
 * Error handling: N/A (static configuration).
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */

export type TrainingMethod =
  | 'standard'
  | 'pyramid'
  | 'reverse_pyramid'
  | 'superset'
  | 'giant_set'
  | 'drop_set'
  | 'circuit'
  | 'emom'
  | 'amrap'
  | 'cluster'
  | 'contrast'
  | 'interval'
  | 'steady_state';

export interface TrainingMethodDefinition {
  description: string;
}

export const TRAINING_METHODS: Record<TrainingMethod, TrainingMethodDefinition> = {
  standard: {
    description: 'Traditional straight sets with consistent reps and rest.'
  },
  pyramid: {
    description: 'Progressively increase load while reducing repetitions each set.'
  },
  reverse_pyramid: {
    description: 'Start with the heaviest set, then reduce load and increase reps.'
  },
  superset: {
    description: 'Pair two exercises back-to-back with minimal rest.'
  },
  giant_set: {
    description: 'Perform three or more exercises consecutively for one muscle focus.'
  },
  drop_set: {
    description: 'Continue a set after reducing weight to extend time under tension.'
  },
  circuit: {
    description: 'Sequence multiple exercises in rounds with limited rest.'
  },
  emom: {
    description: 'Execute target work every minute on the minute.'
  },
  amrap: {
    description: 'Complete as many rounds or reps as possible in a fixed time.'
  },
  cluster: {
    description: 'Break heavy sets into short mini-sets with brief intra-set rest.'
  },
  contrast: {
    description: 'Alternate heavy strength work with explosive movement patterns.'
  },
  interval: {
    description: 'Alternate high and low effort periods to improve conditioning.'
  },
  steady_state: {
    description: 'Sustain continuous moderate effort for a defined duration.'
  }
};
