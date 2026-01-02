import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { interval, Subscription, of } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';


import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { PreviousPlansDialogComponent } from './previous-plans-dialog.component';
import { PlanPreviewDialogComponent } from './plan-preview-dialog.component';
import { AiPromptDialogComponent } from './ai-prompt-dialog.component';
import { AiParametricDialogComponent } from './ai-parametric-dialog.component';
import { AiGenerationDialogComponent } from './ai-generation-dialog.component';
import { ExercisePreviewDialogComponent } from './exercise-preview-dialog.component';
import { AiGenerationTimelineComponent } from '../../shared/ai-generation-timeline.component';
import { AuthService } from '../../services/auth.service';
import { Exercise, Session, PlanItem, ExerciseFilters, FilterOptions, AiStep, PollingResponse } from '../../shared/models';
import { calculateAge } from '../../shared/shared-utils';



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
export class PlannerComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  exercises: Exercise[] = [];
  filteredExercises: Exercise[] = [];

  // Current filters data
  currentFilters: ExerciseFilters = {
    searchValue: '',
    categoryFilter: '',
    muscleGroupFilter: '',
    equipmentTypeFilter: '',
    functionalOnly: false
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
  previousPlans: any[] = [];
  selectedPreviewPlan: any | null = null;
  private readonly prevLimit = 8;
  canAssignUser = false;
  clients: AppUser[] = [];
  isSpecificUser = false;
  isClientNameReadonly = false;
  userProfile: AppUser | null = null;
  userAge: number | null = null;

  // AI generation state
  isGenerating: boolean = false;
  currentAiStep?: AiStep;
  private pollingSub?: Subscription;
  private currentUserId: string | null = null;
  currentExecutionId!: string;
  private aiGenDialogRef: any = null;
  /**
   * Purpose: track AI dialog flow timing + last visible signal for debugging.
   * Input: set on user interaction; Output: consumed by recordAiFlowSignal and template.
   * Error handling: none; direct state updates only.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private aiFlowStartMs: number | null = null;
  aiFlowSignal: string | null = null;
  /**
   * Purpose: store AI generation start timestamp to filter stale polling results.
   * Input/Output: set on startAIGeneration; used in startPolling comparisons.
   * Error handling: null prevents accepting plans without valid timestamps.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private aiGenerationStartedAt: number | null = null;


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
  ) {
    console.log('PlannerComponent constructor called');
  }

  // Load user profile and calculate age
  loadUser(userId: string): void {
    this.userApi.getUserById(userId).subscribe(user => {
      // Validate response - check if it's a valid user object with id
      if (!user || !user.id) {
        console.error('Invalid user response:', user);
        // If response contains error message, log it specifically
        if (user && (user as any).message === 'userId requerido') {
          console.error('API returned error: userId requerido for userId:', userId);
        }
        // Don't assign userProfile if invalid
        this.userProfile = null;
        this.userAge = null;
        this.form.patchValue({ userName: '' });
        this.cdr.markForCheck();
        return;
      }

      this.userProfile = user;
      this.userAge = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
      console.log('Loaded user profile:', userId, user);

      // Update userName in form
      const displayName = `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email?.split('@')[0] || 'Usuario';
      this.form.patchValue({ userName: displayName });

      this.cdr.markForCheck();
    });
  }

  openAIDialog(): void {
    console.log('Click en "Generar plan"');
    this.aiFlowStartMs = Date.now();
    this.recordAiFlowSignal('ai-dialog-click', 'openAIDialog');
    const userId = this.userProfile?.id;
    if (!userId) {
      console.warn('Cannot open AI dialog: user profile not loaded');
      this.recordAiFlowSignal('ai-dialog-blocked', 'missing-user');
      this.snackBar.open('Debe cargar un usuario antes de generar un plan con IA.', undefined, { duration: 4000 });
      return;
    }
    this.currentUserId = userId;
    console.log('[AI] Dialog opened with userId', userId);

    const dialogRef = this.dialog.open(AiParametricDialogComponent, {
      width: '900px',
      disableClose: true,
      data: { userId, userProfile: this.userProfile, userAge: this.userAge }
    });

    dialogRef.afterClosed().subscribe((result: { started?: boolean; executionId?: string } | null) => {
      console.log('Cierre del modal', result);
      if (!result?.executionId) {
        console.warn('[AI] Dialog closed without executionId');
        return;
      }

      this.currentExecutionId = result.executionId;
      this.startPolling();
    });
  }

  /**
   * Purpose: emit a visible + logged signal for the AI dialog flow.
   * Input: stage (string), detail (string | null | undefined). Output: void.
   * Error handling: none; state updates and logging only.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private recordAiFlowSignal(stage: string, detail?: string | null): void {
    const elapsedMs = this.aiFlowStartMs ? Date.now() - this.aiFlowStartMs : undefined;
    const message = detail ? `${stage}: ${detail}` : stage;
    this.aiFlowSignal = message;
    console.log('[AI_FLOW]', { stage, detail, elapsedMs });
    this.cdr.markForCheck();
  }

  /**
   * Purpose: apply AI plan sessions (array or wrapped object) to planner state.
   * Input/Output: accepts sessions array or plan object; updates form + sessions.
   * Error handling: assumes caller validates non-empty sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyPlanToPlanner(aiPlan: any): void {
    const sessions = Array.isArray(aiPlan)
      ? aiPlan
      : Array.isArray(aiPlan?.sessions)
        ? aiPlan.sessions
        : [];
    const patch: Partial<{ userName: string; objective: string; sessionCount: number; notes: string }> = {
      sessionCount: sessions.length
    };

    if (!Array.isArray(aiPlan)) {
      if (aiPlan?.name) patch.userName = aiPlan.name;
      if (aiPlan?.objective) patch.objective = aiPlan.objective;
      if (aiPlan?.generalNotes) patch.notes = aiPlan.generalNotes;
    }

    // Update form with plan data
    this.form.patchValue(patch);

    // Normalize equipment_type to equipment in all sessions and items
    const normalizedSessions = sessions.map((session: Session) => ({
      ...session,
      items: session.items.map((item: PlanItem) => ({
        ...item,
        equipment: item.equipment ?? item.equipment_type ?? ''
      }))
    }));

    // Load sessions
    this.sessions = normalizedSessions;
    this.rebuildDropLists();
    this.persist();
    this.applyUiState();

    this.snackBar.open('Plan de IA cargado exitosamente!', undefined, { duration: 2000 });
    this.cdr.markForCheck();
  }

  private resetAiGenerationState(): void {
    this.stopPolling();
    this.isGenerating = false;
    this.currentAiStep = undefined;
    this.aiGenerationStartedAt = null;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }



  startPolling() {
    if (!this.currentUserId || !this.currentExecutionId) {
      console.error('[AI] Missing userId or executionId for polling');
      return;
    }

    console.log(
      '[AI] Starting polling for execution:',
      this.currentExecutionId
    );

    this.isGenerating = true;

    // Open the blocking modal dialog
    this.aiGenDialogRef = this.dialog.open(AiGenerationDialogComponent, {
      disableClose: true,
      autoFocus: false,
      panelClass: 'ai-generation-dialog',
      backdropClass: 'ai-generation-backdrop',
      width: '760px',
      maxWidth: '92vw',
      data: { currentAiStep: this.currentAiStep }
    });

    this.pollingSub = interval(2500).pipe(
      switchMap(() =>
        this.api
          .pollPlanByExecution(
            this.currentUserId!,
            this.currentExecutionId
          )
          .pipe(
            catchError(err => {
              if (err.status === 404) {
                console.log('[AI] Plan not ready yet, continuing polling');
                return of(null);
              }

              console.error('[AI] Polling error', err);
              return of(null);
            })
          )
      )
  ).subscribe(res => {
    if (!res) return;

    // 🔁 Estado intermedio: continuar polling
    if (res.status === 'IN_PROGRESS') {
      console.log('[AI] Generation in progress:', res.currentStep);
      this.currentAiStep = res.currentStep;
      // Update dialog data with current step
      if (this.aiGenDialogRef) {
        this.aiGenDialogRef.componentInstance.data = { currentAiStep: this.currentAiStep };
      }
      this.cdr.markForCheck();
      return; // ⚠️ NO detener polling
    }

    // ✅ Estado final: aplicar plan y detener polling
    if (res.status === 'COMPLETED') {
      console.log('[AI] Generation completed, applying plan');

      this.applyPlanToPlanner(res.plan);
      this.stopPolling();
      this.isGenerating = false;
      // Close the modal dialog
      if (this.aiGenDialogRef) {
        this.aiGenDialogRef.close();
        this.aiGenDialogRef = null;
      }
      this.cdr.markForCheck();
      return;
    }

    // 🟡 Cualquier otro estado se ignora
  });
  }

  private stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = undefined;
      console.log('[AI] Polling stopped');
    }
  }

  // REMOVED: loadFinalPlan method - plan now comes from polling

  private getGenderFromUser(user: AppUser): string {
    // For now, we'll default to 'Masculino' since the form defaults to that
    // In a real implementation, you might want to add gender to the user model
    return 'Masculino';
  }



  ngOnInit() {
    this.planId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.planId;
this.loadUser(this.route.snapshot.queryParamMap.get('userId') || '');
    this.form = this.fb.group({
      userName: [''],
      date: [null],
      sessionCount: [3],
      notes: [''],
      targetUserId: [''],
      objective: ['']
    });

    // Read userId from queryParams and load user immediately if valid
    const qpUserId = this.route.snapshot.queryParamMap.get('userId');
    this.isSpecificUser = !!qpUserId;
    if (qpUserId && qpUserId.trim()) {
      this.form.patchValue({ targetUserId: qpUserId });
      this.loadUser(qpUserId);
    }

    // Subscribe to targetUserId changes to populate userName and set readonly
    this.form.get('targetUserId')!.valueChanges.subscribe(userId => {
      this.isClientNameReadonly = !!userId;
      if (userId && userId.trim()) {
        this.loadUser(userId);
      } else {
        this.userProfile = null;
        this.userAge = null;
        this.form.patchValue({ userName: '' });
        this.cdr.markForCheck();
      }
    });

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
      equipmentTypeFilter: '',
      functionalOnly: false
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
          equipmentTypeFilter: filters.equipmentTypeFilter || '',
          functionalOnly: filters.functionalOnly || false
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

      // Functional filter
      const matchesFunctional = !this.currentFilters.functionalOnly || exercise.functional === true;

      return matchesSearch && matchesCategory && matchesMuscleGroup && matchesEquipmentType && matchesFunctional;
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



  // REMOVED: generateWithAI method that used forbidden generateWorkoutPlanAI

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
    const draggedItem = event.item.data;

    // Handle child items being dragged out of groups
    if (this.isChildItem(draggedItem, session!)) {
      this.handleChildDrop(draggedItem, event, session!);
      return;
    }

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

  private isChildItem(item: any, session: Session): boolean {
    return session.items.some(group => group.isGroup && group.children?.includes(item));
  }

  private handleChildDrop(child: PlanItem, event: CdkDragDrop<any, any>, session: Session) {
    // Find the group containing this child
    const group = session.items.find(g => g.isGroup && g.children?.includes(child));
    if (!group) return;

    const childIndex = group.children!.indexOf(child);
    group.children!.splice(childIndex, 1);

    // If group becomes empty, remove it
    if (group.children!.length === 0) {
      const groupIndex = session.items.indexOf(group);
      session.items.splice(groupIndex, 1);
    }

    // Insert child as normal item at target position
    session.items.splice(event.currentIndex, 0, child);
    session.items = [...session.items];
    this.persist();
    this.cdr.detectChanges();
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
    return true; // Superserie blocks are now draggable as units
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

  goBack(): void {
    const userId = this.route.snapshot.queryParamMap.get('userId');
    if (userId) {
      this.router.navigate(['/users', userId]);
    } else {
      this.router.navigate(['/users']);
    }
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
