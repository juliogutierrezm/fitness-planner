import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan } from '../../services/client-data.service';


@Component({
  selector: 'app-client-plans',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './client-plans.component.html',
  styleUrls: ['./client-plans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientPlansComponent implements OnInit, OnDestroy {
  plans: WorkoutPlan[] = [];
  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private cdr: ChangeDetectorRef
  ) {}


  /**
   * Purpose: initialize client plans list loading.
   * Input: none. Output: void.
   * Error handling: handled in loadPlans with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadPlans();
  }

  /**
   * Purpose: clean up subscriptions on component destroy.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: return the session count for a workout plan.
   * Input: WorkoutPlan. Output: number.
   * Error handling: returns 0 for missing sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionCount(plan: WorkoutPlan): number {
    if (typeof plan?.totalSessions === 'number') {
      return plan.totalSessions;
    }
    return Array.isArray(plan?.sessions) ? plan.sessions.length : 0;
  }

  /**
   * Purpose: provide a stable trackBy key for plan rendering.
   * Input: index and plan. Output: string key.
   * Error handling: falls back to index when identifiers are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByPlan(index: number, plan: WorkoutPlan): string {
    return plan?.planId || `${index}`;
  }

  /**
   * Purpose: load workout plans for the authenticated client.
   * Input: none. Output: void.
   * Error handling: logs and falls back to empty list.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadPlans(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.clientDataService.getMyPlans()
      .pipe(
        catchError(error => {
          console.error('[ClientPlans] load failed', { error });
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(plans => {
        this.plans = plans ?? [];
        this.cdr.markForCheck();
      });
  }

}
