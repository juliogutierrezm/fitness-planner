import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiPlansService, AiAggregateResponse, AiClientPlansSummary, AiPlanSummary } from '../../services/ai-plans.service';
import { AuthService } from '../../services/auth.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { AiPlanQuota } from '../../shared/ai-plan-limits';

interface AiMetricCard {
  label: string;
  value: number | string;
  icon: string;
}

@Component({
  selector: 'app-ai-plans-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './ai-plans-dashboard.component.html',
  styleUrls: ['./ai-plans-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiPlansDashboardComponent implements OnInit {
  loading = true;
  unauthorized = false;
  metrics: AiMetricCard[] = [];
  clients: AiClientPlansSummary[] = [];
  scopeLabel = 'IA';

  /** Trainer AI plan quota (only loaded for trainer role). */
  quota: AiPlanQuota | null = null;

  constructor(
    private aiPlansService: AiPlansService,
    private authService: AuthService,
    private userApi: UserApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  trackByClient(_: number, client: AiClientPlansSummary): string {
    return client.clientId;
  }

  get isEmpty(): boolean {
    return !this.loading && this.clients.length === 0;
  }

  private loadDashboard(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.loading = false;
      this.unauthorized = true;
      this.cdr.markForCheck();
      return;
    }

    const isAdmin = this.authService.isAdmin();
    const isTrainer = this.authService.isTrainer();
    const companyId = this.authService.getCurrentCompanyId();
    const isIndependent = this.authService.isIndependentTenant();

    if (isAdmin && companyId && !isIndependent) {
      this.scopeLabel = 'Gimnasio';
      this.aiPlansService.getByGym(companyId).subscribe(response => {
        this.handleResponse(response);
      });
      return;
    }

    if (isTrainer || isIndependent) {
      const trainerId = this.authService.getCurrentUserId();
      this.scopeLabel = 'Entrenador';
      if (!trainerId) {
        this.loading = false;
        this.unauthorized = true;
        this.cdr.markForCheck();
        return;
      }
      // Load quota for trainer
      this.aiPlansService.getTrainerQuota(trainerId).subscribe(q => {
        this.quota = q;
        this.cdr.markForCheck();
      });
      this.aiPlansService.getByTrainer(trainerId).subscribe(response => {
        this.handleResponse(response);
      });
      return;
    }

    this.loading = false;
    this.unauthorized = true;
    this.cdr.markForCheck();
  }

  private handleResponse(response: AiAggregateResponse | null): void {
    this.loading = false;
    if (!response) {
      this.clients = [];
      this.metrics = [];
      this.cdr.markForCheck();
      return;
    }

    // New DynamoDB response: flat plans array - group by userId
    if (response.plans && Array.isArray(response.plans)) {
      this.processPlansResponse(response);
      return;
    }

    // Legacy response format with clientsWithAIPlans (backward compatibility)
    if (response.clientsWithAIPlans) {
      const totalPlans = response.clientsWithAIPlans.reduce((sum, client) => sum + (client.totalPlans || 0), 0);
      this.metrics = [
        { label: 'Clientes con planes IA', value: response.totalClientsWithAIPlans ?? 0, icon: 'group' },
        { label: 'Planes IA generados', value: totalPlans, icon: 'auto_awesome' },
        { label: 'Clientes totales', value: response.totalClients ?? 0, icon: 'groups' }
      ];
      this.clients = response.clientsWithAIPlans || [];
      this.cdr.markForCheck();
      return;
    }

    this.clients = [];
    this.metrics = [];
    this.cdr.markForCheck();
  }

  /**
   * Process flat plans array from DynamoDB and group by userId.
   * Fetches user info to display client names.
   */
  private processPlansResponse(response: AiAggregateResponse): void {
    const plans = response.plans || [];
    const totalPlans = response.totalPlans ?? plans.length;

    // Group plans by userId
    const plansByUser = new Map<string, AiPlanSummary[]>();
    for (const plan of plans) {
      const userId = plan.userId;
      if (!plansByUser.has(userId)) {
        plansByUser.set(userId, []);
      }
      plansByUser.get(userId)!.push(plan);
    }

    const uniqueUserIds = Array.from(plansByUser.keys());
    const clientsCount = uniqueUserIds.length;

    // Set metrics immediately
    this.metrics = [
      { label: 'Clientes con planes IA', value: clientsCount, icon: 'group' },
      { label: 'Planes IA generados', value: totalPlans, icon: 'auto_awesome' },
      { label: 'Clientes totales', value: clientsCount, icon: 'groups' }
    ];

    // Fetch user info to get names
    this.userApi.getUsersForCurrentTenant().subscribe({
      next: (users) => {
        const userMap = new Map<string, AppUser>();
        for (const user of users || []) {
          if (user.id) {
            userMap.set(user.id, user);
          }
        }

        // Build clients array with user info
        this.clients = uniqueUserIds.map(userId => {
          const userPlans = plansByUser.get(userId) || [];
          const user = userMap.get(userId);
          const sortedPlans = userPlans.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return {
            clientId: userId,
            clientName: user ? `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email || userId : userId,
            email: user?.email || '',
            trainerId: userPlans[0]?.trainerId || undefined,
            companyId: userPlans[0]?.companyId,
            totalPlans: userPlans.length,
            latestPlanDate: sortedPlans[0]?.createdAt,
            plans: sortedPlans
          } as AiClientPlansSummary;
        });

        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback: use userId as name if user fetch fails
        this.clients = uniqueUserIds.map(userId => {
          const userPlans = plansByUser.get(userId) || [];
          const sortedPlans = userPlans.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return {
            clientId: userId,
            clientName: userId,
            email: '',
            totalPlans: userPlans.length,
            latestPlanDate: sortedPlans[0]?.createdAt,
            plans: sortedPlans
          } as AiClientPlansSummary;
        });
        this.cdr.markForCheck();
      }
    });
  }
}