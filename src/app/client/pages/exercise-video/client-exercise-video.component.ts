import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan, WorkoutSession } from '../../services/client-data.service';
import { SessionExercise, flattenSessionItems } from '../../utils/session-exercise.utils';

interface VideoLookup {
  plan: WorkoutPlan | null;
  session: WorkoutSession | null;
  exercise: SessionExercise | null;
}

/**
 * Purpose: render a dedicated exercise video view.
 * Input: planId, sessionIndex, exerciseIndex route params. Output: video playback UI.
 * Error handling: shows snackbar on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-exercise-video',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './client-exercise-video.component.html',
  styleUrls: ['./client-exercise-video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientExerciseVideoComponent implements OnInit, OnDestroy {
  isLoading = false;
  videoMissing = false;
  exerciseTitle = 'Ejercicio';
  videoUrl: string | null = null;
  embedUrl: SafeResourceUrl | null = null;

  private planId: string | null = null;
  private sessionIndex: number | null = null;
  private exerciseIndex: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize exercise video loading.
   * Input: none. Output: void.
   * Error handling: handled in loadVideo with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadVideo();
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
   * Purpose: navigate back to the exercise detail view.
   * Input: none. Output: void (navigation side effect).
   * Error handling: falls back to plan list when params are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    if (this.planId && this.sessionIndex !== null && this.exerciseIndex !== null) {
      this.router.navigate([
        '/client/plans',
        this.planId,
        'sessions',
        this.sessionIndex,
        'exercises',
        this.exerciseIndex
      ]);
      return;
    }
    this.router.navigate(['/client/plans']);
  }

  /**
   * Purpose: indicate if the current video is a YouTube embed.
   * Input: none. Output: boolean.
   * Error handling: returns false when embed url is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  isYoutube(): boolean {
    return Boolean(this.embedUrl);
  }

  /**
   * Purpose: load exercise video data based on route params.
   * Input: none. Output: void.
   * Error handling: logs and shows snackbar on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadVideo(): void {
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
        this.applyVideoSnapshot(result);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply exercise lookup results into UI state.
   * Input: VideoLookup | null. Output: void.
   * Error handling: resets state when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyVideoSnapshot(result: VideoLookup | null): void {
    if (!result?.exercise) {
      this.videoMissing = true;
      this.videoUrl = null;
      this.embedUrl = null;
      return;
    }

    this.videoMissing = false;
    this.exerciseTitle = this.getExerciseTitle(result.exercise);
    this.embedUrl = this.buildEmbedUrl(result.exercise.youtube_url);
    const previewUrl = result.exercise.preview_url || null;
    if (this.embedUrl) {
      this.videoUrl = result.exercise.youtube_url || null;
      return;
    }
    this.videoUrl = previewUrl || result.exercise.youtube_url || null;
  }

  /**
   * Purpose: locate a plan session and exercise from the plan list.
   * Input: plans, planId, sessionIndex, exerciseIndex. Output: VideoLookup.
   * Error handling: returns null values when not found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findExercise(
    plans: WorkoutPlan[],
    planId: string,
    sessionIndex: number,
    exerciseIndex: number
  ): VideoLookup {
    const plan = plans.find(item => item.planId === planId || item.SK === planId) || null;
    const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
    const session = sessionIndex >= 0 && sessionIndex < sessions.length ? sessions[sessionIndex] : null;
    const exercises = flattenSessionItems(session?.items);
    const exercise = exerciseIndex >= 0 && exerciseIndex < exercises.length ? exercises[exerciseIndex] : null;
    return { plan, session, exercise };
  }

  /**
   * Purpose: build a safe YouTube embed url for the video player.
   * Input: raw youtube url. Output: SafeResourceUrl | null.
   * Error handling: returns null when parsing fails.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildEmbedUrl(url?: string): SafeResourceUrl | null {
    if (!url) {
      return null;
    }
    const videoId = this.extractYoutubeId(url);
    if (!videoId) {
      return null;
    }
    const embed = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embed);
  }

  /**
   * Purpose: extract a YouTube video id from common url formats.
   * Input: string. Output: string | null.
   * Error handling: returns null on invalid formats.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private extractYoutubeId(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    const watchMatch = trimmed.match(/[?&]v=([^&]+)/);
    if (watchMatch?.[1]) {
      return watchMatch[1];
    }

    const shortMatch = trimmed.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch?.[1]) {
      return shortMatch[1];
    }

    const embedMatch = trimmed.match(/youtube\.com\/embed\/([^?&]+)/);
    if (embedMatch?.[1]) {
      return embedMatch[1];
    }

    return null;
  }

  /**
   * Purpose: return a readable exercise title.
   * Input: SessionExercise. Output: string.
   * Error handling: uses fallback when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getExerciseTitle(exercise: SessionExercise | null): string {
    const name = exercise?.name_es || exercise?.name;
    return name && name.trim().length > 0 ? name.trim() : 'Ejercicio';
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
   * Purpose: map video load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getVideoErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer este video.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver este video.';
    if (status === 404) return 'No encontramos este video.';
    if (status >= 500) return 'El servidor no pudo entregar este video.';
    return 'No se pudo cargar el video. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for video load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientExerciseVideo] load failed', { elapsedMs, error });
    this.snackBar.open(this.getVideoErrorMessage(error), 'Cerrar', { duration: 3500 });
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
