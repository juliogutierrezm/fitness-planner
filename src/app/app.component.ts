import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionTableComponent } from "./components/session-table/session-table.component";
import { TrainingSessionsComponent } from "./components/training-sessions/training-sessions.component";
import { ExerciseListComponent } from "./components/exercise-list/exercise-list.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [TrainingSessionsComponent, ExerciseListComponent]
})
export class AppComponent {
  onExerciseDropped(exercise: any) {
    console.log('Ejercicio recibido:', exercise);
  }
}