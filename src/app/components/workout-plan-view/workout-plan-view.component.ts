import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanItem, Session } from '../../shared/models';
import {
  getPlanItemDisplayName,
  getPlanItemEquipmentLabel,
  hasRenderablePlanContent,
  parsePlanSessions
} from '../../shared/shared-utils';

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
  ],
  templateUrl: './workout-plan-view.component.html',
  styleUrls: ['./workout-plan-view.component.scss']
})
export class WorkoutPlanViewComponent implements OnChanges {
  @Input() plan: any;
  sessions: Session[] = [];
  hasRenderableSessions = false;

  /**
   * Purpose: refresh normalized sessions when the plan input changes.
   * Input: Angular SimpleChanges. Output: updates sessions state.
   * Error handling: relies on parsePlanSessions to handle invalid payloads.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      this.refreshSessions();
    }
  }

  /**
   * Purpose: compute and cache renderable sessions for template use.
   * Input: none. Output: updates sessions + hasRenderableSessions.
   * Error handling: falls back to empty sessions on parse failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private refreshSessions(): void {
    this.sessions = parsePlanSessions(this.plan?.sessions);
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
