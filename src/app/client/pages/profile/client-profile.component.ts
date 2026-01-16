import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ClientDataService, ClientProfile } from '../../services/client-data.service';

/**
 * Purpose: Render the client profile screen with data from /clients.
 * Input: none. Output: UI rendering and navigation side effects.
 * Error handling: uses snackbars for load failures with safe fallbacks.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './client-profile.component.html',
  styleUrls: ['./client-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientProfileComponent implements OnInit, OnDestroy {
  profile: ClientProfile | null = null;
  isLoading = false;
  hasProfileData = false;
  displayName = '';
  displayAge: number | null = null;
  injuriesList: string[] = [];
  injuriesText = '';
  trainerName = '';

  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize the profile data flow on component load.
   * Input: none. Output: void.
   * Error handling: handled in loadProfile with fallbacks.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Purpose: clean up subscriptions to prevent memory leaks.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: load client profile data from the cached client service.
   * Input: none. Output: void.
   * Error handling: logs and shows snackbar on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadProfile(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.cdr.markForCheck();

    this.clientDataService.getMyProfile()
      .pipe(
        catchError(error => {
          this.handleLoadError(error, startedAt);
          return of({} as ClientProfile);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(profile => {
        this.profile = profile ?? {};
        this.applyProfileSnapshot(this.profile);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: derive display-ready fields from the raw profile.
   * Input: ClientProfile. Output: void.
   * Error handling: guards against missing fields.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyProfileSnapshot(profile: ClientProfile): void {
    this.displayName = this.buildDisplayName(profile);
    this.displayAge = this.resolveAge(profile);
    this.normalizeInjuries(profile);
    this.trainerName = profile.trainerName || '';

    this.hasProfileData = Boolean(
      this.displayName ||
      profile.email ||
      this.displayAge !== null ||
      this.injuriesList.length ||
      this.injuriesText ||
      this.trainerName
    );
  }

  /**
   * Purpose: build a full name string from profile fields.
   * Input: ClientProfile. Output: string.
   * Error handling: returns empty string when names are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildDisplayName(profile: ClientProfile): string {
    const givenName = profile.givenName?.trim() || '';
    const familyName = profile.familyName?.trim() || '';
    return `${givenName} ${familyName}`.trim();
  }

  /**
   * Purpose: resolve the client age from explicit age or birth date.
   * Input: ClientProfile. Output: number | null.
   * Error handling: returns null when values are missing or invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private resolveAge(profile: ClientProfile): number | null {
    if (typeof profile.age === 'number' && Number.isFinite(profile.age)) {
      return profile.age;
    }
    return this.computeAgeFromDate(profile.dateOfBirth);
  }

  /**
   * Purpose: compute age from an ISO date string.
   * Input: dateOfBirth string. Output: number | null.
   * Error handling: returns null for invalid dates.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private computeAgeFromDate(dateOfBirth?: string): number | null {
    if (!dateOfBirth) {
      return null;
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  /**
   * Purpose: normalize injuries payload into list or text display.
   * Input: ClientProfile. Output: void.
   * Error handling: falls back to empty values when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeInjuries(profile: ClientProfile): void {
    this.injuriesList = [];
    this.injuriesText = '';

    if (profile.noInjuries) {
      this.injuriesText = 'Sin lesiones reportadas';
      return;
    }

    const injuries = profile.injuries;
    if (Array.isArray(injuries)) {
      this.injuriesList = injuries
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      return;
    }

    if (typeof injuries === 'string' && injuries.trim().length > 0) {
      this.injuriesText = injuries.trim();
    }
  }

  /**
   * Purpose: map profile load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getProfileErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer tu perfil.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver tu perfil.';
    if (status === 404) return 'No encontramos tu informacion.';
    if (status >= 500) return 'El servidor no pudo entregar tu perfil.';
    return 'No se pudo cargar tu perfil. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for profile load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientProfile] load failed', { elapsedMs, error });
    this.snackBar.open(this.getProfileErrorMessage(error), 'Cerrar', { duration: 3500 });
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
