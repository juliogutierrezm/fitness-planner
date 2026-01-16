import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersComponent } from '../users/users.component';
import { isIndependentTenant } from '../../shared/shared-utils';
import { AuthService } from '../../services/auth.service';

/**
 * Purpose: host the trainers module with a trainer-only context.
 * Input: none. Output: renders the shared users management view for trainers.
 * Error handling: delegated to UsersComponent.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [CommonModule, UsersComponent],
  templateUrl: './trainers.component.html',
  styleUrls: ['./trainers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainersComponent {
  constructor(public authService: AuthService) {}

  /**
   * Purpose: expose independent tenant detection for template rendering.
   * Input: companyId string | null | undefined. Output: boolean.
   * Error handling: treats missing companyId as INDEPENDENT fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  isIndependentTenant(companyId?: string | null): boolean {
    return isIndependentTenant(companyId);
  }
}
