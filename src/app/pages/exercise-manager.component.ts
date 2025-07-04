import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ExerciseApiService } from '../exercise-api.service';
import { Exercise } from '../shared/models';
import { MatCardModule } from '@angular/material/card';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-exercise-manager',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './exercise-manager.component.html',
  styleUrls: ['./exercise-manager.component.scss']
})
export class ExerciseManagerComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'equipment', 'muscle', 'category', 'actions'];
  exercises: Exercise[] = [];

  constructor(private api: ExerciseApiService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadExercises();
  }

/*   onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const content = reader.result as string;
      const data: Exercise[] = JSON.parse(content);

      if (!Array.isArray(data)) throw new Error('Formato incorrecto');

      this.api.bulkInsertExercisesBatch(data).subscribe(() => {
        alert('✅ Ejercicios cargados exitosamente');
        this.loadExercises();
      });
    } catch (err) {
      const errorMsg = (err instanceof Error) ? err.message : String(err);
      alert('❌ Archivo inválido: ' + errorMsg);
    }
  };

  reader.readAsText(file);
}


  bulkInsert(): void {
    this.http.get<Exercise[]>('assets/exercises.json').subscribe((data: Exercise[]) => {
      const chunk = data.slice(0, 25); // Dynamo solo acepta 25 por lote
      this.api.bulkInsertExercisesBatch(chunk).subscribe(() => {
        console.log('✅ Carga masiva completada');
        this.loadExercises();
      });
    });
  } */

  loadExercises(): void {
    this.api.getExercises().subscribe((data: Exercise[]) => {
      this.exercises = data;
    });
  }

  deleteExercise(id: string): void {
    if (confirm(`¿Eliminar ejercicio con ID ${id}?`)) {
      this.api.deleteExercise(id).subscribe(() => this.loadExercises());
    }
  }

  editExercise(ex: Exercise): void {
    console.log('📝 Editar ejercicio:', ex);
    // Aquí puedes abrir un formulario con los datos del ejercicio
  }
}
