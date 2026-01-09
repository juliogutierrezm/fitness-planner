import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

/**
 * Purpose: placeholder view for upcoming client profile details.
 * Input: none. Output: static content rendering.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule
  ],
  templateUrl: './client-profile.component.html',
  styleUrls: ['./client-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientProfileComponent {}
