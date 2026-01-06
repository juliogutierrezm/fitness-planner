import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UsersComponent } from '../users/users.component';

/**
 * Purpose: host the trainers module with a trainer-only context.
 * Input: none. Output: renders the shared users management view for trainers.
 * Error handling: delegated to UsersComponent.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [UsersComponent],
  templateUrl: './trainers.component.html',
  styleUrls: ['./trainers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainersComponent {}
