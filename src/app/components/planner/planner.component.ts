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
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { WorkoutPlanViewComponent } from '../workout-plan-view/workout-plan-view.component';
import { PreviousPlansDialogComponent } from './previous-plans-dialog.component';
import { PlanPreviewDialogComponent } from './plan-preview-dialog.component';
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
    MatDialogModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
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
  isGenerating = false;
  generationStep = '';
  generationStepIndex = 0;
  previousPlans: any[] = [];
  selectedPreviewPlan: any | null = null;
  private readonly prevLimit = 8;
  canAssignUser = false;
  clients: AppUser[] = [];
  isSpecificUser = false;
  isClientNameReadonly = false;
  private generationSteps = [
    'Estamos creando tu plan de entrenamiento con IA...',
    'Generando sesiones de entrenamiento...',
    'Seleccionando ejercicios apropiados...',
    'Ajustando series y repeticiones...',
    'Optimizando tiempos de descanso...',
    'Finalizando plan personalizado...'
  ];
  private stepInterval: any;
  private aiTempIdCounter = 0;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private api: ExerciseApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private userApi: UserApiService
  ) {}

  // Abre un diálogo amplio para escribir el prompt de IA
  openAIDialog() {
    const ref = this.dialog.open(AiPromptDialogComponent, {
      width: '720px',
      maxWidth: '90vw',
      data: {}
    });
    ref.afterClosed().subscribe((userPrompt?: string) => {
      if (userPrompt) {
        this.runGenerateAI(userPrompt);
      }
    });
  }

  // Genera plan con indicador de carga mejorado
  private runGenerateAI(userPrompt: string) {
    this.isGenerating = true;
    this.generationStepIndex = 0;
    this.generationStep = this.generationSteps[0];

    this.startStepRotation();

    this.api.generateWorkoutPlanAI(userPrompt)
      .pipe(finalize(() => {
        this.isGenerating = false;
        this.stopStepRotation();
        this.generationStep = '';
        this.cdr.markForCheck();
      }))
      .subscribe(res => {
        const sessionsFromAI = this.createSessionsFromAI(res);
        if (!sessionsFromAI.length) {
          this.snackBar.open('No se pudo interpretar la respuesta de la IA.', undefined, { duration: 3000 });
          return;
        }

        this.sessions = sessionsFromAI;
        const patch: any = { sessionCount: this.sessions.length };
        if (typeof res?.generalNotes === 'string' && res.generalNotes.trim()) {
          patch.notes = res.generalNotes.trim();
        }
        this.form.patchValue(patch);
        this.rebuildDropLists();
        this.persist();
        this.snackBar.open('Plan generado exitosamente!', undefined, { duration: 2000 });
        this.cdr.markForCheck();
      });
  }

  private createSessionsFromAI(res: any): Session[] {
    this.aiTempIdCounter = 0;

    const plan = Array.isArray(res?.plan) ? res.plan : [];
    const planLegacy = Array.isArray(res?.planLegacy) ? res.planLegacy : [];
    const source = plan.length ? plan : planLegacy;

    return source.map((day: any, idx: number) => ({
      id: idx + 1,
      name: day?.name || day?.day || 'Dia ' + (idx + 1),
      items: this.normaliseAiItems(day?.items, plan.length > 0)
    }));
  }

  private normaliseAiItems(items: any, treatGroups: boolean): PlanItem[] {
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map(item => this.normaliseAiItem(item, treatGroups))
      .filter((item: PlanItem | null): item is PlanItem => !!item);
  }

  private normaliseAiItem(raw: any, treatGroups: boolean): PlanItem | null {
    if (!raw) {
      return null;
    }

    if (treatGroups && (raw.isGroup || Array.isArray(raw.children))) {
      const children = Array.isArray(raw.children)
        ? raw.children
            .map((child: any) => this.normaliseAiItem({ ...child, isGroup: false }, treatGroups))
            .filter((child: PlanItem | null): child is PlanItem => !!child)
        : [];

      if (!children.length) {
        return null;
      }

      return {
        ...(raw as any),
        id: this.ensureAiId(raw.id, 'group'),
        name: raw.name || raw.displayName || 'Superserie',
        equipment: '',
        sets: this.ensureAiNumber(raw.sets, children[0]?.sets ?? 3),
        reps: this.ensureAiReps(raw.reps, children[0]?.reps ?? 10),
        rest: this.ensureAiNumber(raw.rest, children[0]?.rest ?? 60),
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        isGroup: true,
        selected: false,
        children
      };
    }

    const base: PlanItem = {
      ...(raw as any),
      id: this.ensureAiId(raw.id, 'item'),
      name: raw.name || 'Ejercicio',
      equipment: raw.equipment || '',
      sets: this.ensureAiNumber(raw.sets, 3),
      reps: this.ensureAiReps(raw.reps, 10),
      rest: this.ensureAiNumber(raw.rest, 60),
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      isGroup: false,
      selected: false
    };

    delete (base as any).children;
    return base;
  }

  private ensureAiId(source: any, prefix: 'item' | 'group' = 'item'): string {
    if (typeof source === 'string' && source.trim()) {
      return source.trim();
    }
    if (typeof source === 'number' && Number.isFinite(source)) {
      return source.toString();
    }
    const suffix = Date.now().toString(36) + '-' + this.aiTempIdCounter++;
    return prefix + '-' + suffix;
  }

  private ensureAiNumber(value: any, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private ensureAiReps(value: any, fallback: number | string): number | string {
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    return fallback;
  }

  private startStepRotation() {
    this.stepInterval = setInterval(() => {
      this.generationStepIndex = (this.generationStepIndex + 1) % this.generationSteps.length;
      this.generationStep = this.generationSteps[this.generationStepIndex];
      this.cdr.markForCheck();
    }, 2000); // Change message every 2 seconds
  }

  private stopStepRotation() {
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
  }

  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.planId;

    this.form = this.fb.group({
      userName: [''],
      date: [null],
      sessionCount: [3],
      notes: [''],
      targetUserId: [''],
      objective: ['']
    });

    // Subscribe to targetUserId changes to populate userName and set readonly
    this.form.get('targetUserId')!.valueChanges.subscribe(userId => {
      this.isClientNameReadonly = !!userId;
      if (userId) {
        this.userApi.getUserById(userId).subscribe(user => {
          if (user) {
            const displayName = `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email?.split('@')[0] || 'Usuario';
            this.form.patchValue({ userName: displayName });
            this.cdr.markForCheck();
          }
        });
      } else {
        this.form.patchValue({ userName: '' });
        this.cdr.markForCheck();
      }
    });

    // Check if arriving from user detail
    const qpUserId = this.route.snapshot.queryParamMap.get('userId');
    this.isSpecificUser = !!qpUserId;
    if (qpUserId) {
      this.form.patchValue({ targetUserId: qpUserId });
      // Fetch user details to prefill userName
      this.userApi.getUserById(qpUserId).subscribe(user => {
        if (user) {
          const displayName = `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email?.split('@')[0] || 'Usuario';
          this.form.patchValue({ userName: displayName });
          this.cdr.markForCheck();
        }
      });
    }

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

    // Load assignable users if trainer independent or admin
    const current = this.authService.getCurrentUser();
    if (current?.role === 'admin') {
      this.canAssignUser = true;
      this.userApi.getUsersByCompany().subscribe(list => { this.clients = list; this.cdr.markForCheck(); });
    } else if (current?.role === 'trainer' && !current.companyId) {
      this.canAssignUser = true;
      this.userApi.getUsersByTrainer().subscribe(list => { this.clients = list; this.cdr.markForCheck(); });
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
            userName: plan.name.replace(/^(Plan de |.* Plan \d+ )/, ''),
            date: new Date(plan.date),
            sessionCount: parsedSessions.length,
            notes: plan.generalNotes,
            objective: plan.objective || ''
          });
          this.sessions = parsedSessions;
          this.rebuildDropLists();
          this.applyUiState();
      this.cdr.markForCheck();
    }
  });
  } else {
      // Clear any previous sessions from localStorage for clean start
      this.api.clearUserSessions();

      // Always start with empty sessions for new plans
      this.updateSessions(this.form.value.sessionCount);
      this.rebuildDropLists();
      this.applyUiState();
    }

    // Subscribe to sessionCount changes in both create and edit modes
    this.form.get('sessionCount')!.valueChanges.subscribe(count => {
      this.updateSessions(count);
      this.persist();
      this.persistUiState();
      this.cdr.markForCheck();
    });

    // Load previous plans (latest N) for quick preview in AI overlay
    this.api.getWorkoutPlansByUser().subscribe(list => {
      const sorted = (list || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // Parse sessions to ensure they're arrays, not JSON strings
      this.previousPlans = sorted.slice(0, this.prevLimit).map(plan => ({
        ...plan,
        sessions: (() => {
          try {
            return typeof plan.sessions === 'string' ? JSON.parse(plan.sessions || '[]') : (plan.sessions || []);
          } catch {
            return [];
          }
        })()
      }));
      this.cdr.markForCheck();
    });
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
      const ui = JSON.parse(raw) as Array<{ id: number; collapsed?: boolean }>;
      const map = new Map(ui.map(x => [x.id, x]));
      this.sessions = this.sessions.map(s => ({ ...s, ...map.get(s.id) }));
    } catch {}
  }

  private persistUiState() {
    const key = this.getUiKey();
    const minimal = this.sessions.map((s: any) => ({ id: s.id, collapsed: s.collapsed }));
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

  openPreviewInline(plan: any) { this.selectedPreviewPlan = plan; this.cdr.markForCheck(); }
  closePreviewInline() { this.selectedPreviewPlan = null; this.cdr.markForCheck(); }

  openPreviousPlansDialog() {
    const dialogRef = this.dialog.open(PreviousPlansDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      data: { plans: this.previousPlans }
    });

    dialogRef.afterClosed().subscribe(result => {
      // Handle any actions after dialog closes if needed
      if (result) {
        // Could navigate to plan details or perform other actions
      }
    });
  }

  openPlanPreview(plan: any) {
    this.dialog.open(PlanPreviewDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      data: { plan }
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
    this.cdr.markForCheck();
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

  toggleCollapse(session: any) {
    session.collapsed = !session.collapsed;
    this.persistUiState();
    this.cdr.markForCheck();
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
  trackByPlan = (_: number, p: any) => p.id || p.name;

  getUserDisplayName(): string {
    const formValue = this.form.value;
    if (formValue.targetUserId) {
      // Find the user in clients list
      const user = this.clients.find(c => c.id === formValue.targetUserId);
      if (user) {
        return `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email?.split('@')[0] || 'Usuario';
      }
    }
    return formValue.userName || 'Usuario sin asignar';
  }

  private persist() {
    if (!this.isEditMode) {
      this.api.saveSessions(this.sessions);
    }
  }

  private async getNextPlanNumber(userId: string): Promise<number> {
    try {
      const existingPlans = await this.api.getWorkoutPlansByUser(userId).toPromise();
      return (existingPlans?.length || 0) + 1;
    } catch (error) {
      console.error('Error fetching existing plans:', error);
      return 1; // Default to 1 if there's an error
    }
  }

  async submitPlan() {
    if (this.isEditMode && !this.planId) {
      console.error('Cannot update plan without a planId');
      alert('❌ Error: No se encontró el ID del plan para actualizar.');
      return;
    }

    const formValue = this.form.value;
    const userId = formValue.targetUserId || this.authService.getCurrentUserId();

    // Generate plan name with number for new plans
    let planName: string;
    if (this.isEditMode) {
      // Keep existing name for edit mode
      planName = `Plan de ${formValue.userName || 'Usuario'}`;
    } else {
      // Generate numbered name for new plans
      const planNumber = await this.getNextPlanNumber(userId);
      planName = `${formValue.userName || 'Usuario'} Plan ${planNumber}`;
    }

    const planData = {
      planId: this.isEditMode ? this.planId! : `plan-${Date.now()}`,
      name: planName,
      date: formValue.date ? new Date(formValue.date).toISOString() : new Date().toISOString(),
      sessions: this.sessions,
      generalNotes: formValue.notes,
      objective: formValue.objective,
      userId: userId
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

// Diálogo mejorado para prompt de IA con mejor UX
@Component({
  selector: 'app-ai-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, TextFieldModule],
  template: `
    <div class="ai-dialog-container">
      <div class="ai-dialog-header">
        <div class="ai-dialog-title">
          <mat-icon class="ai-icon">psychology</mat-icon>
          <h2>Generar plan con IA</h2>
        </div>
        <div class="ai-dialog-divider"></div>
      </div>

      <div class="ai-dialog-content">
        <div class="ai-help-card">
          <mat-icon class="help-icon">lightbulb</mat-icon>
          <div class="help-content">
            <strong class="help-title">Consejos para mejores resultados:</strong>
            <ul class="help-list">
              <li class="help-item">Nivel de experiencia (principiante, intermedio, avanzado)</li>
              <li class="help-item">Días disponibles por semana</li>
              <li class="help-item">Objetivos específicos (fuerza, masa muscular, pérdida de peso, etc.)</li>
              <li class="help-item">Limitaciones físicas o equipo disponible</li>
              <li class="help-item">Duración preferida de las sesiones</li>
            </ul>
          </div>
        </div>

        <mat-form-field appearance="outline" class="prompt-field">
          <mat-label>Instrucciones detalladas para la IA</mat-label>
          <textarea
            matInput
            [(ngModel)]="prompt"
            class="prompt-textarea"
            placeholder="Ejemplo: Soy principiante, tengo 3-4 días disponibles por semana, quiero enfocarme en fuerza general y mejorar mi movilidad. Cada sesión debería durar entre 45-60 minutos. Tengo acceso a mancuernas, barras y máquinas básicas. Me gustaría incluir calentamiento específico y trabajo de core en cada sesión."
            rows="4"
          ></textarea>
          <mat-hint>Cuanto más detallado seas, mejor será el plan generado</mat-hint>
        </mat-form-field>
      </div>

      <div class="ai-dialog-actions">
        <button mat-stroked-button (click)="close()" class="cancel-btn">
          <mat-icon>close</mat-icon>
          Cancelar
        </button>
        <button
          mat-raised-button
          color="primary"
          [disabled]="!prompt.trim()"
          (click)="confirm()"
          class="generate-btn"
        >
          <mat-icon>auto_awesome</mat-icon>
          Generar Plan
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-dialog-container {
      padding: 24px;
      min-height: 500px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .ai-dialog-header {
      margin-bottom: 24px;
      flex-shrink: 0;
    }

    .ai-dialog-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--ink-900);
      }

      .ai-icon {
        color: var(--primary-600);
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
      }
    }

    .ai-dialog-divider {
      height: 1px;
      background: var(--bg-200);
      margin-top: 16px;
    }

    .ai-dialog-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 0;
    }

    .ai-help-card {
      display: flex;
      gap: 12px;
      background: var(--bg-50);
      padding: 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--bg-200);
      flex-shrink: 0;

      .help-icon {
        color: var(--accent-500);
        font-size: 1.25rem;
        margin-top: 2px;
        flex-shrink: 0;
      }

      .help-content {
        flex: 1;

        .help-title {
          color: var(--ink-900);
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .help-list {
          margin: 0;
          padding: 0;
          list-style: none;

          .help-item {
            color: var(--ink-600);
            margin-bottom: 6px;
            line-height: 1.5;
            padding-left: 16px;
            position: relative;

            &:before {
              content: '•';
              color: var(--accent-500);
              font-weight: bold;
              position: absolute;
              left: 0;
            }

            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }
    }

    .prompt-field {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 120px;

      ::ng-deep .mat-mdc-form-field-outline {
        color: var(--ink-300);
      }

      ::ng-deep .mat-mdc-form-field-focus-overlay {
        background-color: rgba(var(--primary-600), 0.04);
      }

      .prompt-textarea {
        font-family: inherit;
        line-height: 1.5;
        resize: none;
        min-height: 100px;
        padding: 12px;
        border-radius: var(--radius-sm);
      }

      .mat-mdc-form-field-hint {
        color: var(--ink-500);
        margin-top: 4px;
      }
    }

    .ai-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 24px;
      margin-top: 24px;
      border-top: 1px solid var(--bg-200);
      flex-shrink: 0;

      .cancel-btn {
        color: var(--ink-600);
        border-color: var(--ink-300);

        &:hover {
          background: var(--bg-50);
          border-color: var(--ink-400);
        }
      }

      .generate-btn {
        min-width: 140px;

        &[disabled] {
          opacity: 0.6;
        }
      }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .ai-dialog-container {
        padding: 20px;
        min-height: 450px;
      }

      .ai-dialog-title {
        gap: 8px;

        h2 {
          font-size: 1.25rem;
        }

        .ai-icon {
          font-size: 1.5rem;
          width: 1.5rem;
          height: 1.5rem;
        }
      }

      .ai-help-card {
        padding: 12px;
        gap: 8px;

        .help-content .help-list .help-item {
          padding-left: 12px;
          font-size: 0.9rem;
        }
      }

      .ai-dialog-actions {
        flex-direction: column-reverse;
        gap: 8px;

        button {
          width: 100%;
          margin: 0;
        }
      }
    }

    @media (max-width: 480px) {
      .ai-dialog-container {
        padding: 16px;
      }

      .ai-dialog-header {
        margin-bottom: 16px;
      }

      .ai-dialog-content {
        gap: 16px;
      }

      .ai-help-card {
        flex-direction: column;
        gap: 8px;
        padding: 12px;

        .help-icon {
          align-self: flex-start;
        }
      }
    }
  `]
})
export class AiPromptDialogComponent {
  prompt = '';
  constructor(public dialogRef: MatDialogRef<AiPromptDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {}
  close(){ this.dialogRef.close(); }
  confirm(){ this.dialogRef.close(this.prompt); }
}

