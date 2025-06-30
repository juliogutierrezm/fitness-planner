import { Component } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, DragDropModule], // Importa DragDropModule aquí
  templateUrl: './exercise-list.component.html',
  styleUrls: ['./exercise-list.component.scss']
})
export class ExerciseListComponent {
  exercises = [
    { id: 1, name: 'Press de Pecho', group: 'Pecho' },
    { id: 2, name: 'Sentadilla', group: 'Piernas' },
    { id: 3, name: 'Dominadas', group: 'Espalda' },
    { id: 4, name: 'Curl de Bíceps', group: 'Bíceps' }
  ];

  drop(event: any) {
    const exercise = this.exercises[event.previousIndex];
    console.log('Ejercicio arrastrado:', exercise);
  }
}
