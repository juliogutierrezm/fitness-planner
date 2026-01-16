import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { UserDisplayNamePipe } from '../../shared/user-display-name.pipe';
import { buildPlanOrdinalMap, getPlanKey, sortPlansByCreatedAt } from '../../shared/shared-utils';

interface AppUser {
  id?: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role: 'client' | 'trainer' | 'admin';
  companyId?: string;
  trainerId?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-user-plans-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, RouterModule, UserDisplayNamePipe],
  templateUrl: './user-plans-dialog.component.html',
  styleUrls: ['./user-plans-dialog.component.scss']
})
export class UserPlansDialogComponent {
  viewPlans: any[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    this.viewPlans = this.buildViewPlans(data?.plans || []);
  }

  /**
   * Purpose: prepare ordered plans with visual ordinals from createdAt.
   * Input: plan array. Output: decorated plan array.
   * Error handling: treats invalid input as empty list.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildViewPlans(plans: any[]): any[] {
    const sorted = sortPlansByCreatedAt(plans || []);
    const ordinals = buildPlanOrdinalMap(sorted);
    return sorted.map(plan => ({
      ...plan,
      planOrdinal: ordinals.get(getPlanKey(plan)) || 0
    }));
  }


}
