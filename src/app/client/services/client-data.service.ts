import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/* ============================
   Models
============================ */

export interface ClientProfile {
  id?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  age?: number;
  dateOfBirth?: string;
  injuries?: string | string[];
  noInjuries?: boolean;
  trainerId?: string;
  trainerName?: string;
}

export interface WorkoutSession {
  name?: string;
  items?: unknown[]; // TODO: type exercises when contracts are available.
}

export interface PlanProgressionWeek {
  week: number;
  title?: string;
  note: string;
}

export interface PlanProgressions {
  showProgressions: boolean;
  totalWeeks: number;
  weeks: PlanProgressionWeek[];
}

export interface WorkoutPlan {
  planId?: string;
  SK?: string;
  date?: string;
  objective?: string;
  totalSessions?: number;
  name?: string;
  sessions?: WorkoutSession[];
  trainerName?: string;
  progressions?: PlanProgressions | null;
}


export interface ClientDataResponse {
  user: ClientProfile;
  plans: WorkoutPlan[];
  trainerName?: string;
}

/* ============================
   Service
============================ */

/**
 * Purpose: centralize client data retrieval and normalization from /clients.
 * Input: none (service). Output: cached observables for profile and plans.
 * Error handling: logs failures and returns safe fallback structures.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class ClientDataService {
  private readonly clientUrl = `${environment.apiBase}/clients`;
  private clientData$?: Observable<ClientDataResponse>;

  constructor(private http: HttpClient) {}

  /**
   * Purpose: fetch authenticated client profile and workout plans.
   * Input: none (identity resolved by backend via Cognito sub).
   * Output: Observable<ClientDataResponse>.
   * Error handling: returns safe empty structure on errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getClientData(): Observable<ClientDataResponse> {
    if (this.clientData$) {
      return this.clientData$;
    }

    const startedAt = this.getNowMs();
    this.clientData$ = this.http.get<ClientDataResponse>(this.clientUrl).pipe(
      map(res => {
        const user = res?.user || ({} as ClientProfile);
        const trainerName = user.trainerName || res?.trainerName || '';
        return {
          user: {
            ...user,
            trainerName
          },
          plans: this.normalizePlans(res?.plans || [])
        };
      }),
      catchError(error => {
        const elapsedMs = this.getElapsedMs(startedAt);
        console.error('[ClientDataService] getClientData failed', { elapsedMs, error });
        return of({ user: {} as ClientProfile, plans: [] });
      }),
      shareReplay(1)
    );

    return this.clientData$;
  }

  /**
   * Purpose: normalize raw plan payloads and parse serialized sessions/progressions.
   * Input: raw plan list (sessions or progressions may be stringified JSON).
   * Output: WorkoutPlan[] with sessions and progressions normalized.
   * Error handling: logs parse failures and falls back to safe defaults.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizePlans(plans: Array<Omit<WorkoutPlan, 'sessions'> & { sessions?: unknown }>): WorkoutPlan[] {
    return (plans || []).map(plan => {
      let sessions: WorkoutSession[] = [];
      const progressions = this.normalizeProgressions(plan?.progressions);

      if (typeof plan?.sessions === 'string') {
        try {
          const parsed = JSON.parse(plan.sessions);
          sessions = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.warn('[ClientDataService] Invalid sessions JSON', {
            planId: plan?.planId || plan?.SK,
            error
          });
        }
      } else if (Array.isArray(plan?.sessions)) {
        sessions = plan.sessions;
      }

      return {
        ...plan,
        planId: plan?.planId,
        sessions,
        progressions
      };
    });
  }

  /**
   * Purpose: normalize a plan progressions payload that may arrive as JSON.
   * Input: unknown progressions payload. Output: PlanProgressions | null.
   * Error handling: logs parse failures and returns null for invalid inputs.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeProgressions(progressions: unknown): PlanProgressions | null {
    if (!progressions) {
      return null;
    }
    if (typeof progressions === 'string') {
      try {
        const parsed = JSON.parse(progressions);
        return parsed && typeof parsed === 'object' ? (parsed as PlanProgressions) : null;
      } catch (error) {
        console.warn('[ClientDataService] Invalid progressions JSON', { error });
        return null;
      }
    }
    if (typeof progressions === 'object') {
      return progressions as PlanProgressions;
    }
    return null;
  }


  /**
   * Purpose: select workout plans from cached client data.
   * Input: none. Output: Observable<WorkoutPlan[]>.
   * Error handling: delegated to getClientData fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getMyPlans(): Observable<WorkoutPlan[]> {
    return this.getClientData().pipe(map(res => res.plans || []));
  }

  /**
   * Purpose: select profile data from cached client data.
   * Input: none. Output: Observable<ClientProfile>.
   * Error handling: delegated to getClientData fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getMyProfile(): Observable<ClientProfile> {
    return this.getClientData().pipe(map(res => res.user));
  }

  /* ============================
     Timing helpers
  ============================ */

  /**
   * Purpose: return a monotonic timestamp for elapsed time logging.
   * Input: none. Output: number (ms).
   * Error handling: falls back to Date.now when performance is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  /**
   * Purpose: compute elapsed milliseconds from a start timestamp.
   * Input: start time. Output: elapsed ms (rounded).
   * Error handling: guards against invalid timestamps.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getElapsedMs(startedAt: number): number {
    const now = this.getNowMs();
    const elapsed = now - startedAt;
    return Number.isFinite(elapsed) ? Math.round(elapsed) : 0;
  }
}
