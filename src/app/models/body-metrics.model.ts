/**
 * Purpose: typed DTOs for client body composition metrics used across UI and services.
 * Input/Output: defines the payload and series shape for metrics history.
 * Error handling: not applicable (type-only module).
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface ClientBodyMetric {
  measurementDate: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercentage?: number;
  muscleMassKg?: number;
  musclePercentage?: number;
  visceralFatLevel?: number;
  bmi?: number;
  basalMetabolicRate?: number;
  metabolicAge?: number;
}

export type ClientBodyMetricNumericKey = Exclude<keyof ClientBodyMetric, 'measurementDate'>;

export interface BodyMetricPoint {
  date: string;
  value: number;
}

export interface BodyMetricSeries {
  key: ClientBodyMetricNumericKey;
  label: string;
  unit: string;
  points: BodyMetricPoint[];
}
