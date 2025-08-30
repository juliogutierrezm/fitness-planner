import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExerciseApiService } from '../../exercise-api.service';
import { Exercise, Session, PlanItem } from '../../shared/models';

type EditableField = 'sets' | 'reps' | 'rest' | 'notes';

interface EditingRow {
  sessionId: number;
  itemId: number;
  childIdx?: number;
  field: EditableField;
}

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
    MatCheckboxModule,
    MatTooltipModule,
  ],
  templateUrl: './planner.component.html',
  styleUrls: ['./planner.component.scss']
})
export class PlannerComponent implements OnInit {
  form!: FormGroup;
  exercises: Exercise[] = [];
  sessions: Session[] = [];
  exerciseListConnectedTo: string[] = [];
  sessionsConnectedTo: Record<string, string[]> = {};

  editingRow: EditingRow | null = null;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: ExerciseApiService
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      userName: [''],
      date: [new Date()],
      sessionCount: [3],
      notes: ['']
    });

    this.api.getExercises().subscribe(exs => {
      this.exercises = exs;
      this.cdr.markForCheck();
    });

    const loaded = this.api.loadSessions();
    if (loaded.length) {
      this.sessions = JSON.parse(JSON.stringify(loaded));
    } else {
      this.updateSessions(this.form.value.sessionCount);
    }
    this.rebuildDropLists();

    this.form.get('sessionCount')!.valueChanges.subscribe(count => {
      this.updateSessions(count);
      this.persist();
    });
  }

  generateWithAI() {
  const userPrompt = prompt('Describe el objetivo del plan (ej: Principiante, 4 días, fuerza + movilidad)');
  if (!userPrompt) return;

  this.api.generateWorkoutPlanAI(userPrompt).subscribe(res => {
    if (res?.plan) {
      this.sessions = res.plan.map((day: any, idx: number) => ({
        id: idx + 1,
        name: day.day,
        items: day.items.map((ex: any) => ({
          id: Date.now() + Math.random(),
          name: ex.name,
          equipment: '', // si no viene, se puede dejar vacío
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          notes: ex.notes,
          isGroup: false,
          selected: false
        }))
      }));
      this.form.patchValue({ sessionCount: this.sessions.length });
      this.persist();
    }
  });
}


  /*** Inline editing ***/
  startEdit(sessionId: number, itemId: number, field: EditableField, childIdx?: number) {
    this.editingRow = { sessionId, itemId, field, childIdx };
  }

  finishEdit() {
    this.persist();
    this.editingRow = null;
    this.cdr.detectChanges();
  }

  isEditing(sessionId: number, itemId: number, field: EditableField, childIdx?: number): boolean {
    if (!this.editingRow) return false;
    return (
      this.editingRow.sessionId === sessionId &&
      this.editingRow.itemId === itemId &&
      this.editingRow.field === field &&
      (this.editingRow.childIdx ?? -1) === (childIdx ?? -1)
    );
  }
  /*** End inline editing ***/

  private updateSessions(count: number) {
    this.sessions = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Día ${i + 1}`,
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

  dropSession(event: CdkDragDrop<Session[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(this.sessions, event.previousIndex, event.currentIndex);
      this.sessions.forEach((s, i) => {
        s.id = i + 1;
        s.name = `Día ${i + 1}`;
      });
      this.rebuildDropLists();
      this.persist();
      this.cdr.markForCheck();
    }
  }

  drop(event: CdkDragDrop<any, any>, session?: Session) {
    const prevId = event.previousContainer.id;
    const currId = event.container.id;

    if (prevId === currId && session) {
      moveItemInArray(session.items, event.previousIndex, event.currentIndex);
      session.items = [...session.items];
      this.persist();
      this.cdr.detectChanges();
      return;
    }

    if (prevId === 'exerciseList' && session) {
      const ex = event.item.data as Exercise;
      const newItem: PlanItem = {
        ...ex,
        id: Date.now().toString(),
        sets: 3,
        reps: 10,
        rest: 60,
        selected: false,
        isGroup: false
      };
      session.items.splice(event.currentIndex, 0, newItem);
      session.items = [...session.items];
      this.persist();
      this.cdr.detectChanges();
      return;
    }

    if (prevId.startsWith('session-') && currId.startsWith('session-') && session) {
      transferArrayItem(event.previousContainer.data, session.items, event.previousIndex, event.currentIndex);
      const fromId = parseInt(prevId.split('-')[1], 10);
      const fromSession = this.sessions.find(s => s.id === fromId)!;
      session.items = [...session.items];
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

  clearCache() {
    localStorage.removeItem('fp_sessions');
    location.reload();
  }

  toggleAllSelection(session: Session) {
    const allSelected = this.allSelected(session);
    session.items.forEach(item => {
      if (!item.isGroup) {
        item.selected = !allSelected;
      }
    });
    this.cdr.detectChanges();
  }

  allSelected(session: Session): boolean {
    return session.items.every(item => item.isGroup || item.selected);
  }

  someSelected(session: Session): boolean {
    return session.items.some(item => !item.isGroup && item.selected);
  }

  updateSelection(session: Session) {
    this.cdr.detectChanges();
  }

  hasSelectedItems(session: Session): boolean {
    return session.items.filter(item => !item.isGroup && item.selected).length >= 2;
  }

  hasSelectedGroup(session: Session): boolean {
    return session.items.some(item => item.isGroup && item.selected);
  }

  groupSelected(session: Session) {
    const selectedItems = session.items.filter(item => !item.isGroup && item.selected);
    if (selectedItems.length < 2) return;

    let newId = Date.now();
    while (session.items.some(item => Number(item.id) === newId)) {
      newId += 1;
    }

    const group: PlanItem = {
      id: newId.toString(),
      name: 'Superserie',
      equipment: '',
      sets: 0,
      reps: 0,
      rest: 0,
      isGroup: true,
      children: selectedItems.map(item => ({ ...item, selected: false }))
    };

    const firstIndex = session.items.findIndex(item => !item.isGroup && item.selected);
    session.items = session.items.filter(item => item.isGroup || !item.selected);
    session.items.splice(firstIndex, 0, group);

    this.persist();
    this.cdr.detectChanges();
  }

  ungroupSelected(session: Session) {
    const group = session.items.find(item => item.isGroup && item.selected);
    if (!group || !group.children) return;

    const idx = session.items.indexOf(group);
    session.items.splice(idx, 1, ...group.children);

    this.persist();
    this.cdr.detectChanges();
  }

  ungroupGroup(session: Session, index: number) {
    const group = session.items[index];
    if (!group.isGroup || !group.children) return;

    session.items = [
      ...session.items.slice(0, index),
      ...group.children,
      ...session.items.slice(index + 1)
    ];

    this.persist();
    this.cdr.detectChanges();
  }

  canDragGroup(item: PlanItem): boolean {
    return item.isGroup === true;
  }

  removeGroup(session: Session, idx: number) {
    session.items.splice(idx, 1);
    session.items = [...session.items];
    this.persist();
    this.cdr.detectChanges();
  }

  private persist() {
    this.api.saveSessions(this.sessions);
  }

submitPlan() {
  const formValue = this.form.value;

  const planData = {
    planId: `plan-${Date.now()}`,         // ID único
    userId: formValue.userName.trim(),
    trainerId: 'jorgefit',
    name: `Plan de ${formValue.userName}`,
    companyId: 'INDEPENDIENTE',           // o la empresa seleccionada más adelante
    date: new Date(formValue.date).toISOString(),
    sessions: this.sessions,
    generalNotes: formValue.notes               // ya contiene ejercicios, superseries, notas, etc.
  };

  this.api.saveWorkoutPlan(planData).subscribe(res => {
    if (res) {
      alert('✅ Plan guardado correctamente');
    } else {
      alert('❌ Hubo un error al guardar el plan');
    }
  });
}



}
