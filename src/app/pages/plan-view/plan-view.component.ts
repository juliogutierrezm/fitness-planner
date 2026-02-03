import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';

@Component({
  selector: 'app-plan-view-page',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule, RouterModule, WorkoutPlanViewComponent],
  templateUrl: './plan-view.component.html',
  styleUrls: ['./plan-view.component.scss']
})
export class PlanViewPageComponent implements OnInit {
  plan: any = null;
  loading = true;
  planId: string | null = null;
  constructor(private route: ActivatedRoute, private router: Router, private api: ExerciseApiService, private authService: AuthService) {}

  get isGymAdmin(): boolean {
    return this.authService.isGymAdmin();
  }

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    if (!this.planId) { this.loading = false; return; }
    this.api.getWorkoutPlanById(this.planId).subscribe(p => { this.plan = p; this.loading = false; });
  }

  goBack() {
    this.router.navigate(['/users']);
  }
}
