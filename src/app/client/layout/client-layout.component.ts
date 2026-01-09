import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject, from, of } from 'rxjs';
import { catchError, finalize, takeUntil, tap } from 'rxjs/operators';
import { ThemeService, TenantTheme } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  templateUrl: './client-layout.component.html',
  styleUrls: ['./client-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientLayoutComponent implements OnInit, OnDestroy {
  isThemeLoading = true;
  isSigningOut = false;
  isDark = false;
  drawerOpen = false;
  debugThemeEnabled = !environment.production;
  debugDarkMode = false;
  themeTokens: Record<string, string> = {};
  currentTheme: TenantTheme | null = null;

  private themeSubject = new BehaviorSubject<TenantTheme | null>(null);
  theme$ = this.themeSubject.asObservable();
  private destroy$ = new Subject<void>();

  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize tenant theme loading for the client shell.
   * Input: none. Output: void.
   * Error handling: handled in loadTenantTheme with fallback + snackbar.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadTenantTheme();
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
   * Purpose: handle debug-only theme mode toggling without backend writes.
   * Input: nextMode boolean. Output: void.
   * Error handling: guards against missing theme snapshots.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onDebugThemeToggle(nextMode: boolean): void {
    if (!this.currentTheme) {
      return;
    }
    const updatedTheme: TenantTheme = {
      ...this.currentTheme,
      backgroundMode: nextMode ? 'dark' : 'light'
    };
    this.applyThemeSnapshot(updatedTheme);
  }

  /**
   * Purpose: open the off-canvas drawer for navigation.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openDrawer(): void {
    this.drawerOpen = true;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: close the off-canvas drawer for navigation.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  closeDrawer(): void {
    this.drawerOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: toggle the drawer open state from the header menu.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: close drawer when the user presses Escape.
   * Input: keyboard event. Output: void.
   * Error handling: guards against unrelated keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.drawerOpen) {
      this.closeDrawer();
    }
  }

  /**
   * Purpose: sign out the current user from the client shell.
   * Input: none. Output: void (navigation side effect).
   * Error handling: snackbar feedback on sign-out failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  signOut(): void {
    if (this.isSigningOut) {
      return;
    }

    const startedAt = this.getNowMs();
    this.isSigningOut = true;
    this.cdr.markForCheck();

    from(this.authService.signOut())
      .pipe(
        finalize(() => {
          this.isSigningOut = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (error) => {
          const elapsedMs = this.getElapsedMs(startedAt);
          console.error('[ClientLayout] signOut failed', { elapsedMs, error });
          this.snackBar.open('No se pudo cerrar sesion. Intenta de nuevo.', 'Cerrar', {
            duration: 4000
          });
        }
      });
  }

  /**
   * Purpose: load tenant theme and apply it locally before rendering UI.
   * Input: none. Output: void.
   * Error handling: fallbacks to defaults and notifies via snackbar.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadTenantTheme(): void {
    const startedAt = this.getNowMs();
    this.isThemeLoading = true;
    this.cdr.markForCheck();

    this.themeService.getTenantTheme()
      .pipe(
        tap(theme => this.applyThemeSnapshot(theme)),
        catchError(error => {
          const fallback = this.themeService.getDefaultTenantTheme();
          this.handleThemeLoadError(error, startedAt);
          this.applyThemeSnapshot(fallback);
          return of(fallback);
        }),
        finalize(() => {
          this.isThemeLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  /**
   * Purpose: apply and cache a tenant theme snapshot for rendering.
   * Input: TenantTheme. Output: void.
   * Error handling: N/A (delegated to ThemeService).
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyThemeSnapshot(theme: TenantTheme): void {
    const resolved = this.normalizeTheme(theme);
    this.currentTheme = resolved;
    this.themeSubject.next(resolved);
    this.debugDarkMode = resolved.backgroundMode === 'dark';
    this.isDark = resolved.backgroundMode === 'dark';
    this.themeTokens = {
      '--c-primary': resolved.primaryColor,
      '--c-accent': resolved.accentColor,
      '--c-font': resolved.fontFamily,
      '--c-app-name': resolved.appName || '',
      '--c-tagline': resolved.tagline || ''
    };
    this.cdr.markForCheck();
  }

  /**
   * Purpose: map theme load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getThemeErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No se pudo validar el tema del tenant.';
    if (status === 401 || status === 403) return 'No tienes permisos para cargar el tema.';
    if (status === 404) return 'No encontramos un tema configurado.';
    if (status >= 500) return 'El servidor no pudo entregar el tema.';
    return 'No se pudo cargar el tema. Usando valores por defecto.';
  }

  /**
   * Purpose: log structured context for theme load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures fallback theme still renders.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleThemeLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientLayout] tenant theme load failed', { elapsedMs, error });
    this.snackBar.open(this.getThemeErrorMessage(error), 'Cerrar', { duration: 4000 });
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

  /**
   * Purpose: normalize incoming tenant theme with safe defaults.
   * Input: TenantTheme. Output: normalized TenantTheme.
   * Error handling: falls back to default theme when values are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeTheme(theme: TenantTheme): TenantTheme {
    const fallback = this.themeService.getDefaultTenantTheme();
    return {
      tenantId: theme.tenantId || fallback.tenantId,
      tenantType: theme.tenantType || fallback.tenantType,
      primaryColor: theme.primaryColor || fallback.primaryColor,
      accentColor: theme.accentColor || fallback.accentColor,
      backgroundMode: theme.backgroundMode || fallback.backgroundMode,
      fontFamily: theme.fontFamily || fallback.fontFamily,
      appName: theme.appName || fallback.appName,
      tagline: theme.tagline || fallback.tagline,
      logoUrl: theme.logoUrl || fallback.logoUrl
    };
  }
}
