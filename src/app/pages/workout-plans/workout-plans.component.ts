import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-workout-plans',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './workout-plans.component.html',
  styleUrls: ['./workout-plans.component.scss']
})
export class WorkoutPlansComponent implements OnInit {
  plans: any[] = [];

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Load workout plans for the authenticated user
    this.api.getWorkoutPlansByUser().subscribe((data) => {
      this.plans = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('Planes de entrenamiento obtenidos:', this.plans);
    });
  }
}


