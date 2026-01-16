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

interface ExerciseLookup {
  plan: WorkoutPlan | null;
  session: WorkoutSession | null;
  exercise: SessionExercise | null;
}

/**
 * Purpose: render the detail view for a selected exercise.
 * Input: planId, sessionIndex, exerciseIndex route params. Output: UI rendering and navigation.
 * Error handling: shows snackbar on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-exercise-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './client-exercise-detail.component.html',
  styleUrls: ['./client-exercise-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientExerciseDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  exerciseMissing = false;
  planTitle = 'Plan de entrenamiento';
  sessionTitle = 'Sesion';
  exercise: SessionExercise | null = null;
  descriptionText = '';
  tips: string[] = [];
  mistakes: string[] = [];
  primaryMuscle: string | null = null;
  secondaryMuscles: string[] = [];
  previewUrl: string | null = null;
  youtubeUrl: string | null = null;

  private planId: string | null = null;
  private sessionIndex: number | null = null;
  private exerciseIndex: number | null = null;
  private imageError = false;
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize exercise detail loading.
   * Input: none. Output: void.
   * Error handling: handled in loadExercise with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadExercise();
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
   * Purpose: navigate back to the session exercises list.
   * Input: none. Output: void (navigation side effect).
   * Error handling: falls back to plan list when params are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    if (this.planId && this.sessionIndex !== null) {
      this.router.navigate(['/client/plans', this.planId, 'sessions', this.sessionIndex]);
      return;
    }
    this.router.navigate(['/client/plans']);
  }

  /**
   * Purpose: open the YouTube video in a new tab.
   * Input: none. Output: void (window side effect).
   * Error handling: shows snackbar when the URL is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openYoutube(): void {
    if (!this.youtubeUrl) {
      this.snackBar.open('No hay video de YouTube disponible.', 'Cerrar', { duration: 2500 });
      return;
    }
    window.open(this.youtubeUrl, '_blank', 'noopener');
  }

  /**
   * Purpose: return a readable exercise title.
   * Input: SessionExercise. Output: string.
   * Error handling: uses fallback when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getExerciseTitle(exercise: SessionExercise | null): string {
    const name = exercise?.name_es || exercise?.name;
    return name && name.trim().length > 0 ? name.trim() : 'Ejercicio';
  }

  /**
   * Purpose: format numbers or strings for display.
   * Input: unknown value. Output: string.
   * Error handling: returns '-' for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatValue(value: unknown): string {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? `${value}` : '-';
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return '-';
  }

  /**
   * Purpose: return a weight label only when data exists.
   * Input: unknown weight. Output: string | null.
   * Error handling: returns null for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getWeightValue(weight: unknown): string | null {
    if (typeof weight === 'number') {
      return Number.isFinite(weight) ? `${weight}` : null;
    }
    if (typeof weight === 'string') {
      const trimmed = weight.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  /**
   * Purpose: format rest values with seconds suffix.
   * Input: number | undefined. Output: string.
   * Error handling: returns '-' when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatRest(rest?: number): string {
    if (typeof rest === 'number' && Number.isFinite(rest)) {
      return `${rest}s`;
    }
    return '-';
  }

  /**
   * Purpose: flag image load failures for placeholder rendering.
   * Input: none. Output: void.
   * Error handling: ignores duplicate errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onImageError(): void {
    if (!this.imageError) {
      this.imageError = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Purpose: determine if the exercise has a usable thumbnail.
   * Input: SessionExercise | null. Output: boolean.
   * Error handling: returns false on missing or errored image.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  hasThumbnail(exercise: SessionExercise | null): boolean {
    return Boolean(exercise?.thumbnail) && !this.imageError;
  }

  /**
   * Purpose: load exercise detail based on route params.
   * Input: none. Output: void.
   * Error handling: logs and shows snackbar on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadExercise(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.cdr.markForCheck();

    this.route.paramMap
      .pipe(
        map(params => ({
          planId: params.get('planId'),
          sessionIndex: this.parseIndex(params.get('sessionIndex')),
          exerciseIndex: this.parseIndex(params.get('exerciseIndex'))
        })),
        take(1),
        switchMap(({ planId, sessionIndex, exerciseIndex }) => {
          this.planId = planId;
          this.sessionIndex = sessionIndex;
          this.exerciseIndex = exerciseIndex;
          if (!planId || sessionIndex === null || exerciseIndex === null) {
            return of(null);
          }
          return this.clientDataService.getMyPlans().pipe(
            map(plans => this.findExercise(plans, planId, sessionIndex, exerciseIndex))
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
        this.applyExerciseSnapshot(result);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply exercise lookup results into UI state.
   * Input: ExerciseLookup | null. Output: void.
   * Error handling: resets state when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyExerciseSnapshot(result: ExerciseLookup | null): void {
    if (!result?.plan || !result.session || !result.exercise) {
    this.exerciseMissing = true;
    this.exercise = null;
    this.descriptionText = '';
    this.tips = [];
    this.mistakes = [];
    this.primaryMuscle = null;
    this.secondaryMuscles = [];
    this.previewUrl = null;
    this.youtubeUrl = null;
    return;
  }

    this.exerciseMissing = false;
    this.exercise = result.exercise;
    this.planTitle = result.plan.objective || result.plan.name || 'Plan de entrenamiento';
    this.sessionTitle = this.getSessionTitle(result.session, this.sessionIndex ?? 0);
    this.descriptionText = this.getDescription(result.exercise);
    this.tips = this.normalizeTextList(result.exercise.tips);
    this.mistakes = this.normalizeTextList(result.exercise.common_mistakes);
    this.primaryMuscle = this.normalizeText(result.exercise.muscle_group);
    this.secondaryMuscles = this.normalizeTextList(result.exercise.secondary_muscles);
    this.previewUrl = result.exercise.preview_url || null;
    this.youtubeUrl = result.exercise.youtube_url || null;
  }

  /**
   * Purpose: locate a plan session and exercise from the plan list.
   * Input: plans, planId, sessionIndex, exerciseIndex. Output: ExerciseLookup.
   * Error handling: returns null values when not found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findExercise(
    plans: WorkoutPlan[],
    planId: string,
    sessionIndex: number,
    exerciseIndex: number
  ): ExerciseLookup {
    const plan = plans.find(item => item.planId === planId || item.SK === planId) || null;
    const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
    const session = sessionIndex >= 0 && sessionIndex < sessions.length ? sessions[sessionIndex] : null;
    const exercises = flattenSessionItems(session?.items);
    const exercise = exerciseIndex >= 0 && exerciseIndex < exercises.length ? exercises[exerciseIndex] : null;
    return { plan, session, exercise };
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
   * Purpose: parse route params to a safe index.
   * Input: string | null. Output: number | null.
   * Error handling: returns null for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private parseIndex(value: string | null): number | null {
    if (value === null) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  /**
   * Purpose: normalize description text for display.
   * Input: SessionExercise. Output: string.
   * Error handling: returns empty string when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getDescription(exercise: SessionExercise): string {
    const text = exercise?.description_es || exercise?.description_en || '';
    return typeof text === 'string' ? text.trim() : '';
  }

  /**
   * Purpose: normalize a label string.
   * Input: unknown. Output: string | null.
   * Error handling: returns null for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeText(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  /**
   * Purpose: normalize arrays of strings for list rendering.
   * Input: unknown. Output: string[].
   * Error handling: returns empty array for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeTextList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter(item => typeof item === 'string' && item.trim().length > 0).map(item => item.trim());
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }

  /**
   * Purpose: map exercise load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getExerciseErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer este ejercicio.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver este ejercicio.';
    if (status === 404) return 'No encontramos este ejercicio.';
    if (status >= 500) return 'El servidor no pudo entregar este ejercicio.';
    return 'No se pudo cargar el ejercicio. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for exercise load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientExerciseDetail] load failed', { elapsedMs, error });
    this.snackBar.open(this.getExerciseErrorMessage(error), 'Cerrar', { duration: 3500 });
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
