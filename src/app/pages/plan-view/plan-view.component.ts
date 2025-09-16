import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExerciseApiService } from '../../exercise-api.service';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';

@Component({
  selector: 'app-plan-view-page',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, WorkoutPlanViewComponent],
  template: `
    <ng-container *ngIf="loading; else content">
      <div class="loading"><mat-spinner></mat-spinner></div>
    </ng-container>
    <ng-template #content>
      <app-workout-plan-view [plan]="plan"></app-workout-plan-view>
    </ng-template>
  `,
  styles: [
    `.loading{display:flex;align-items:center;justify-content:center;min-height:40vh;}`
  ]
})
export class PlanViewPageComponent implements OnInit {
  plan: any = null;
  loading = true;
  constructor(private route: ActivatedRoute, private api: ExerciseApiService) {}
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }
    this.api.getWorkoutPlanById(id).subscribe(p => { this.plan = p; this.loading = false; });
  }
}

