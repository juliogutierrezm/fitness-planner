import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { ExerciseApiService } from '../../exercise-api.service';
import { MatCardModule } from "@angular/material/card";
import { WorkoutPlanViewComponent } from "../../components/workout-plan-view/workout-plan-view.component";

@Component({
  selector: 'app-workout-plans',
  standalone: true,
  imports: [
    CommonModule, // <--- requerido para *ngFor, *ngIf, etc.
    MatCardModule,
    WorkoutPlanViewComponent
],
  templateUrl: './workout-plans.component.html',
  styleUrls: ['./workout-plans.component.scss']
})
export class WorkoutPlansComponent {
  plans: any[] = [];
  userId: string = 'Plucky'; // cambiar según autenticación

  constructor(private api: ExerciseApiService) {}

  ngOnInit() {
    this.api.getWorkoutPlansByUser(this.userId).subscribe((data) => {
      this.plans = data;
      console.log('Planes de entrenamiento obtenidos:', this.plans);
    });
  }
}
