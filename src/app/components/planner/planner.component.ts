import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; // Import ActivatedRoute and Router
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
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
    MatSnackBarModule,
    MatSelectModule,
    MatMenuModule,
    ScrollingModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planner.component.html',
  styleUrls: ['./planner.component.scss']
})
export class PlannerComponent implements OnInit {
  form!: FormGroup;
  exercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];
  muscles: string[] = [];
  categories: string[] = [];
  equipments: string[] = [];
  filters = { muscle: '', category: '', equipment: '', q: '' };
  favorites: Exercise[] = [];
  recents: Exercise[] = [];
  menuExercise: Exercise | null = null;
  sessions: Session[] = [];
  exerciseListConnectedTo: string[] = [];
  sessionsConnectedTo: Record<string, string[]> = {};

  editingRow: EditingRow | null = null;
  planId: string | null = null;
  isEditMode = false;
  liveMessage = '';

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: ExerciseApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.planId;

    this.form = this.fb.group({
      userName: [''],
      date: [new Date()],
      sessionCount: [3],
      notes: ['']
    });

    this.api.getExercises().subscribe(exs => {
      this.exercises = exs;
      // Build filter options
      const uniq = (arr: (string|undefined)[]) => Array.from(new Set(arr.filter(Boolean) as string[])).sort();
      this.muscles = uniq(exs.map(e => e.muscle));
      this.categories = uniq(exs.map(e => e.category));
      this.equipments = uniq(exs.map(e => e.equipment));
      this.applyFilters();
      this.cdr.markForCheck();
    });

    // Load favorites/recents
    try {
      this.favorites = JSON.parse(localStorage.getItem('fp_favorites') || '[]');
      this.recents = JSON.parse(localStorage.getItem('fp_recents') || '[]');
    } catch {
      this.favorites = [];
      this.recents = [];
    }

    if (this.isEditMode && this.planId) {
      this.api.getWorkoutPlanById(this.planId).subscribe(plan => {
        if (plan) {
          const parsedSessions = (() => {
            try {
              return typeof plan.sessions === 'string' ? JSON.parse(plan.sessions || '[]') : (plan.sessions || []);
            } catch {
              return [];
            }
          })();
          this.form.patchValue({
            userName: plan.name.replace('Plan de ', ''),
            date: new Date(plan.date),
            sessionCount: parsedSessions.length,
            notes: plan.generalNotes
          });
          this.sessions = parsedSessions;
          this.rebuildDropLists();
          this.applyUiState();
          this.cdr.markForCheck();
        }
      });
    } else {
      const currentUser = this.authService.getCurrentUser();
      const displayName = currentUser ? 
        `${currentUser.givenName || ''} ${currentUser.familyName || ''}`.trim() || 
        currentUser.email?.split('@')[0] || 'Usuario' : 'Usuario';
      this.form.patchValue({ userName: displayName });

      const loaded = this.api.loadSessions();
      if (loaded.length) {
        this.sessions = JSON.parse(JSON.stringify(loaded));
      } else {
        this.updateSessions(this.form.value.sessionCount);
      }
      this.rebuildDropLists();
      this.applyUiState();

      // This subscription should only be active in create mode
      this.form.get('sessionCount')!.valueChanges.subscribe(count => {
        this.updateSessions(count);
        this.persist();
        this.persistUiState();
      });
    }
  }

  onFilterChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.filters = { muscle: '', category: '', equipment: '', q: '' };
    this.applyFilters();
  }

  private applyFilters() {
    const { muscle, category, equipment, q } = this.filters;
    const qn = (q || '').trim().toLowerCase();
    this.filteredExercises = this.exercises.filter(e =>
      (!muscle || (e.muscle || '') === muscle) &&
      (!category || (e.category || '') === category) &&
      (!equipment || (e.equipment || '') === equipment) &&
      (!qn || e.name.toLowerCase().includes(qn))
    );
  }

  private applyUiState() {
    try {
      const key = this.getUiKey();
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const ui = JSON.parse(raw) as Array<{ id: number; pinned?: boolean; collapsed?: boolean }>;
      const map = new Map(ui.map(x => [x.id, x]));
      this.sessions = this.sessions.map(s => ({ ...s, ...map.get(s.id) }));
      this.sessions = [...this.sessions].sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    } catch {}
  }

  private persistUiState() {
    const key = this.getUiKey();
    const minimal = this.sessions.map((s: any) => ({ id: s.id, pinned: s.pinned, collapsed: s.collapsed }));
    localStorage.setItem(key, JSON.stringify(minimal));
  }

  private getUiKey() {
    return `fp_planner_ui_${this.authService.getCurrentUserId() || 'anon'}`;
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
    const currentSessions = this.sessions || [];
    this.sessions = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Día ${i + 1}`,
      items: currentSessions[i]?.items || []
    }));
    this.rebuildDropLists();
  }

  private rebuildDropLists() {
    if (!this.sessions) return;
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
      this.addRecent(ex);
      this.snackBar.open('Ejercicio añadido', undefined, { duration: 1200 });
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
    const removed = session.items[idx];
    session.items.splice(idx, 1);
    session.items = [...session.items];
    this.persist();
    this.cdr.detectChanges();
    const ref = this.snackBar.open('Ejercicio eliminado', 'Deshacer', { duration: 4000 });
    ref.onAction().subscribe(() => {
      session.items.splice(idx, 0, removed);
      session.items = [...session.items];
      this.persist();
      this.cdr.markForCheck();
      this.liveAnnounce('Ejercicio restaurado');
    });
    this.liveAnnounce('Ejercicio eliminado');
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
    const snapshot: any = JSON.parse(JSON.stringify(group));
    session.items.splice(idx, 1, ...group.children);

    this.persist();
    this.cdr.detectChanges();
    const ref = this.snackBar.open('Superserie deshecha', 'Deshacer', { duration: 4000 });
    ref.onAction().subscribe(() => {
      session.items.splice(idx, snapshot.children!.length, snapshot);
      session.items = [...session.items];
      this.persist();
      this.cdr.markForCheck();
    });
    this.liveAnnounce('Superserie deshecha');
  }

  ungroupGroup(session: Session, index: number) {
    const group = session.items[index];
    if (!group.isGroup || !group.children) return;

    const snapshot: any = JSON.parse(JSON.stringify(group));
    session.items = [
      ...session.items.slice(0, index),
      ...group.children,
      ...session.items.slice(index + 1)
    ];

    this.persist();
    this.cdr.detectChanges();
    const ref = this.snackBar.open('Superserie deshecha', 'Deshacer', { duration: 4000 });
    ref.onAction().subscribe(() => {
      session.items.splice(index, snapshot.children!.length, snapshot);
      session.items = [...session.items];
      this.persist();
      this.cdr.markForCheck();
    });
    this.liveAnnounce('Superserie deshecha');
  }

  canDragGroup(item: PlanItem): boolean {
    return item.isGroup === true;
  }

  removeGroup(session: Session, idx: number) {
    const removed = session.items[idx];
    session.items.splice(idx, 1);
    session.items = [...session.items];
    this.persist();
    this.cdr.detectChanges();
    const ref = this.snackBar.open('Superserie eliminada', 'Deshacer', { duration: 4000 });
    ref.onAction().subscribe(() => {
      session.items.splice(idx, 0, removed);
      session.items = [...session.items];
      this.persist();
      this.cdr.markForCheck();
    });
  }

  addExerciseToSession(session: Session, ex: Exercise) {
    const item: PlanItem = {
      ...ex,
      id: Date.now().toString(),
      sets: 3,
      reps: 10,
      rest: 60,
      selected: false,
      isGroup: false
    };
    session.items = [item, ...session.items];
    this.persist();
    this.cdr.markForCheck();
    this.addRecent(ex);
    this.snackBar.open('Ejercicio añadido', undefined, { duration: 1200 });
    this.liveAnnounce('Ejercicio añadido');
  }

  toggleFavorite(ex: Exercise) {
    const exists = this.favorites.find(f => f.id === ex.id);
    this.favorites = exists
      ? this.favorites.filter(f => f.id !== ex.id)
      : [ex, ...this.favorites].slice(0, 50);
    localStorage.setItem('fp_favorites', JSON.stringify(this.favorites));
    this.cdr.markForCheck();
  }

  isFavorite(ex: Exercise): boolean {
    return this.favorites.some(f => f.id === ex.id);
  }

  onOpenAddMenu(ex: Exercise) {
    this.menuExercise = ex;
  }

  private addRecent(ex: Exercise) {
    this.recents = [ex, ...this.recents.filter(r => r.id !== ex.id)].slice(0, 12);
    localStorage.setItem('fp_recents', JSON.stringify(this.recents));
  }

  // Drag auto-scroll near viewport edges
  onDragMoved(event: any) {
    const y = event.pointerPosition?.y ?? 0;
    const threshold = 80;
    if (y < threshold) {
      window.scrollBy({ top: -20, behavior: 'smooth' });
    } else if (y > (window.innerHeight - threshold)) {
      window.scrollBy({ top: 20, behavior: 'smooth' });
    }
  }

  togglePin(session: any) {
    session.pinned = !session.pinned;
    this.sessions = [...this.sessions].sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    this.persistUiState();
    this.cdr.markForCheck();
  }

  toggleCollapse(session: any) {
    session.collapsed = !session.collapsed;
    this.persistUiState();
    this.cdr.markForCheck();
  }

  expandSession(session: any) {
    if (session.collapsed) {
      session.collapsed = false;
      this.persistUiState();
      this.cdr.markForCheck();
    }
  }

  private liveAnnounce(msg: string) {
    this.liveMessage = msg;
    setTimeout(() => {
      this.liveMessage = '';
      this.cdr.markForCheck();
    }, 1200);
  }

  // TrackBy helpers
  trackByExercise = (_: number, e: Exercise) => e.id;
  trackBySession = (_: number, s: Session) => s.id;
  trackByItem = (_: number, i: PlanItem) => i.id;
  trackByChild = (_: number, i: PlanItem) => i.id;

  private persist() {
    if (!this.isEditMode) {
      this.api.saveSessions(this.sessions);
    }
  }

  submitPlan() {
    if (this.isEditMode && !this.planId) {
      console.error('Cannot update plan without a planId');
      alert('❌ Error: No se encontró el ID del plan para actualizar.');
      return;
    }

    const formValue = this.form.value;
    const planData = {
      planId: this.isEditMode ? this.planId! : `plan-${Date.now()}`,
      name: `Plan de ${formValue.userName}`,
      date: new Date(formValue.date).toISOString(),
      sessions: this.sessions,
      generalNotes: formValue.notes,
      userId: this.authService.getCurrentUserId()
    };

    const action = this.isEditMode 
      ? this.api.updateWorkoutPlan(planData)
      : this.api.saveWorkoutPlan(planData as any);

    action.subscribe(res => {
      if (res) {
        this.snackBar.open(`Plan ${this.isEditMode ? 'actualizado' : 'guardado'} correctamente`, 'Cerrar', { duration: 2500 });
        this.router.navigate(['/workout-plans']);
      } else {
        this.snackBar.open(`Hubo un error al ${this.isEditMode ? 'actualizar' : 'guardar'} el plan`, 'Cerrar', { duration: 3500 });
      }
    });
  }
}
