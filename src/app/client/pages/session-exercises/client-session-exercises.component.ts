import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan, WorkoutSession } from '../../services/client-data.service';
import { SessionExercise, flattenSessionItems } from '../../utils/session-exercise.utils';

interface SessionLookup {
  plan: WorkoutPlan | null;
  session: WorkoutSession | null;
}

/**
 * Purpose: render the exercises list for a selected session.
 * Input: planId and sessionIndex route params. Output: UI rendering and navigation.
 * Error handling: shows snackbar on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-session-exercises',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './client-session-exercises.component.html',
  styleUrls: ['./client-session-exercises.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientSessionExercisesComponent implements OnInit, OnDestroy {
  isLoading = false;
  planTitle = 'Plan de entrenamiento';
  sessionTitle = 'Sesion';
  sessionMissing = false;
  exercises: SessionExercise[] = [];

  private planId: string | null = null;
  private sessionIndex: number | null = null;
  private readonly imageErrors = new Set<number>();
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize session exercise loading.
   * Input: none. Output: void.
   * Error handling: handled in loadSession with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadSession();
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
   * Purpose: navigate back to the plan detail view.
   * Input: none. Output: void (navigation side effect).
   * Error handling: falls back to plan list when plan id is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    if (this.planId) {
      this.router.navigate(['/client/plans', this.planId]);
      return;
    }
    this.router.navigate(['/client/plans']);
  }

  /**
   * Purpose: open the selected exercise detail view.
   * Input: index. Output: void (navigation side effect).
   * Error handling: shows snackbar when routing params are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openExercise(index: number): void {
    if (!this.planId || this.sessionIndex === null) {
      this.snackBar.open('No pudimos abrir este ejercicio.', 'Cerrar', { duration: 3500 });
      return;
    }

    this.router.navigate(['/client/plans', this.planId, 'sessions', this.sessionIndex, 'exercises', index]);
  }

  /**
   * Purpose: support keyboard activation on exercise cards.
   * Input: KeyboardEvent and index. Output: void.
   * Error handling: guards against unrelated keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onExerciseKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openExercise(index);
    }
  }

  /**
   * Purpose: build an accessible label for exercise cards.
   * Input: SessionExercise and index. Output: string.
   * Error handling: uses safe fallbacks.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getExerciseAriaLabel(exercise: SessionExercise, index: number): string {
    const title = this.getExerciseTitle(exercise, index);
    return `Abrir ejercicio ${title}`;
  }

  /**
   * Purpose: return the exercise title with safe fallback.
   * Input: SessionExercise and index. Output: string.
   * Error handling: uses default label when names are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getExerciseTitle(exercise: SessionExercise, index: number): string {
    const name = exercise?.name_es || exercise?.name;
    return name && name.trim().length > 0 ? name.trim() : `Ejercicio ${index + 1}`;
  }

  /**
   * Purpose: format programming line for list display.
   * Input: SessionExercise. Output: string.
   * Error handling: uses placeholders for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getProgrammingLine(exercise: SessionExercise): string {
    const sets = this.formatValue(exercise?.sets);
    const reps = this.formatValue(exercise?.reps);
    const rest = this.formatRest(exercise?.rest);
    const equipment = this.getEquipmentLabel(exercise);
    return `${sets} x ${reps} · ${rest} · ${equipment}`;
  }

  /**
   * Purpose: return the primary muscle group label if available.
   * Input: SessionExercise. Output: string | null.
   * Error handling: returns null when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getExerciseMuscleLabel(exercise: SessionExercise): string | null {
    const muscle = exercise?.muscle_group;
    return muscle && muscle.trim().length > 0 ? muscle.trim() : null;
  }

  /**
   * Purpose: provide a stable trackBy key for exercise rendering.
   * Input: index and exercise. Output: string.
   * Error handling: falls back to index when id is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByExercise = (index: number, exercise: SessionExercise): string => {
    return exercise?.id || `${index}`;
  };

  /**
   * Purpose: flag image load failures for placeholder rendering.
   * Input: index. Output: void.
   * Error handling: ignores duplicate errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onImageError(index: number): void {
    if (!this.imageErrors.has(index)) {
      this.imageErrors.add(index);
      this.cdr.markForCheck();
    }
  }

  /**
   * Purpose: determine if an exercise has a usable thumbnail.
   * Input: SessionExercise and index. Output: boolean.
   * Error handling: returns false on missing or errored image.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  hasThumbnail(exercise: SessionExercise, index: number): boolean {
    return Boolean(exercise?.thumbnail) && !this.imageErrors.has(index);
  }

  /**
   * Purpose: load session exercises based on route params.
   * Input: none. Output: void.
   * Error handling: logs and shows snackbar on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadSession(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.cdr.markForCheck();

    this.route.paramMap
      .pipe(
        map(params => ({
          planId: params.get('planId'),
          sessionIndex: this.parseSessionIndex(params.get('sessionIndex'))
        })),
        take(1),
        switchMap(({ planId, sessionIndex }) => {
          this.planId = planId;
          this.sessionIndex = sessionIndex;
          if (!planId || sessionIndex === null) {
            return of(null);
          }
          return this.clientDataService.getMyPlans().pipe(
            map(plans => this.findSession(plans, planId, sessionIndex))
          );
        }),
        catchError(error => {
          this.handleLoadError(error, startedAt);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(result => {
        this.applySessionSnapshot(result);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply session lookup results into UI state.
   * Input: SessionLookup | null. Output: void.
   * Error handling: sets missing state on null result.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applySessionSnapshot(result: SessionLookup | null): void {
    if (!result?.plan || !result.session) {
      this.sessionMissing = true;
      this.exercises = [];
      this.sessionTitle = 'Sesion';
      return;
    }

    this.sessionMissing = false;
    this.planTitle = result.plan.objective || result.plan.name || 'Plan de entrenamiento';
    this.sessionTitle = this.getSessionTitle(result.session, this.sessionIndex ?? 0);
    this.exercises = flattenSessionItems(result.session.items);
  }

  /**
   * Purpose: locate a plan and session from the plan list.
   * Input: plans, planId, sessionIndex. Output: SessionLookup.
   * Error handling: returns null values when not found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findSession(plans: WorkoutPlan[], planId: string, sessionIndex: number): SessionLookup {
    const plan = plans.find(item => item.planId === planId || item.SK === planId) || null;
    const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
    const session = sessionIndex >= 0 && sessionIndex < sessions.length ? sessions[sessionIndex] : null;
    return { plan, session };
  }

  /**
   * Purpose: build a fallback session title.
   * Input: WorkoutSession and index. Output: string.
   * Error handling: uses default label when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getSessionTitle(session: WorkoutSession, index: number): string {
    const name = session?.name?.trim();
    return name && name.length > 0 ? name : `Sesion ${index + 1}`;
  }

  /**
   * Purpose: parse route param to a safe session index.
   * Input: string | null. Output: number | null.
   * Error handling: returns null for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private parseSessionIndex(value: string | null): number | null {
    if (value === null) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  /**
   * Purpose: provide an equipment label for programming line.
   * Input: SessionExercise. Output: string.
   * Error handling: returns a neutral fallback when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getEquipmentLabel(exercise: SessionExercise): string {
    return exercise?.equipment_type || exercise?.equipment_specific || 'Peso';
  }

  /**
   * Purpose: format numbers or strings for display.
   * Input: unknown value. Output: string.
   * Error handling: returns '-' for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? `${value}` : '-';
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return '-';
  }

  /**
   * Purpose: format rest values with seconds suffix.
   * Input: number | undefined. Output: string.
   * Error handling: returns '-' when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private formatRest(rest?: number): string {
    if (typeof rest === 'number' && Number.isFinite(rest)) {
      return `${rest}s`;
    }
    return '-';
  }

  /**
   * Purpose: map session load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getSessionErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer esta sesion.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver esta sesion.';
    if (status === 404) return 'No encontramos esta sesion.';
    if (status >= 500) return 'El servidor no pudo entregar esta sesion.';
    return 'No se pudo cargar la sesion. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for session load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientSessionExercises] load failed', { elapsedMs, error });
    this.snackBar.open(this.getSessionErrorMessage(error), 'Cerrar', { duration: 3500 });
  }

  /**
   * Purpose: return a monotonic timestamp for elapsed time logging.
   * Input: none. Output: number (ms).
   * Error handling: falls back to Date.now when performance is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
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
