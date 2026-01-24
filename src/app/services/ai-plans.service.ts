import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AiPlanSummary {
  executionId: string;
  createdAt: string;
  planKey: string;
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

export interface AiAggregateResponse {
  scope: 'gym' | 'trainer';
  scopeId: string;
  totalClients: number;
  totalClientsWithAIPlans: number;
  clientsWithAIPlans: AiClientPlansSummary[];
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