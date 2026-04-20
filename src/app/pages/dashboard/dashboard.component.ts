import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { catchError, filter, map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import {
  DashboardDataService,
  DashboardMode,
  DashboardViewModel,
  DashboardActivityItem,
  DashboardQuickAction,
  DashboardKpi
} from '../../services/dashboard-data.service';
import { FeedbackConfig, ErrorMapper } from '../../shared/feedback-utils';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('240ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('listStagger', [
      transition(':enter', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger(60, animate('240ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })))
        ], { optional: true })
      ])
    ])
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  displayName = 'Entrenador';
  readonly refresh$ = new BehaviorSubject<void>(undefined);
  loading = true;
  error = false;
  vm$!: Observable<DashboardViewModel>;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private dashboardData: DashboardDataService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.vm$ = this.buildVmStream();
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (!user) {
          this.displayName = 'Entrenador';
          return;
        }
        const fullName = `${user.givenName || ''} ${user.familyName || ''}`.trim();
        this.displayName = fullName || user.email || 'Entrenador';
        this.cdr.markForCheck();
      });
  }

  private buildVmStream(): Observable<DashboardViewModel> {
    return combineLatest([
      timer(0, 60000),
      this.refresh$,
      this.authService.currentUser$
    ]).pipe(
      map(([, , user]) => user),
      filter(user => Boolean(user)),
      switchMap(() => this.loadViewModel()),
      shareReplay(1),
      takeUntil(this.destroy$)
    );
  }

  refresh(): void {
    this.refresh$.next();
  }

  trackByKpi(_: number, item: DashboardKpi): string {
    return item.key;
  }

  trackByActivity(_: number, item: DashboardActivityItem): string {
    return item.id;
  }

  trackByAction(_: number, item: DashboardQuickAction): string {
    return item.route;
  }

  getModeLabel(mode: DashboardMode): string {
    if (mode === 'GYM_ADMIN') return 'Administrador';
    if (mode === 'INDEPENDENT_TRAINER') return 'Entrenador independiente';
    return 'Entrenador';
  }

  private loadViewModel() {
    this.loading = true;
    this.error = false;
    const mode = this.resolveMode();
    const companyId = this.authService.getCurrentCompanyId();
    const trainerId = this.authService.getCurrentUserId();

    if (mode === 'GYM_ADMIN') {
      return this.dashboardData.loadGymDashboard(companyId || '').pipe(
        map(vm => this.finalizeVm(vm)),
        catchError(error => this.handleError(error, mode))
      );
    }

    return this.dashboardData.loadTrainerDashboard(trainerId || '', mode).pipe(
      map(vm => this.finalizeVm(vm)),
      catchError(error => this.handleError(error, mode))
    );
  }

  private finalizeVm(vm: DashboardViewModel): DashboardViewModel {
    this.loading = false;
    this.error = false;
    this.cdr.markForCheck();
    return vm;
  }

  private handleError(error: any, mode: DashboardMode) {
    this.loading = false;
    this.error = true;
    const message = ErrorMapper.mapGenericError('No pudimos cargar el dashboard.');
    this.snackBar.open(message, 'Cerrar', FeedbackConfig.errorConfig());
    this.cdr.markForCheck();
    return of(this.getFallbackVm(mode));
  }

  private resolveMode(): DashboardMode {
    const isAdmin = this.authService.isAdmin();
    const isTrainer = this.authService.isTrainer();
    const companyId = this.authService.getCurrentCompanyId() || 'INDEPENDENT';

    if (isAdmin && !isTrainer && companyId !== 'INDEPENDENT') {
      return 'GYM_ADMIN';
    }
    if (isTrainer && companyId === 'INDEPENDENT') {
      return 'INDEPENDENT_TRAINER';
    }
    return 'GYM_TRAINER';
  }

  private getFallbackVm(mode: DashboardMode): DashboardViewModel {
    return {
      mode,
      kpis: [],
      recentAiActivity: [],
      quickActions: [],
      aiPlansThisMonth: 0,
      clientsWithAiThisMonth: 0
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
