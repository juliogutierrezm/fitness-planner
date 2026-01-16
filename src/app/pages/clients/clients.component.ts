import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UsersComponent } from '../users/users.component';

/**
 * Purpose: host the clients module with a client-only context.
 * Input: none. Output: renders the shared users management view for clients.
 * Error handling: delegated to UsersComponent.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [UsersComponent],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientsComponent {}
