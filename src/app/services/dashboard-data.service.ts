import { Injectable } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AiAggregateResponse, AiClientPlansSummary, AiPlansService, AiPlanSummary } from './ai-plans.service';
import { UserApiService, AppUser } from '../user-api.service';
import { MAX_AI_PLANS_PER_TRAINER, AiPlanQuota } from '../shared/ai-plan-limits';

export type DashboardMode = 'GYM_ADMIN' | 'GYM_TRAINER' | 'INDEPENDENT_TRAINER';

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  icon: string;
}

export interface DashboardActivityItem {
  id: string;
  clientId: string;
  title: string;
  subtitle: string;
  date: string | null;
}

export interface DashboardQuickAction {
  label: string;
  description: string;
  icon: string;
  route: string;
}

export interface DashboardViewModel {
  mode: DashboardMode;
  kpis: DashboardKpi[];
  recentAiActivity: DashboardActivityItem[];
  quickActions: DashboardQuickAction[];
  aiPlansThisMonth: number;
  clientsWithAiThisMonth: number;
  /** AI plan quota for trainer role. Null for gym admins. */
  aiPlanQuota?: AiPlanQuota | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  constructor(
    private aiPlansService: AiPlansService,
    private userApi: UserApiService
  ) {}

  loadTrainerDashboard(trainerId: string, mode: DashboardMode): Observable<DashboardViewModel> {
    const ai$ = this.aiPlansService.getByTrainer(trainerId);
    const users$ = this.userApi.getUsersByTrainer(trainerId);

    return combineLatest([ai$, users$]).pipe(
      map(([aiResponse, users]) => {
        const clients = (users || []).filter(user => user.role === 'client');
        const { clientsWithPlans, aiStats } = this.processAiResponse(aiResponse, users || []);
        const viewModel: DashboardViewModel = {
          mode,
          kpis: [
            {
              key: 'clients',
              label: 'Clientes asignados',
              value: clients.length,
              icon: 'group'
            },
            {
              key: 'aiPlansMonth',
              label: 'Planes IA este mes',
              value: aiStats.aiPlansThisMonth,
              icon: 'auto_awesome'
            },
            {
              key: 'aiPlansTotal',
              label: 'Planes IA totales',
              value: aiStats.totalPlans,
              icon: 'insights'
            }
          ],
          recentAiActivity: this.buildRecentActivity(clientsWithPlans),
          quickActions: this.getTrainerQuickActions(),
          aiPlansThisMonth: aiStats.aiPlansThisMonth,
          clientsWithAiThisMonth: aiStats.clientsWithAiThisMonth,
          aiPlanQuota: this.buildQuota(aiStats.totalPlans)
        };
        return viewModel;
      }),
      catchError(() => of(this.emptyTrainerVm(mode)))
    );
  }

  loadGymDashboard(companyId: string): Observable<DashboardViewModel> {
    const ai$ = this.aiPlansService.getByGym(companyId);
    const users$ = this.userApi.getUsersByCompany(companyId);

    return combineLatest([ai$, users$]).pipe(
      map(([aiResponse, users]) => {
        const trainers = (users || []).filter(user => user.role === 'trainer');
        const clients = (users || []).filter(user => user.role === 'client');
        const { clientsWithPlans, aiStats } = this.processAiResponse(aiResponse, users || []);
        const viewModel: DashboardViewModel = {
          mode: 'GYM_ADMIN',
          kpis: [
            {
              key: 'trainers',
              label: 'Entrenadores activos',
              value: trainers.length,
              icon: 'sports'
            },
            {
              key: 'clients',
              label: 'Clientes del gym',
              value: clients.length,
              icon: 'groups'
            },
            {
              key: 'aiPlansMonth',
              label: 'Planes IA este mes',
              value: aiStats.aiPlansThisMonth,
              icon: 'auto_awesome'
            },
            {
              key: 'clientsAiMonth',
              label: 'Clientes con IA este mes',
              value: aiStats.clientsWithAiThisMonth,
              icon: 'bolt'
            }
          ],
          recentAiActivity: this.buildRecentActivity(clientsWithPlans),
          quickActions: this.getGymAdminQuickActions(),
          aiPlansThisMonth: aiStats.aiPlansThisMonth,
          clientsWithAiThisMonth: aiStats.clientsWithAiThisMonth
        };
        return viewModel;
      }),
      catchError(() => of(this.emptyGymVm()))
    );
  }

