import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MAX_AI_PLANS_PER_TRAINER, AiPlanQuota } from '../shared/ai-plan-limits';

export interface AiPlanSummary {
  executionId: string;
  createdAt: string;
  userId: string;
  trainerId?: string | null;
  companyId: string;
  source: 'AI';
  /** @deprecated planKey is a legacy S3 artifact, use executionId instead */
  planKey?: string;
  plan?: Record<string, unknown>;
}

export interface AiUserPlansResponse {
  scope: 'user';
  userId: string;
  totalPlans: number;
  plans: AiPlanSummary[];
}

export interface AiClientPlansSummary {
  clientId: string;
  clientName: string;
  email: string;
  trainerId?: string;
  companyId?: string;
  totalPlans: number;
  latestPlanDate?: string;
  plans: AiPlanSummary[];
}

/**
 * Response from /ai-plans/by-gym/{companyId} or /ai-plans/by-trainer/{trainerId}
 * Now returns a flat list of plans from DynamoDB
 */
export interface AiAggregateResponse {
  scope: 'gym' | 'trainer';
  scopeId: string;
  totalPlans: number;
  plans: AiPlanSummary[];
  /** @deprecated Use plans array and group by userId instead */
  totalClients?: number;
  /** @deprecated Use plans array and group by userId instead */
  totalClientsWithAIPlans?: number;
  /** @deprecated Use plans array and group by userId instead */
  clientsWithAIPlans?: AiClientPlansSummary[];
}

@Injectable({ providedIn: 'root' })
export class AiPlansService {
  private readonly baseUrl = `${environment.apiBase}/ai-plans`;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  getByUser(
    userId: string,
    opts: { limitPlans?: number; includePlanBodies?: boolean } = {}
  ): Observable<AiUserPlansResponse | null> {
    if (!userId) {
      this.openError('No se pudo cargar el historial: falta el usuario.');
      return of(null);
    }
    const params = this.buildParams({
      limitPlans: opts.limitPlans,
      includePlanBodies: opts.includePlanBodies
    });
    const url = `${this.baseUrl}/by-user/${encodeURIComponent(userId)}`;
    return this.http.get<AiUserPlansResponse>(url, { params }).pipe(
      tap(() => console.log('📊 Ai plans por usuario cargados')),
      catchError(err => this.handleError('No pudimos cargar los planes del cliente.', err))
    );
  }

  getByTrainer(
    trainerId: string,
    opts: { limitClients?: number; limitPlans?: number } = {}
  ): Observable<AiAggregateResponse | null> {
    if (!trainerId) {
      this.openError('No se pudo cargar el dashboard: falta el entrenador.');
      return of(null);
    }
    const params = this.buildParams({
      limitClients: opts.limitClients,
      limitPlans: opts.limitPlans
    });
    const url = `${this.baseUrl}/by-trainer/${encodeURIComponent(trainerId)}`;
    return this.http.get<AiAggregateResponse>(url, { params }).pipe(
      tap(() => console.log('📊 Ai plans por trainer cargados')),
      catchError(err => this.handleError('No pudimos cargar los datos del entrenador.', err))
    );
  }

  getByGym(
    companyId: string,
    opts: { limitClients?: number; limitPlans?: number } = {}
  ): Observable<AiAggregateResponse | null> {
    if (!companyId) {
      this.openError('No se pudo cargar el dashboard: falta el gym.');
      return of(null);
    }
    const params = this.buildParams({
      limitClients: opts.limitClients,
      limitPlans: opts.limitPlans
    });
    const url = `${this.baseUrl}/by-gym/${encodeURIComponent(companyId)}`;
    return this.http.get<AiAggregateResponse>(url, { params }).pipe(
      tap(() => console.log('📊 Ai plans por gym cargados')),
      catchError(err => this.handleError('No pudimos cargar los datos del gym.', err))
    );
  }

  /**
   * Fetch a single AI plan by executionId directly from DynamoDB.
   * Use this for detail views instead of searching through user plans.
   */
  getByExecutionId(
    executionId: string,
    opts: { includePlanBody?: boolean } = {}
  ): Observable<AiPlanSummary | null> {
    if (!executionId) {
      this.openError('No se pudo cargar el plan: falta el executionId.');
      return of(null);
    }
    let params = new HttpParams();
    if (opts.includePlanBody) {
      params = params.set('includePlanBody', 'true');
    }
    const url = `${this.baseUrl}/${encodeURIComponent(executionId)}`;
    return this.http.get<AiPlanSummary>(url, { params }).pipe(
      tap(() => console.log('📊 Ai plan por executionId cargado')),
      catchError(err => this.handleError('No pudimos cargar el plan IA.', err))
    );
  }

  /**
   * Purpose: compute AI plan quota for a trainer (used vs limit).
   * Input: trainerId. Output: Observable<AiPlanQuota>.
   * Error handling: returns a default quota (0 used) on failure so views remain functional.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTrainerQuota(trainerId: string): Observable<AiPlanQuota> {
    const fallback: AiPlanQuota = { used: 0, limit: MAX_AI_PLANS_PER_TRAINER, remaining: MAX_AI_PLANS_PER_TRAINER, limitReached: false };
    if (!trainerId) return of(fallback);

    return this.getByTrainer(trainerId).pipe(
      map(response => {
        const used = response?.totalPlans ?? 0;
        const limit = MAX_AI_PLANS_PER_TRAINER;
        const remaining = Math.max(0, limit - used);
        return { used, limit, remaining, limitReached: used >= limit } as AiPlanQuota;
      }),
      catchError(() => of(fallback))
    );
  }

  private buildParams(opts: {
    limitPlans?: number;
    includePlanBodies?: boolean;
    limitClients?: number;
  }): HttpParams {
    let params = new HttpParams();
    if (typeof opts.limitPlans === 'number') {
      params = params.set('limitPlans', opts.limitPlans.toString());
    }
    if (typeof opts.limitClients === 'number') {
      params = params.set('limitClients', opts.limitClients.toString());
    }
    if (typeof opts.includePlanBodies === 'boolean') {
      params = params.set('includePlanBodies', String(opts.includePlanBodies));
    }
    return params;
  }

  private handleError(message: string, error: any): Observable<null> {
    console.error(message, error);
    this.openError(message);
    return of(null);
  }

  private openError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
}