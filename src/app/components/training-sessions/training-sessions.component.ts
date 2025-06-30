import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

interface Exercise {
  id: number;
  name: string;
}

interface Session {
  id: number;
  name: string;
  exercises: Exercise[];
}

@Component({
  selector: 'app-training-sessions',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './training-sessions.component.html',
  styleUrls: ['./training-sessions.component.scss']
})
export class TrainingSessionsComponent {
  sessions: Session[] = [
    { id: 1, name: 'Día 1', exercises: [] },
    { id: 2, name: 'Día 2', exercises: [] }
  ];

  dropExercise(event: CdkDragDrop<Exercise[]>, session: Session) {
    const exercise = event.item.data as Exercise;
    session.exercises.push(exercise);
  }

  removeExercise(session: Session, exerciseId: number) {
    session.exercises = session.exercises.filter(e => e.id !== exerciseId);
  }
}