  /**
   * Process AI response - handles both new DynamoDB format (flat plans array)
   * and legacy format (clientsWithAIPlans).
   */
  private processAiResponse(
    aiResponse: AiAggregateResponse | null,
    users: AppUser[]
  ): {
    clientsWithPlans: AiClientPlansSummary[];
    aiStats: { aiPlansThisMonth: number; clientsWithAiThisMonth: number; totalPlans: number };
  } {
    // New DynamoDB format: flat plans array
    if (aiResponse?.plans && Array.isArray(aiResponse.plans)) {
      const userMap = new Map<string, AppUser>();
      for (const user of users) {
        if (user.id) userMap.set(user.id, user);
      }

      // Group plans by userId
      const plansByUser = new Map<string, AiPlanSummary[]>();
      for (const plan of aiResponse.plans) {
        const userId = plan.userId;
        if (!plansByUser.has(userId)) {
          plansByUser.set(userId, []);
        }
        plansByUser.get(userId)!.push(plan);
      }

      // Build clientsWithPlans array
      const clientsWithPlans: AiClientPlansSummary[] = [];
      for (const [userId, plans] of plansByUser) {
        const user = userMap.get(userId);
        const sortedPlans = plans.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        clientsWithPlans.push({
          clientId: userId,
          clientName: user ? `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email || userId : userId,
          email: user?.email || '',
          trainerId: plans[0]?.trainerId || undefined,
          companyId: plans[0]?.companyId,
          totalPlans: plans.length,
          latestPlanDate: sortedPlans[0]?.createdAt,
          plans: sortedPlans
        });
      }

      return {
        clientsWithPlans,
        aiStats: this.buildAiStatsFromPlans(aiResponse.plans)
      };
    }

    // Legacy format: clientsWithAIPlans
    const legacyClients = aiResponse?.clientsWithAIPlans || [];
    return {
      clientsWithPlans: legacyClients,
      aiStats: this.buildAiStats(legacyClients)
    };
  }

  /**
   * Build AI stats directly from flat plans array (new DynamoDB format)
   */
  private buildAiStatsFromPlans(plans: AiPlanSummary[]): {
    aiPlansThisMonth: number;
    clientsWithAiThisMonth: number;
    totalPlans: number;
  } {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let aiPlansThisMonth = 0;
    const clientsWithAiMonth = new Set<string>();

    for (const plan of plans) {
      const date = plan?.createdAt ? new Date(plan.createdAt) : null;
      if (!date || Number.isNaN(date.getTime())) continue;
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        aiPlansThisMonth += 1;
        clientsWithAiMonth.add(plan.userId);
      }
    }

    return {
      aiPlansThisMonth,
      clientsWithAiThisMonth: clientsWithAiMonth.size,
      totalPlans: plans.length
    };
  }

  private buildAiStats(clients: AiClientPlansSummary[]): {
    aiPlansThisMonth: number;
    clientsWithAiThisMonth: number;
    totalPlans: number;
  } {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let aiPlansThisMonth = 0;
    let totalPlans = 0;
    const clientsWithAiMonth = new Set<string>();

    for (const client of clients) {
      const plans = client?.plans || [];
      totalPlans += client?.totalPlans || plans.length;

      for (const plan of plans) {
        const date = plan?.createdAt ? new Date(plan.createdAt) : null;
        if (!date || Number.isNaN(date.getTime())) continue;
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          aiPlansThisMonth += 1;
          clientsWithAiMonth.add(client.clientId);
        }
      }
    }

    return {
      aiPlansThisMonth,
      clientsWithAiThisMonth: clientsWithAiMonth.size,
      totalPlans
    };
  }

  /**
   * Purpose: build AiPlanQuota from total plan count for trainer-facing views.
   */
  private buildQuota(totalPlans: number): AiPlanQuota {
    const used = totalPlans;
    const limit = MAX_AI_PLANS_PER_TRAINER;
    const remaining = Math.max(0, limit - used);
    return { used, limit, remaining, limitReached: used >= limit };
  }

  private buildRecentActivity(clients: AiClientPlansSummary[]): DashboardActivityItem[] {
    const items: DashboardActivityItem[] = [];
    for (const client of clients || []) {
      const plans = client?.plans || [];
      for (const plan of plans) {
        items.push({
          id: plan.executionId,
          clientId: client.clientId,
          title: client.clientName || 'Cliente',
          subtitle: 'Plan IA generado',
          date: plan.createdAt || null
        });
      }
    }
    return items
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }

  private getTrainerQuickActions(): DashboardQuickAction[] {
    return [
      {
        label: 'Ver clientes',
        description: 'Gestiona tus clientes activos.',
        icon: 'group',
        route: '/clients'
      },
      {
        label: 'Ver plantillas',
        description: 'Reutiliza plantillas existentes.',
        icon: 'style',
        route: '/templates'
      },
      {
        label: 'Planes IA',
        description: 'Actividad IA del mes.',
        icon: 'auto_awesome',
        route: '/ai-plans'
      }
    ];
  }

  private getGymAdminQuickActions(): DashboardQuickAction[] {
    return [
      {
        label: 'Ver clientes',
        description: 'Clientes activos del gym.',
        icon: 'group',
        route: '/clients'
      },
      {
        label: 'Ver entrenadores',
        description: 'Gestiona entrenadores.',
        icon: 'sports',
        route: '/trainers'
      },
      {
        label: 'Planes IA',
        description: 'Panel de IA del gym.',
        icon: 'auto_awesome',
        route: '/ai-plans'
      }
    ];
  }

  private emptyTrainerVm(mode: DashboardMode): DashboardViewModel {
    return {
      mode,
      kpis: [],
      recentAiActivity: [],
      quickActions: this.getTrainerQuickActions(),
      aiPlansThisMonth: 0,
      clientsWithAiThisMonth: 0
    };
  }

  private emptyGymVm(): DashboardViewModel {
    return {
      mode: 'GYM_ADMIN',
      kpis: [],
      recentAiActivity: [],
      quickActions: this.getGymAdminQuickActions(),
      aiPlansThisMonth: 0,
      clientsWithAiThisMonth: 0
    };
  }
}