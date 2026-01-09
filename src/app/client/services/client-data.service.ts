import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/* ============================
   Models
============================ */

export interface ClientProfile {
  userId: string;
  email?: string;
  name?: string;
  age?: number;
  injuries?: string[];
  // agrega solo campos que YA existan en Dynamo
}

export interface WorkoutSession {
  name: string;
  items: unknown[]; // luego lo tipamos mejor
}

export interface WorkoutPlan {
  planId: string;
  date?: string;
  name?: string;
  objective?: string;
  totalSessions?: number;

  /** Normalized */
  sessions?: WorkoutSession[];
}


export interface ClientDataResponse {
  user: ClientProfile;
  plans: WorkoutPlan[];
}

/* ============================
   Service
============================ */

@Injectable({ providedIn: 'root' })
export class ClientDataService {
  private readonly clientUrl = `${environment.apiBase}/clients`;

  constructor(private http: HttpClient) {}

  /**
   * Purpose: fetch authenticated client profile and workout plans.
   * Input: none (identity resolved by backend via Cognito sub).
   * Output: Observable<ClientDataResponse>.
   * Error handling: returns safe empty structure on errors.
   */

  getClientData(): Observable<ClientDataResponse> {
    return this.http.get<ClientDataResponse>(this.clientUrl).pipe(
      map(res => ({
        ...res,
        plans: this.normalizePlans(res.plans)
      })),
      catchError(() => of({ user: {} as any, plans: [] }))
    );
  }

  private normalizePlans(plans: any[]): WorkoutPlan[] {
  return (plans || []).map(plan => {
    let sessions: any[] = [];

    if (typeof plan.sessions === 'string') {
      try {
        sessions = JSON.parse(plan.sessions);
      } catch (e) {
        console.warn('[ClientDataService] Invalid sessions JSON', {
          planId: plan.planId || plan.SK,
          error: e
        });
      }
    } else if (Array.isArray(plan.sessions)) {
      sessions = plan.sessions;
    }

    return {
      ...plan,
      planId: plan.planId || plan.SK?.replace('PLAN#', ''),
      sessions
    };
  });
}


  /**
   * Convenience selector: only plans
   */
  getMyPlans(): Observable<WorkoutPlan[]> {
    return this.getClientData().pipe(map(res => res.plans || []));
  }

  /**
   * Convenience selector: only user profile
   */
  getMyProfile(): Observable<ClientProfile> {
    return this.getClientData().pipe(map(res => res.user));
  }

  /* ============================
     Timing helpers
  ============================ */

  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  private getElapsedMs(startedAt: number): number {
    const now = this.getNowMs();
    const elapsed = now - startedAt;
    return Number.isFinite(elapsed) ? Math.round(elapsed) : 0;
  }
}
