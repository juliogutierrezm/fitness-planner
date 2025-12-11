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
import { timer, switchMap, takeWhile, filter } from 'rxjs';

import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { PreviousPlansDialogComponent } from './previous-plans-dialog.component';
import { PlanPreviewDialogComponent } from './plan-preview-dialog.component';
import { AiPromptDialogComponent } from './ai-prompt-dialog.component';
import { AiParametricDialogComponent } from './ai-parametric-dialog.component';
import { ExercisePreviewDialogComponent } from './exercise-preview-dialog.component';
import { AuthService } from '../../services/auth.service';
import { Exercise, Session, PlanItem, ExerciseFilters, FilterOptions } from '../../shared/models';



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

  // Current filters data
  currentFilters: ExerciseFilters = {
    searchValue: '',
    categoryFilter: '',
    muscleGroupFilter: '',
    equipmentTypeFilter: ''
  };

  // Filter options populated from data
  filterOptions: FilterOptions = {
    categoryOptions: [],
    muscleGroupOptions: [],
    equipmentTypeOptions: []
  };

  // Persistence key
  private readonly STORAGE_KEY = 'planner-filters';
  favorites: Exercise[] = [];
  recents: Exercise[] = [];
  menuExercise: Exercise | null = null;
  sessions: Session[] = [];
  exerciseListConnectedTo: string[] = [];
  sessionsConnectedTo: Record<string, string[]> = {};


  planId: string | null = null;
  isEditMode = false;
  liveMessage = '';
  isGenerating = false;
  generationStep = '';
  generationStepIndex = 0;
  currentExecutionArn = '';
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

  // Abre un diálogo parametrico para configurar el plan con IA
  openAIDialog() {
    const ref = this.dialog.open(AiParametricDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {}
    });
    ref.afterClosed().subscribe((result?: { executionArn: string; planFormData?: any }) => {
      if (result?.executionArn && result?.planFormData) {
        // Auto-fill form with data from AI dialog
        this.form.patchValue({
          objective: result.planFormData.objective,
          sessionCount: result.planFormData.sessions,
          notes: result.planFormData.generalNotes
        });
        // Update userName with generated plan name if not in edit mode
        if (!this.isEditMode) {
          this.form.patchValue({ userName: result.planFormData.name });
        }
        // Start polling for the plan
        this.startPollingPlan(result.executionArn);
      }
    });
  }

  // Polling implementation for AI plan generation
  startPollingPlan(executionArn: string): void {
    this.isGenerating = true;
    this.currentExecutionArn = executionArn;
    this.generationStep = 'Generando plan con IA...';

    timer(0, 3000).pipe(
      switchMap(() => this.api.getGeneratedPlan(executionArn)),
      filter(res => res.status !== 'running'),
      takeWhile(res => res.status === 'running', true)
    ).subscribe({
      next: (res) => {
        if (res.status === 'succeeded') {
          // Plan is ready, load it into the planner
          this.loadPlanIntoPlanner(res);
          this.isGenerating = false;
          this.generationStep = '';
          this.currentExecutionArn = '';
          this.snackBar.open('Plan generado exitosamente!', undefined, { duration: 2000 });
        } else if (res.status === 'failed') {
          this.isGenerating = false;
          this.generationStep = '';
          this.currentExecutionArn = '';
          this.snackBar.open('Error al generar el plan. Por favor, inténtalo de nuevo.', undefined, { duration: 4000 });
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error polling plan:', error);
        this.isGenerating = false;
        this.generationStep = '';
        this.currentExecutionArn = '';
        this.snackBar.open('Error de conexión. Por favor, verifica tu conexión a internet.', undefined, { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
  }

  // Load generated plan into planner
  loadPlanIntoPlanner(planResponse: any): void {
    const sessions = this.createSessionsFromAI(planResponse);
    if (!sessions.length) {
      this.snackBar.open('No se pudo interpretar el plan generado.', undefined, { duration: 3000 });
      return;
    }

    this.sessions = sessions;
    const patch: any = { sessionCount: this.sessions.length };

    // Use generalNotes from the response if available
    const generalNotes = planResponse.generalNotes ||
                        (typeof planResponse.generalNotes === 'string' && planResponse.generalNotes.trim());

    if (generalNotes) {
      patch.notes = generalNotes;
    }

    this.form.patchValue(patch);
    this.rebuildDropLists();
    this.persist();
  }

  // Genera plan con indicador de carga mejorado
  private runGenerateAI(params: any) {
    this.isGenerating = true;
    this.generationStepIndex = 0;
    this.generationStep = this.generationSteps[0];

    this.startStepRotation();

    this.api.generateWorkoutPlanAI(params)
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

        // Use generalNotes from the response or params
        const generalNotes = params.generalNotes ||
                           (typeof res?.generalNotes === 'string' && res.generalNotes.trim());

        if (generalNotes) {
          patch.notes = generalNotes;
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
      name: day?.name || day?.day || 'Sesión ' + (idx + 1),
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
        weight: typeof raw.weight === 'number' ? raw.weight : undefined,
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
      weight: typeof raw.weight === 'number' ? raw.weight : undefined,
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

    this.api.getExerciseLibrary().subscribe(libraryResponse => {
      // Handle DynamoDB format if needed and flatten data
      const rawItems = libraryResponse.items;
      this.exercises = this.transformExercises(rawItems);
      // Build filter options and apply initial filtering
      this.populateFilterOptions();
      this.loadFiltersFromStorage();
      this.applyCombinedFilter();
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
    this.applyCombinedFilter();
  }

  onFiltersChanged(filters: ExerciseFilters): void {
    this.currentFilters = filters;
    this.applyCombinedFilter();
  }

  clearFilters() {
    this.currentFilters = {
      searchValue: '',
      categoryFilter: '',
      muscleGroupFilter: '',
      equipmentTypeFilter: ''
    };
    this.applyCombinedFilter();
  }

  private populateFilterOptions(): void {
    const categories = new Set<string>();
    const muscleGroups = new Set<string>();
    const equipmentTypes = new Set<string>();

    this.exercises.forEach(ex => {
      const category = this.getFieldValue(ex, 'category');
      const muscleGroup = this.getFieldValue(ex, 'muscle_group');
      const equipmentType = this.getFieldValue(ex, 'equipment_type');

      if (category) categories.add(category);
      if (muscleGroup) muscleGroups.add(muscleGroup);
      if (equipmentType) equipmentTypes.add(equipmentType);
    });

    this.filterOptions = {
      categoryOptions: Array.from(categories).sort(),
      muscleGroupOptions: Array.from(muscleGroups).sort(),
      equipmentTypeOptions: Array.from(equipmentTypes).sort()
    };
  }

  private loadFiltersFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved);
        this.currentFilters = {
          searchValue: filters.searchValue || '',
          categoryFilter: filters.categoryFilter || '',
          muscleGroupFilter: filters.muscleGroupFilter || '',
          equipmentTypeFilter: filters.equipmentTypeFilter || ''
        };
      }
    } catch (error) {
      console.warn('Failed to load filters from storage:', error);
    }
  }

  private saveFiltersToStorage(): void {
    try {
      const filters = this.currentFilters;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters to storage:', error);
    }
  }

  getFieldValue(exercise: Exercise, field: string): any {
    // Handle field fallbacks for legacy data
    switch (field) {
      case 'name_es':
        return exercise.name_es || exercise.name;
      case 'equipment_type':
        return exercise.equipment_type || exercise.equipment;
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      case 'exercise_type':
        return exercise.exercise_type || exercise.category;
      default:
        return (exercise as any)[field];
    }
  }

  private applyCombinedFilter(): void {
    // Combine all filters and apply to data source
    this.filteredExercises = this.exercises.filter(exercise => {
      // Text search on name_es only
      const matchesSearch = !this.currentFilters.searchValue.trim() ||
        (this.getFieldValue(exercise, 'name_es') || '').toLowerCase()
          .includes(this.currentFilters.searchValue.toLowerCase());

      // Category filter
      const matchesCategory = !this.currentFilters.categoryFilter ||
        this.getFieldValue(exercise, 'category') === this.currentFilters.categoryFilter;

      // Muscle group filter
      const matchesMuscleGroup = !this.currentFilters.muscleGroupFilter ||
        this.getFieldValue(exercise, 'muscle_group') === this.currentFilters.muscleGroupFilter;

      // Equipment type filter
      const matchesEquipmentType = !this.currentFilters.equipmentTypeFilter ||
        this.getFieldValue(exercise, 'equipment_type') === this.currentFilters.equipmentTypeFilter;

      return matchesSearch && matchesCategory && matchesMuscleGroup && matchesEquipmentType;
    });

    this.saveFiltersToStorage();
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

  private transformExercises(rawItems: any[]): Exercise[] {
    return rawItems.map(item => this.flattenDynamoItem(item));
  }

  private flattenDynamoItem(raw: any): Exercise {
    // Flatten DynamoDB format (e.g., {name_es: {S: "value"}} => {name_es: "value"})
    const flattened: any = {};

    for (const [key, value] of Object.entries(raw)) {
      if (value && typeof value === 'object') {
        if ('S' in value) {
          // String value
          flattened[key] = (value as any).S || '';
        } else if ('N' in value) {
          // Number value
          flattened[key] = Number((value as any).N) || 0;
        } else if ('BOOL' in value) {
          // Boolean value
          flattened[key] = (value as any).BOOL;
        } else if ('L' in value) {
          // List/Array value
          const list = (value as any).L || [];
          flattened[key] = list.map((item: any) => {
            if (item.S !== undefined) return item.S;
            if (item.N !== undefined) return Number(item.N);
            if (item.BOOL !== undefined) return item.BOOL;
            return item;
          });
        } else if ('SS' in value) {
          // String Set
          flattened[key] = (value as any).SS || [];
        } else {
          // Other types, keep as is
          flattened[key] = value;
        }
      } else {
        flattened[key] = value;
      }
    }

    return flattened as Exercise;
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
            weight: ex.weight,
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

  openExercisePreview(exercise: Exercise) {
    this.dialog.open(ExercisePreviewDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      data: { exercise }
    });
  }



  private updateSessions(count: number) {
    const currentSessions = this.sessions || [];
    this.sessions = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Sesión ${i + 1}`,
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
        s.name = `Sesión ${i + 1}`;
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
        equipment: ex.equipment_type || ex.equipment || 'Sin equipo',
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
      id: Date.now().toString(),
      name: ex.name_es || ex.name || 'Ejercicio sin nombre',
      equipment: ex.equipment_type || ex.equipment || 'Sin equipo',
      sets: 3,
      reps: 10,
      rest: 60,
      weight: undefined,
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



  persist() {
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
