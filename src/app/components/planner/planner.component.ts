import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { interval, Subscription, of } from 'rxjs';
import { switchMap, catchError, tap, finalize } from 'rxjs/operators';


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
import {
  calculateAge,
  buildPlanOrdinalMap,
  getPlanKey,
  getPlanItemDisplayName,
  getPlanItemEquipmentLabel,
  getTemplateDisplayName,
  hasRenderablePlanContent,
  normalizePlanSessionsForRender,
  parsePlanSessions,
  sortPlansByCreatedAt
} from '../../shared/shared-utils';

interface ProgressionWeek {
  week: number;
  title?: string;
  note: string;
}

interface PlanProgressions {
  showProgressions: boolean;
  totalWeeks: number;
  weeks: ProgressionWeek[];
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
    MatExpansionModule,
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
    equipmentTypeFilter: ''
  };

  // Filter options populated from data
  filterOptions: FilterOptions = {
    categoryOptions: [],
    muscleGroupOptions: [],
    equipmentTypeOptions: []
  };
  private readonly functionalCategoryLabel = 'Funcional';

  private readonly progressionGuide: ProgressionWeek[] = [
    { week: 1, title: 'Semana base', note: 'Realiza el plan tal como esta escrito' },
    { week: 2, title: 'Estabilidad', note: 'Manten series y repeticiones, mejora la tecnica' },
    { week: 3, title: 'Progresion de volumen', note: 'Intenta anadir 1-2 repeticiones por serie si te sientes bien' },
    { week: 4, title: 'Carga', note: 'Si completas el rango, aumenta ligeramente el peso' },
    { week: 5, title: 'Deload', note: 'Reduce intensidad, concentrate en ejecucion' }
  ];
  progressions: PlanProgressions = this.createDefaultProgressions(false);

  // Persistence key
  private readonly STORAGE_KEY = 'planner-filters';
  favorites: Exercise[] = [];
  recents: Exercise[] = [];
  menuExercise: Exercise | null = null;
  sessions: Session[] = [];
  exerciseListConnectedTo: string[] = [];
  sessionsConnectedTo: Record<string, string[]> = {};

  @ViewChild('saveTemplateDialog') saveTemplateDialog?: TemplateRef<any>;

  planId: string | null = null;
  isEditMode = false;
  isTemplateMode = false;
  templatePlanName: string | null = null;
  templateNameOriginal: string | null = null;
  isSavingTemplate = false;
  templateNameInput = '';
  isCreateTemplateMode = false;
  private saveTemplateDialogRef: any = null;
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
  originalPlanUserId: string | null = null;
  activeUserId: string | null = null;
  private activeUserIdLocked = false;
  isUserLoading = false;
  isSavingPlan = false;
  isInitialLoading = true;
  private exercisesLoaded = false;
  private userLoaded = true;
  private planLoaded = true;
  private initialLoadComplete = false;

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
    this.isUserLoading = true;
    this.userLoaded = false;
    this.updateInitialLoading();
    console.log('Loading user profile for userId:', userId);
    this.userApi.getUserById(userId).pipe(
      finalize(() => {
        this.isUserLoading = false;
        this.userLoaded = true;
        this.updateInitialLoading();
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (user) => {
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
          return;
        }

        this.userProfile = user;
        this.userAge = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
        console.log('Loaded user profile:', userId, user);

        // Update userName in form
        const displayName = `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email?.split('@')[0] || 'Usuario';
        this.form.patchValue({ userName: displayName });
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to load user profile:', {
          userId,
          error
        });
        this.userProfile = null;
        this.userAge = null;
        this.form.patchValue({ userName: '' });
        this.snackBar.open('No se pudo cargar el usuario.', 'Cerrar', { duration: 3000 });
      }
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
    if (aiPlan?.progressions) {
      this.setProgressionsFromPlan(aiPlan.progressions);
    }

    // Normalize sessions for consistent render structure
    const normalizedSessions = normalizePlanSessionsForRender(sessions);

    // Load sessions
    this.sessions = normalizedSessions;
    this.rebuildDropLists();
    this.persist();
    this.applyUiState();

    this.snackBar.open('Plan de IA cargado exitosamente!', undefined, { duration: 2000 });
    this.cdr.markForCheck();
  }

  /**
   * Purpose: reset template-specific state for non-template planner flows.
   * Input: none. Output: clears template flags and form fields.
   * Error handling: guards when the form is not yet initialized.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private resetTemplateState(): void {
    this.isTemplateMode = false;
    this.templatePlanName = null;
    this.templateNameOriginal = null;
    this.templateNameInput = '';
    if (this.form) {
      this.form.patchValue({ templateName: '' }, { emitEvent: false });
    }
    this.applyTemplateNameValidators();
  }

  /**
   * Purpose: sync template state from a loaded plan record.
   * Input: plan object. Output: updates template flags and form fields.
   * Error handling: falls back to defaults when plan is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private syncTemplateState(plan: any): void {
    if (!plan) {
      this.resetTemplateState();
      return;
    }

    this.isTemplateMode = plan.isTemplate === true;
    this.templatePlanName = plan.name || null;
    this.templateNameOriginal = this.isTemplateMode ? plan.templateName || null : null;
    const templateName = this.isTemplateMode ? plan.templateName || '' : '';
    if (this.form) {
      this.form.patchValue({ templateName }, { emitEvent: false });
    }
    this.applyTemplateNameValidators();
  }

  private applyTemplateNameValidators(): void {
    const control = this.form?.get('templateName');
    if (!control) return;
    if (this.isTemplateMode) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Purpose: open the dialog to capture a template name for saving.
   * Input: none. Output: opens the dialog and resets input state.
   * Error handling: shows snackbar when dialog template is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openSaveTemplateDialog(): void {
    if (!this.saveTemplateDialog) {
      this.snackBar.open('No se pudo abrir el dialogo de plantilla.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.templateNameInput = '';
    this.saveTemplateDialogRef = this.dialog.open(this.saveTemplateDialog, {
      width: '420px',
      maxWidth: '92vw',
      disableClose: true
    });

    this.saveTemplateDialogRef.afterClosed().subscribe(() => {
      this.templateNameInput = '';
      this.cdr.markForCheck();
    });
  }

  /**
   * Purpose: validate and trigger template save from the dialog.
   * Input: none (uses templateNameInput). Output: starts save flow.
   * Error handling: shows snackbar when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  confirmSaveTemplate(): void {
    const templateName = this.templateNameInput.trim();
    if (!templateName) {
      this.snackBar.open('Ingresa un nombre de plantilla.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.saveCurrentPlanAsTemplate(templateName);
  }

  /**
   * Purpose: persist a copy of the current plan as a trainer template.
   * Input: templateName string. Output: void.
   * Error handling: logs and surfaces snackbar feedback on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private saveCurrentPlanAsTemplate(templateName: string): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.snackBar.open('No se pudo determinar el entrenador.', 'Cerrar', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const startedAtMs = Date.now();
    const displayName = formValue.userName || this.getUserDisplayName() || 'Usuario';
    const planName = `Plan de ${displayName}`;
    const planStartDate = formValue.date ? new Date(formValue.date).toISOString() : new Date().toISOString();

    const templatePayload: any = {
      planId: `plan-${Date.now()}`,
      name: planName,
      date: planStartDate,
      sessions: normalizePlanSessionsForRender(this.sessions),
      generalNotes: formValue.notes,
      objective: formValue.objective,
      userId: currentUser.id,
      isTemplate: true,
      templateName
    };
    if (this.progressions.showProgressions) {
      templatePayload.progressions = this.progressions;
    }

    this.isSavingTemplate = true;
    this.cdr.markForCheck();

    this.api.saveWorkoutPlan(templatePayload).pipe(
      finalize(() => {
        this.isSavingTemplate = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        if (res) {
          console.info('[Planner] template saved', {
            planId: templatePayload.planId,
            trainerId: currentUser.id,
            elapsedMs: Date.now() - startedAtMs
          });
          this.saveTemplateDialogRef?.close();
          this.snackBar.open('Plantilla guardada correctamente', 'Cerrar', { duration: 2500 });
          return;
        }

        console.error('[Planner] template save returned empty response', {
          trainerId: currentUser.id,
          elapsedMs: Date.now() - startedAtMs
        });
        this.snackBar.open(this.getPlanSaveErrorMessage(null), 'Cerrar', { duration: 3500 });
      },
      error: (error) => {
        console.error('[Planner] template save failed', {
          trainerId: currentUser.id,
          elapsedMs: Date.now() - startedAtMs,
          error
        });
        this.snackBar.open(this.getPlanSaveErrorMessage(error), 'Cerrar', { duration: 3500 });
      }
    });
  }

  /**
   * Purpose: load a template by id and apply it to a new plan flow.
   * Input: templateId string. Output: updates planner state.
   * Error handling: shows snackbar and logs when template is missing or invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadTemplateForPlanner(templateId: string): void {
    const trimmedId = templateId?.trim();
    if (!trimmedId) {
      console.error('[Planner] missing templateId for load');
      this.snackBar.open('No se pudo cargar la plantilla.', 'Cerrar', { duration: 3000 });
      this.initializeNewPlanSessions();
      this.planLoaded = true;
      this.updateInitialLoading();
      this.cdr.markForCheck();
      return;
    }

    this.api.getWorkoutPlanById(trimmedId).pipe(
      finalize(() => {
        this.planLoaded = true;
        this.updateInitialLoading();
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (templatePlan) => {
        if (!templatePlan) {
          console.warn('[Planner] template not found', { templateId: trimmedId });
          this.snackBar.open('No se encontro la plantilla.', 'Cerrar', { duration: 3000 });
          this.initializeNewPlanSessions();
          return;
        }

        if (templatePlan.isTemplate !== true) {
          console.warn('[Planner] plan is not a template', { templateId: trimmedId });
          this.snackBar.open('El plan seleccionado no es una plantilla.', 'Cerrar', { duration: 3000 });
          this.initializeNewPlanSessions();
          return;
        }

        this.applyTemplateToPlanner(templatePlan);
      },
      error: (error) => {
        console.error('[Planner] failed to load template', {
          templateId: trimmedId,
          error
        });
        this.snackBar.open('No se pudo cargar la plantilla.', 'Cerrar', { duration: 3000 });
        this.initializeNewPlanSessions();
      }
    });
  }

  /**
   * Purpose: apply template sessions and notes into planner state for new plans.
   * Input: template plan object. Output: updates sessions and form values.
   * Error handling: shows snackbar when template has no sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyTemplateToPlanner(templatePlan: any): void {
    this.resetTemplateState();
    const parsedSessions = parsePlanSessions(templatePlan?.sessions);
    if (!Array.isArray(parsedSessions) || parsedSessions.length === 0) {
      this.snackBar.open('La plantilla no tiene sesiones validas.', 'Cerrar', { duration: 3000 });
      this.initializeNewPlanSessions();
      return;
    }

    this.sessions = parsedSessions;
    this.rebuildDropLists();
    this.form.patchValue(
      {
        sessionCount: parsedSessions.length,
        notes: templatePlan?.generalNotes || '',
        objective: templatePlan?.objective || ''
      },
      { emitEvent: false }
    );
    this.setProgressionsFromPlan(templatePlan?.progressions);
    this.persist();
    this.applyUiState();
    this.snackBar.open('Plantilla cargada en el planificador', 'Cerrar', { duration: 2500 });
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
    const qpTemplateId = this.route.snapshot.queryParamMap.get('templateId');
    const hasTemplateParam = !!qpTemplateId;
    const qpTemplateMode = this.route.snapshot.queryParamMap.get('templateMode');
    this.isCreateTemplateMode = !this.isEditMode && (qpTemplateMode === 'true' || qpTemplateMode === '1');
    this.isInitialLoading = true;
    this.exercisesLoaded = false;
    this.planLoaded = !this.isEditMode && !hasTemplateParam;
    this.userLoaded = true;
    this.initialLoadComplete = false;
    this.form = this.fb.group({
      userName: [''],
      templateName: [''],
      sessionCount: [3],
      notes: [''],
      targetUserId: [''],
      objective: [''],
      date: [new Date()]
    });
    this.resetTemplateState();
    if (this.isCreateTemplateMode) {
      this.isTemplateMode = true;
    }
    this.applyTemplateNameValidators();

    // Read userId from queryParams and load user immediately if valid
    const qpUserId = this.route.snapshot.queryParamMap.get('userId');
    this.isSpecificUser = !!qpUserId;
    if (qpUserId && qpUserId.trim()) {
      this.resolveActiveUserId(qpUserId, {
        source: 'query-param',
        lock: !this.isEditMode,
        loadUser: true,
        loadPlans: true
      });
    }

    // Subscribe to targetUserId changes to populate userName and set readonly
    this.form.get('targetUserId')!.valueChanges.subscribe(userId => {
      this.isClientNameReadonly = !!userId;
      const trimmedUserId = userId?.trim();
      if (this.activeUserIdLocked && this.activeUserId && trimmedUserId && trimmedUserId !== this.activeUserId) {
        this.form.patchValue({ targetUserId: this.activeUserId }, { emitEvent: false });
        this.cdr.markForCheck();
        return;
      }

      if (trimmedUserId && !this.activeUserIdLocked) {
        this.resolveActiveUserId(userId, {
          source: 'selector',
          loadUser: true,
          loadPlans: true
        });
      } else {
        if (!this.activeUserIdLocked) {
          this.activeUserId = null;
          this.previousPlans = [];
          this.userProfile = null;
          this.userAge = null;
          this.form.patchValue({ userName: '' });
        }
        this.cdr.markForCheck();
      }
    });

    this.api.getExerciseLibrary().pipe(
      finalize(() => {
        this.exercisesLoaded = true;
        this.updateInitialLoading();
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (libraryResponse) => {
        // Handle DynamoDB format if needed and flatten data
        const rawItems = libraryResponse.items;
        this.exercises = this.transformExercises(rawItems);
        // Build filter options and apply initial filtering
        this.populateFilterOptions();
        this.loadFiltersFromStorage();
        this.applyCombinedFilter();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to load exercise library:', error);
        this.exercises = [];
        this.applyCombinedFilter();
        this.snackBar.open('No se pudieron cargar los ejercicios.', 'Cerrar', { duration: 3000 });
      }
    });

    // Load favorites/recents
    try {
      this.favorites = JSON.parse(localStorage.getItem('fp_favorites') || '[]');
      this.recents = JSON.parse(localStorage.getItem('fp_recents') || '[]');
    } catch {
      this.favorites = [];
      this.recents = [];
    }

    // Load assignable users for admin/trainer; gym mode uses company, independent uses trainer.
    const current = this.authService.getCurrentUser();
    const canAssignUser = current?.role === 'admin' || current?.role === 'trainer';
    if (canAssignUser) {
      this.canAssignUser = true;
      this.userApi.getUsersForCurrentTenant().subscribe(list => { this.clients = list; this.cdr.markForCheck(); });
    } else if (!this.isEditMode && !this.activeUserId && current?.id) {
      this.resolveActiveUserId(current.id, {
        source: 'current-user',
        lock: true,
        loadUser: true,
        loadPlans: true
      });
    }

    if (this.isEditMode && this.planId) {
      this.planLoaded = false;
      this.updateInitialLoading();
      this.api.getWorkoutPlanById(this.planId).pipe(
        finalize(() => {
          this.planLoaded = true;
          this.updateInitialLoading();
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (plan) => {
          if (plan) {
            const parsedSessions = parsePlanSessions(plan.sessions);
            this.syncTemplateState(plan);
            this.originalPlanUserId = this.extractPlanUserId(plan);
            this.resolveActiveUserId(this.originalPlanUserId, {
              source: 'plan-owner',
              lock: true,
              loadUser: true,
              loadPlans: true
            });
            this.form.patchValue(
              {
                userName: this.isTemplateMode ? '' : plan.name.replace(/^(Plan de |.* Plan \d+ )/, ''),
                templateName: this.isTemplateMode ? plan.templateName || '' : '',
                sessionCount: parsedSessions.length,
                notes: plan.generalNotes,
                objective: plan.objective || '',
                date: plan.date ? new Date(plan.date) : new Date()
              },
              { emitEvent: false }
            );
            this.setProgressionsFromPlan(plan.progressions);
            this.sessions = parsedSessions;
            this.rebuildDropLists();
            this.applyUiState();
            this.cdr.markForCheck();
            return;
          }

          console.warn('[Planner] Plan not found for edit', { planId: this.planId });
          this.snackBar.open('No se encontró el plan para editar.', 'Cerrar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Failed to load plan for edit:', {
            planId: this.planId,
            error
          });
          this.snackBar.open('No se pudo cargar el plan.', 'Cerrar', { duration: 3000 });
        }
      });
    } else if (hasTemplateParam && qpTemplateId) {
      this.resetTemplateState();
      this.api.clearUserSessions();
      this.planLoaded = false;
      this.updateInitialLoading();
      this.loadTemplateForPlanner(qpTemplateId);
    } else {
      // Clear any previous sessions from localStorage for clean start
      this.api.clearUserSessions();

      // Always start with empty sessions for new plans
      this.initializeNewPlanSessions();
    }

    // Subscribe to sessionCount changes in both create and edit modes
    this.form.get('sessionCount')!.valueChanges.subscribe(count => {
      this.updateSessions(count);
      this.persist();
      this.persistUiState();
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

  onProgressionsToggle(show: boolean): void {
    this.progressions.showProgressions = show;
    if (show) {
      this.syncProgressionWeeks(this.progressions.totalWeeks);
    }
  }

  onTotalWeeksChange(value: number): void {
    const parsed = Number(value);
    const totalWeeks = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
    this.syncProgressionWeeks(totalWeeks);
  }

  getProgressionNotePlaceholder(week: number): string {
    const guide = this.progressionGuide.find(item => item.week === week);
    return guide?.note || 'Describe la guia para esta semana';
  }

  getProgressionTitlePlaceholder(week: number): string {
    const guide = this.progressionGuide.find(item => item.week === week);
    return guide?.title || 'Titulo opcional';
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

    categories.add(this.functionalCategoryLabel);

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
        return exercise.name_es || '';
      case 'equipment_type':
        return exercise.equipment_type || '';
      case 'muscle_group':
        return exercise.muscle_group || exercise.muscle;
      case 'exercise_type':
        return exercise.exercise_type || exercise.category;
      default:
        return (exercise as any)[field];
    }
  }

  private isFunctionalExercise(exercise: Exercise): boolean {
    const functionalValue = (exercise as any).functional;
    if (functionalValue === true) return true;
    if (typeof functionalValue === 'string') return functionalValue.trim().length > 0;
    return false;
  }

  private applyCombinedFilter(): void {
    // Combine all filters and apply to data source
    this.filteredExercises = this.exercises.filter(exercise => {
      // Text search on name_es only
      const matchesSearch = !this.currentFilters.searchValue.trim() ||
        (this.getFieldValue(exercise, 'name_es') || '').toLowerCase()
          .includes(this.currentFilters.searchValue.toLowerCase());

      // Category filter
      const selectedCategory = this.currentFilters.categoryFilter;
      const matchesCategory = !selectedCategory ||
        (selectedCategory === this.functionalCategoryLabel
          ? this.isFunctionalExercise(exercise)
          : this.getFieldValue(exercise, 'category') === selectedCategory);

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

  private createDefaultProgressions(showProgressions: boolean): PlanProgressions {
    return {
      showProgressions,
      totalWeeks: this.progressionGuide.length,
      weeks: this.progressionGuide.map(item => ({ ...item }))
    };
  }

  private setProgressionsFromPlan(progressions?: PlanProgressions | null): void {
    if (!progressions) {
      this.progressions = this.createDefaultProgressions(false);
      return;
    }

    const weeks = Array.isArray(progressions.weeks)
      ? progressions.weeks.map(week => ({ ...week }))
      : [];
    const totalWeeks = Number.isFinite(progressions.totalWeeks)
      ? progressions.totalWeeks
      : weeks.length || this.progressionGuide.length;
    const showProgressions = progressions.showProgressions === true ||
      (progressions.showProgressions !== false && weeks.length > 0);

    this.progressions = {
      showProgressions,
      totalWeeks,
      weeks
    };
    this.syncProgressionWeeks(this.progressions.totalWeeks);
  }

  private syncProgressionWeeks(totalWeeks: number): void {
    const sanitizedTotal = Number.isFinite(totalWeeks) ? Math.max(1, Math.floor(totalWeeks)) : 1;
    const existingWeeks = new Map(this.progressions.weeks.map(week => [week.week, week]));
    const nextWeeks: ProgressionWeek[] = [];

    for (let week = 1; week <= sanitizedTotal; week += 1) {
      const existing = existingWeeks.get(week);
      if (existing) {
        nextWeeks.push(existing);
      } else {
        nextWeeks.push(this.createProgressionWeek(week));
      }
    }

    this.progressions.totalWeeks = sanitizedTotal;
    this.progressions.weeks = nextWeeks;
  }

  private createProgressionWeek(week: number): ProgressionWeek {
    const guide = this.progressionGuide.find(item => item.week === week);
    return {
      week,
      title: guide?.title,
      note: guide?.note || ''
    };
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

  /**
   * Load previous plans for the specified user or current user
   * Filters out invalid plans that don't meet the required structure
   */
  private loadPreviousPlans(userId: string): void {
    const targetUserId = userId?.trim();
    if (!targetUserId) {
      console.error('No userId available for loading plans');
      this.previousPlans = [];
      this.cdr.markForCheck();
      return;
    }

    this.userApi.getWorkoutPlansByUserId(targetUserId).subscribe(list => {
      const sorted = sortPlansByCreatedAt(list || []);
      // Parse sessions and filter out invalid plans
      const validPlans = sorted
        .map(plan => ({
          ...plan,
          sessions: parsePlanSessions(plan.sessions)
        }))
        .filter(plan => this.isValidPlan(plan));

      const planOrdinals = buildPlanOrdinalMap(validPlans);
      const decoratedPlans = validPlans.map(plan => ({
        ...plan,
        planOrdinal: planOrdinals.get(getPlanKey(plan)) || 0
      }));

      this.previousPlans = decoratedPlans.slice(0, this.prevLimit);
      this.cdr.markForCheck();
    });
  }

  /**
   * Validates if a plan has the required structure to be renderizable
   * - Must have sessions array
   * - Each session must have items
   * - Items must be valid (individual exercises or superseries)
   */
  private isValidPlan(plan: any): boolean {
    if (!plan) return false;
    return hasRenderablePlanContent(plan.sessions);
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

  /**
   * Purpose: open the exercise preview dialog for either library exercises or plan items.
   * Input: Exercise or PlanItem. Output: opens dialog with preview data.
   * Error handling: relies on dialog component to handle missing preview media.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openExercisePreview(exercise: Exercise | PlanItem) {
    this.dialog.open(ExercisePreviewDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      data: { exercise }
    });
  }

  /**
   * Purpose: initialize empty sessions for a new plan flow.
   * Input: none (uses form sessionCount). Output: updates sessions and UI state.
   * Error handling: defaults to 1 session when count is invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private initializeNewPlanSessions(): void {
    const rawCount = Number(this.form?.value?.sessionCount);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
    this.updateSessions(count);
    this.applyUiState();
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
          id: ex.id,
          name: ex.name_es || ex.name || 'Ejercicio sin nombre',
          name_es: ex.name_es,
          equipment_type: ex.equipment_type || '',
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
      id: ex.id,
      name: ex.name_es || ex.name || 'Ejercicio sin nombre',
      name_es: ex.name_es,
      equipment_type: ex.equipment_type || '',
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

  /**
   * Purpose: provide the Spanish display name for a plan item in the planner view.
   * Input: PlanItem. Output: display name string.
   * Error handling: returns a placeholder when name_es is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getDisplayName(item: PlanItem): string {
    return getPlanItemDisplayName(item);
  }

  /**
   * Purpose: provide the equipment label for a plan item in the planner view.
   * Input: PlanItem. Output: equipment label string.
   * Error handling: returns a placeholder when equipment_type is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getEquipmentLabel(item: PlanItem): string {
    return getPlanItemEquipmentLabel(item);
  }

  // TrackBy helpers
  trackByExercise = (_: number, e: Exercise) => e.id;
  trackBySession = (_: number, s: Session) => s.id;
  trackByItem = (_: number, i: PlanItem) => i.id;
  trackByChild = (_: number, i: PlanItem) => i.id;
  trackByPlan = (_: number, p: any) => getPlanKey(p) || p.name;
  trackByProgressionWeek = (_: number, w: ProgressionWeek) => w.week;

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

  /**
   * Purpose: derive the planner header label for template or user contexts.
   * Input: none. Output: display label string.
   * Error handling: falls back to generic labels when data is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlannerHeaderLabel(): string {
    if (this.isTemplateMode) {
      const templateLabel = getTemplateDisplayName({
        templateName: this.form?.value?.templateName,
        name: this.templatePlanName || ''
      });
      return templateLabel || 'Plantilla';
    }
    return this.getUserDisplayName();
  }

  goBack(): void {
    if (this.isTemplateMode) {
      this.router.navigate(['/templates']);
      return;
    }
    const userId = this.route.snapshot.queryParamMap.get('userId') || this.activeUserId || this.originalPlanUserId;
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

  /**
   * Purpose: extract a userId from plan fields for update integrity checks.
   * Input: plan object. Output: userId string or null.
   * Error handling: returns null when userId cannot be determined.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private extractPlanUserId(plan: any): string | null {
    if (!plan) return null;
    if (plan.userId) return plan.userId;
    if (plan.user_id) return plan.user_id;
    if (plan.PK && typeof plan.PK === 'string' && plan.PK.startsWith('USER#')) {
      return plan.PK.substring(5);
    }
    return null;
  }

  private resolveActiveUserId(
    userId: string | null | undefined,
    options: { source: string; lock?: boolean; loadUser?: boolean; loadPlans?: boolean }
  ): void {
    const trimmed = userId?.trim();
    if (!trimmed) return;

    if (this.activeUserIdLocked && this.activeUserId && this.activeUserId !== trimmed) {
      console.warn('[Planner] activeUserId change blocked', {
        from: this.activeUserId,
        to: trimmed,
        source: options.source
      });
      this.form.patchValue({ targetUserId: this.activeUserId }, { emitEvent: false });
      return;
    }

    this.activeUserId = trimmed;
    if (options.lock) this.activeUserIdLocked = true;
    console.log('[Planner] activeUserId resolved:', trimmed, 'source:', options.source);
    this.form.patchValue({ targetUserId: trimmed }, { emitEvent: false });

    if (options.loadUser) this.loadUser(trimmed);
    if (options.loadPlans) this.loadPreviousPlans(trimmed);
    this.cdr.markForCheck();
  }

  /**
   * Purpose: save or update the workout plan with async UI feedback.
   * Input: none (uses reactive form + planner state). Output: void.
   * Error handling: shows snackBar message and logs structured error context.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  async submitPlan() {
    const formValue = this.form.value;
    const requestedUserId = this.originalPlanUserId || this.activeUserId;
    const startedAtMs = Date.now();

    const displayName = formValue.userName || this.getUserDisplayName() || 'Usuario';
    const planName = `Plan de ${displayName}`;
    const templateName = (formValue.templateName || '').trim();
    if (this.isTemplateMode && !templateName) {
      this.form.get('templateName')?.markAsTouched();
      this.snackBar.open('El nombre de la plantilla es obligatorio.', 'Cerrar', { duration: 3000 });
      return;
    }
    const resolvedTemplateName = this.isTemplateMode
      ? (templateName || this.templateNameOriginal || '')
      : templateName;
    const resolvedPlanName = this.isTemplateMode
      ? (this.templatePlanName || resolvedTemplateName || planName)
      : planName;
    const planStartDate = formValue.date ? new Date(formValue.date).toISOString() : new Date().toISOString();
    const planUserId = requestedUserId;

    const planData: any = {
      planId: this.isEditMode ? this.planId! : `plan-${Date.now()}`,
      name: resolvedPlanName,
      date: planStartDate,
      sessions: this.sessions,
      generalNotes: formValue.notes,
      objective: formValue.objective,
      userId: planUserId
    };
    if (this.progressions.showProgressions) {
      planData.progressions = this.progressions;
    }
    if (this.isTemplateMode) {
      planData.isTemplate = true;
      if (resolvedTemplateName) {
        planData.templateName = resolvedTemplateName;
      }
    }

    const action = this.isEditMode
      ? this.api.updateWorkoutPlan(planData)
      : this.api.saveWorkoutPlan(planData as any);

    this.isSavingPlan = true;
    this.cdr.markForCheck();

    action.pipe(
      finalize(() => {
        this.isSavingPlan = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        if (res) {
          console.info('[Planner] plan saved', {
            isEditMode: this.isEditMode,
            planId: this.planId,
            elapsedMs: Date.now() - startedAtMs
          });
          this.snackBar.open(`Plan ${this.isEditMode ? 'actualizado' : 'guardado'} correctamente`, 'Cerrar', { duration: 2500 });
          if (!this.isEditMode) {
            if (this.isTemplateMode) {
              this.router.navigate(['/templates']);
            } else if (planUserId) {
              this.router.navigate(['/users', planUserId]);
            } else {
              console.warn('[Planner] missing plan userId for redirect', {
                planId: this.planId,
                elapsedMs: Date.now() - startedAtMs
              });
              this.router.navigate(['/workout-plans']);
            }
          }
          return;
        }

        console.error('[Planner] plan save returned empty response', {
          isEditMode: this.isEditMode,
          planId: this.planId,
          elapsedMs: Date.now() - startedAtMs
        });
        this.snackBar.open(this.getPlanSaveErrorMessage(null), 'Cerrar', { duration: 3500 });
      },
      error: (error) => {
        console.error('[Planner] plan save failed', {
          isEditMode: this.isEditMode,
          planId: this.planId,
          elapsedMs: Date.now() - startedAtMs,
          error
        });
        this.snackBar.open(this.getPlanSaveErrorMessage(error), 'Cerrar', { duration: 3500 });
      }
    });
  }

  /**
   * Purpose: map API save/update errors to friendly Spanish messages.
   * Input: error object or null. Output: user-facing string.
   * Error handling: falls back to a generic message when details are unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getPlanSaveErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'Datos del plan incompletos o inválidos.';
    if (status === 403) return 'No tienes permisos para guardar este plan.';
    if (status === 404) return 'No se encontró el plan para actualizar.';
    if (status === 413) return 'El plan es demasiado grande para guardarse.';
    if (status >= 500) return 'El servidor no respondió. Intenta nuevamente.';
    return 'Hubo un error al guardar el plan.';
  }

  /**
   * Purpose: keep the planner loading overlay in sync with data readiness.
   * Input: none. Output: sets isInitialLoading based on load flags.
   * Error handling: none; uses boolean flags to guard UI state only.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private updateInitialLoading(): void {
    if (this.initialLoadComplete) {
      return;
    }

    const isReady = this.exercisesLoaded && this.userLoaded && this.planLoaded;
    this.isInitialLoading = !isReady;
    if (isReady) {
      this.initialLoadComplete = true;
    }
  }
}
