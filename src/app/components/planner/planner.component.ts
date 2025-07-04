// src/app/planner/planner.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }                        from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';

import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';

import { MatFormFieldModule }   from '@angular/material/form-field';
import { MatInputModule }       from '@angular/material/input';
import { MatDatepickerModule }  from '@angular/material/datepicker';
import { MatNativeDateModule }  from '@angular/material/core';
import { MatIconModule }        from '@angular/material/icon';
import { MatButtonModule }      from '@angular/material/button';
import { MatTableModule }       from '@angular/material/table';
import { MatCardModule }        from '@angular/material/card';

import { ExerciseApiService } from '../../exercise-api.service';
import { Exercise, Session, PlanItem } from '../../shared/models';
import { ExerciseManagerComponent } from "../../pages/exercise-manager.component";

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatCardModule,
    ExerciseManagerComponent
  ],
  templateUrl: './planner.component.html',
  styleUrls: ['./planner.component.scss']
})
export class PlannerComponent implements OnInit {
  form!: FormGroup;
  exercises: Exercise[] = [];
  sessions: Session[]  = [];
  exerciseListConnectedTo: string[] = [];
  sessionsConnectedTo: Record<string,string[]> = {};
  editingRow: { sessionId: number; idx: number; field: 'sets'|'reps'|'rest' } | null = null;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: ExerciseApiService
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      userName:    [''],
      date:        [new Date()],
      sessionCount:[3]
    });

    // 1) Cargar ejercicios desde DynamoDB
    this.api.getExercises().subscribe(exs => {
      this.exercises = exs;
      this.cdr.markForCheck();
    });

    // 2) Cargar sesiones previas o crearlas
    const loaded = this.api.loadSessions();
    if (loaded.length) {
      this.sessions = JSON.parse(JSON.stringify(loaded));
    } else {
      this.updateSessions(this.form.value.sessionCount);
    }
    this.rebuildDropLists();

    // 3) Al cambiar número de sesiones
    this.form.get('sessionCount')!.valueChanges.subscribe(count => {
      this.updateSessions(count);
      this.persist();
    });
  }

  // ----- edición inline -----
  startEdit(sessionId: number, idx: number, field: 'sets'|'reps'|'rest') {
    this.editingRow = { sessionId, idx, field };
  }

  finishEdit() {
    this.persist();
    this.editingRow = null;
    this.cdr.detectChanges();
  }

  isEditing(sessionId: number, idx: number, field: 'sets'|'reps'|'rest') {
    return !!this.editingRow
       && this.editingRow.sessionId === sessionId
       && this.editingRow.idx       === idx
       && this.editingRow.field     === field;
  }

  // ----- sesiones -----
  private updateSessions(count: number) {
    this.sessions = Array.from({ length: count }, (_, i) => ({
      id:    i + 1,
      name:  `Día ${i + 1}`,
      items: this.sessions[i]?.items || []
    }));
    this.rebuildDropLists();
  }

  private rebuildDropLists() {
    this.exerciseListConnectedTo = this.sessions.map(s => `session-${s.id}`);
    this.sessionsConnectedTo = this.sessions.reduce((acc, s) => {
      acc[`session-${s.id}`] = [
        'exerciseList',
        ...this.sessions.filter(x => x.id !== s.id).map(x => `session-${x.id}`)
      ];
      return acc;
    }, {} as any);
  }

  // ----- drag & drop -----
  drop(event: CdkDragDrop<any, any>, session?: Session) {
    const prevId = event.previousContainer.id;
    const currId = event.container.id;

    // 1) reordenar en la misma sesión
    if (prevId === currId && session) {
      moveItemInArray(session.items, event.previousIndex, event.currentIndex);
      session.items = [...session.items];
      this.persist();
      this.cdr.detectChanges();
      return;
    }

    // 2) sidebar → sesión
    if (prevId === 'exerciseList' && session) {
      const ex = event.item.data as Exercise;
      const newItem: PlanItem = {
        ...ex,
        sets: 3,
        reps: 10,
        rest: 60
      };
      session.items.splice(event.currentIndex, 0, newItem);
      session.items = [...session.items];
      this.persist();
      this.cdr.detectChanges();
      return;
    }

    // 3) sesión → otra sesión
    if (prevId.startsWith('session-') && currId.startsWith('session-') && session) {
      transferArrayItem(
        event.previousContainer.data,
        session.items,
        event.previousIndex,
        event.currentIndex
      );
      const fromId = parseInt(prevId.split('-')[1], 10);
      const fromSession = this.sessions.find(s => s.id === fromId)!;
      session.items     = [...session.items];
      fromSession.items = [...fromSession.items];
      this.persist();
      this.cdr.detectChanges();
    }
  }

  removeItem(session: Session, idx: number) {
    session.items.splice(idx, 1);
    session.items = [...session.items];
    this.persist();
    this.cdr.detectChanges();
  }

  // ----- persistencia -----
  private persist() {
    this.api.saveSessions(this.sessions);
  }

  clearCache() {
    localStorage.removeItem('fp_sessions');
    location.reload();
  }
}
