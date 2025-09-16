import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-workout-plan-view',
  standalone: true,
    imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatDividerModule,
    MatTableModule,
  ],
  templateUrl: './workout-plan-view.component.html',
  styleUrls: ['./workout-plan-view.component.scss']
})
export class WorkoutPlanViewComponent {
  @Input() plan: any;

  getSessions() {
    if (this.plan?.sessions) {
      if (typeof this.plan.sessions === 'string') {
        try {
          return JSON.parse(this.plan.sessions);
        } catch (e) {
          console.error('Error parsing sessions JSON:', e);
          return [];
        }
      }
      return this.plan.sessions; // It's already an object/array
    }
    return [];
  }
}

