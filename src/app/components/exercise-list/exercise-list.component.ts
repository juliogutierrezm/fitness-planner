import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { Exercise } from '../../shared/models';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, DragDropModule, ButtonModule, TableModule,],
  templateUrl: './exercise-list.component.html',
  styleUrls: ['./exercise-list.component.scss']
})
export class ExerciseListComponent implements OnInit {
  @Input() exercises: Exercise[] = [];
  @Input() connectedTo: string[] = [];

  ngOnInit(): void {
    console.log('📦 Lista de ejercicios recibida en ExerciseListComponent:', this.exercises);
  }
}
