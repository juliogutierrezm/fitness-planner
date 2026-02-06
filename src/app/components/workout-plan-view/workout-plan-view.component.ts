import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { PlanItem, Session } from '../../shared/models';
import {
  getPlanItemDisplayName,
  getPlanItemEquipmentLabel,
  hasRenderablePlanContent,
  parsePlanSessions
} from '../../shared/shared-utils';
import { UserApiService } from '../../user-api.service';
import { PlanProgressions, ProgressionWeek } from '../planner/models/planner-plan.model';

@Component({
  selector: 'app-workout-plan-view',
  standalone: true,
    imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatDividerModule,
    MatTableModule,
    MatTooltipModule,
    MatIconModule,
  ],
  templateUrl: './workout-plan-view.component.html',
  styleUrls: ['./workout-plan-view.component.scss']
})
export class WorkoutPlanViewComponent implements OnChanges, OnInit {
  @Input() plan: any;
  sessions: Session[] = [];
  hasRenderableSessions = false;
  trainerName = '';
  progressions: PlanProgressions | null = null;

  constructor(private userApi: UserApiService) {}

  ngOnInit(): void {
    this.loadTrainerName();
    this.loadProgressions();
  }

  /**
   * Purpose: refresh normalized sessions when the plan input changes.
   * Input: Angular SimpleChanges. Output: updates sessions state.
   * Error handling: relies on parsePlanSessions to handle invalid payloads.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      this.refreshSessions();
      this.loadTrainerName();
      this.loadProgressions();
    }
  }

  /**
   * Purpose: Load trainer name from userId.
   */
  private loadTrainerName(): void {
    const trainerId = this.plan?.trainerId || this.plan?.userId;
    if (!trainerId) {
      this.trainerName = 'N/A';
      return;
    }
    this.userApi.getUserById(trainerId).subscribe({
      next: (user) => {
        if (user) {
          this.trainerName = `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email || trainerId;
        } else {
          this.trainerName = 'N/A';
        }
      },
      error: () => {
        this.trainerName = 'N/A';
      }
    });
  }

  /**
   * Purpose: Load and normalize progressions from plan.
   */
  private loadProgressions(): void {
    const rawProgressions = this.plan?.progressions;
    if (!rawProgressions) {
      this.progressions = null;
      return;
    }
    if (typeof rawProgressions === 'string') {
      try {
        const parsed = JSON.parse(rawProgressions);
        this.progressions = parsed && typeof parsed === 'object' ? parsed as PlanProgressions : null;
      } catch {
        this.progressions = null;
      }
    } else {
      this.progressions = rawProgressions as PlanProgressions;
    }
  }

  /**
   * Purpose: compute and cache renderable sessions for template use.
   * Input: none. Output: updates sessions + hasRenderableSessions.
   * Error handling: falls back to empty sessions on parse failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private refreshSessions(): void {
    // Support both new format { meta, plan: [...sessions] } and legacy { sessions: [...] }
    const rawSessions = Array.isArray(this.plan?.plan)
      ? this.plan.plan
      : this.plan?.sessions;
    this.sessions = parsePlanSessions(rawSessions);
    this.hasRenderableSessions = hasRenderablePlanContent(this.sessions);
  }

  /**
   * Purpose: provide the Spanish display name for a plan item.
   * Input: PlanItem. Output: display name string.
   * Error handling: returns a placeholder when name_es is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getDisplayName(item: PlanItem): string {
    return getPlanItemDisplayName(item);
  }

  /**
   * Purpose: provide the equipment label for a plan item.
   * Input: PlanItem. Output: equipment label string.
   * Error handling: returns a placeholder when equipment_type is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getEquipmentLabel(item: PlanItem): string {
    return getPlanItemEquipmentLabel(item);
  }
}
