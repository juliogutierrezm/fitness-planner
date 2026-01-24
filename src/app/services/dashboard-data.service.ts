import { Injectable } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AiClientPlansSummary, AiPlansService } from './ai-plans.service';
import { UserApiService } from '../user-api.service';

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
        const aiStats = this.buildAiStats(aiResponse?.clientsWithAIPlans || []);
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
          recentAiActivity: this.buildRecentActivity(aiResponse?.clientsWithAIPlans || []),
          quickActions: this.getTrainerQuickActions(),
          aiPlansThisMonth: aiStats.aiPlansThisMonth,
          clientsWithAiThisMonth: aiStats.clientsWithAiThisMonth
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
        const aiStats = this.buildAiStats(aiResponse?.clientsWithAIPlans || []);
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
          recentAiActivity: this.buildRecentActivity(aiResponse?.clientsWithAIPlans || []),
          quickActions: this.getGymAdminQuickActions(),
          aiPlansThisMonth: aiStats.aiPlansThisMonth,
          clientsWithAiThisMonth: aiStats.clientsWithAiThisMonth
        };
        return viewModel;
      }),
      catchError(() => of(this.emptyGymVm()))
    );
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