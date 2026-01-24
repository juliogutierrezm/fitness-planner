import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiPlansService, AiAggregateResponse, AiClientPlansSummary } from '../../services/ai-plans.service';
import { AuthService } from '../../services/auth.service';

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

  constructor(
    private aiPlansService: AiPlansService,
    private authService: AuthService,
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
    const totalPlans = response.clientsWithAIPlans.reduce((sum, client) => sum + (client.totalPlans || 0), 0);
    this.metrics = [
      {
        label: 'Clientes con planes IA',
        value: response.totalClientsWithAIPlans ?? 0,
        icon: 'group'
      },
      {
        label: 'Planes IA generados',
        value: totalPlans,
        icon: 'auto_awesome'
      },
      {
        label: 'Clientes totales',
        value: response.totalClients ?? 0,
        icon: 'groups'
      }
    ];
    this.clients = response.clientsWithAIPlans || [];
    this.cdr.markForCheck();
  }
}