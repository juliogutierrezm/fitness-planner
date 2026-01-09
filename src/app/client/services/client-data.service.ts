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
}

export interface WorkoutSession {
  name?: string;
  items?: unknown[]; // TODO: type exercises when contracts are available.
}

export interface WorkoutPlan {
  planId?: string;
  SK?: string;
  date?: string;
  objective?: string;
  totalSessions?: number;
  name?: string;
  sessions?: WorkoutSession[];
}


export interface ClientDataResponse {
  user: ClientProfile;
  plans: WorkoutPlan[];
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
      map(res => ({
        user: res?.user || ({} as ClientProfile),
        plans: this.normalizePlans(res?.plans || [])
      })),
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
   * Purpose: normalize raw plan payloads and parse serialized sessions.
   * Input: raw plan list (sessions may be stringified JSON).
   * Output: WorkoutPlan[] with sessions normalized to arrays.
   * Error handling: logs parse failures and falls back to empty sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizePlans(plans: Array<Omit<WorkoutPlan, 'sessions'> & { sessions?: unknown }>): WorkoutPlan[] {
    return (plans || []).map(plan => {
      let sessions: WorkoutSession[] = [];

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
        sessions
      };
    });
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
