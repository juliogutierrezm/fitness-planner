import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiPlanSummary, AiPlansService, AiUserPlansResponse } from '../../services/ai-plans.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-ai-plans-user',
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
  templateUrl: './ai-plans-user.component.html',
  styleUrls: ['./ai-plans-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiPlansUserComponent implements OnInit {
  loading = true;
  unauthorized = false;
  userId = '';
  totalPlans = 0;
  plans: AiPlanSummary[] = [];

  constructor(
    private route: ActivatedRoute,
    private aiPlansService: AiPlansService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.userId) {
      this.loading = false;
      this.unauthorized = true;
      this.cdr.markForCheck();
      return;
    }
    this.loadPlans();
  }

  trackByPlan(_: number, plan: AiPlanSummary): string {
    return plan.executionId;
  }

  get isEmpty(): boolean {
    return !this.loading && this.plans.length === 0;
  }

  private loadPlans(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.canAccessUserData(this.userId)) {
      this.loading = false;
      this.unauthorized = true;
      this.cdr.markForCheck();
      return;
    }

    this.aiPlansService.getByUser(this.userId).subscribe(response => {
      this.handleResponse(response);
    });
  }

  private handleResponse(response: AiUserPlansResponse | null): void {
    this.loading = false;
    if (!response) {
      this.plans = [];
      this.totalPlans = 0;
      this.cdr.markForCheck();
      return;
    }
    this.plans = response.plans || [];
    this.totalPlans = response.totalPlans || this.plans.length;
    this.cdr.markForCheck();
  }
}