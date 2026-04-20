import { AiStep } from './models';

export interface AiPipelineStepConfig {
  id: AiStep;
  message: string;
}

export const AI_PIPELINE_STEPS: readonly AiPipelineStepConfig[] = [
  {
    id: 'VALIDATING_INPUT',
    message: 'Analizando perfil del atleta'
  },
  {
    id: 'FILTERING_EXERCISES',
    message: 'Filtrando ejercicios compatibles'
  },
  {
    id: 'STRUCTURING_PLAN',
    message: 'Disenando estructura del plan'
  },
  {
    id: 'BUILDING_SESSION_STRUCTURE',
    message: 'Configurando sesiones'
  },
  {
    id: 'MATCHING_EXERCISES',
    message: 'Asignando ejercicios a cada entrenamiento'
  },
  {
    id: 'OPTIMIZING_LOAD',
    message: 'Optimizando volumen e intensidad'
  },
  {
    id: 'FINAL_VALIDATION',
    message: 'Validando plan final'
  }
] as const;
