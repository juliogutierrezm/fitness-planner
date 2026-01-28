import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiPlanSummary, AiPlansService, AiUserPlansResponse } from '../../services/ai-plans.service';
import { AuthService } from '../../services/auth.service';
import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { PlanAssignmentService } from '../../services/plan-assignment.service';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
import { PlanProgressions } from '../../components/planner/models/planner-plan.model';
import {
  enrichPlanSessionsFromLibrary,
  normalizePlanSessionsForRender,
  parsePlanSessions
} from '../../shared/shared-utils';

interface AiPlanBody {
  objective?: string;
  generalNotes?: string;
  sessions?: any[];
  progressions?: PlanProgressions | string | null;
}

@Component({
  selector: 'app-ai-plan-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatDialogModule,
    MatSnackBarModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    WorkoutPlanViewComponent
  ],
  templateUrl: './ai-plan-detail.component.html',
  styleUrls: ['./ai-plan-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiPlanDetailComponent implements OnInit {
  loading = true;
  unauthorized = false;
  isSavingTemplate = false;
  userId = '';
  executionId = '';
  planSummary: AiPlanSummary | null = null;
  planBody: AiPlanBody | null = null;
  previewPlan: any | null = null;
  progressions: PlanProgressions | null = null;
  exerciseLibraryMap = new Map<string, any>();
  assignableUsers: AppUser[] = [];
  filteredAssignableUsers: AppUser[] = [];
  userSearch = '';
  @ViewChild('userSelectDialog') userSelectDialog?: TemplateRef<any>;
  private userSelectDialogRef: any = null;
  templateNameInput = '';
  @ViewChild('templateNameDialog') templateNameDialog?: TemplateRef<any>;
  private templateNameDialogRef: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private aiPlansService: AiPlansService,
    private authService: AuthService,
    private api: ExerciseApiService,
    private userApi: UserApiService,
    private planAssignmentService: PlanAssignmentService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    this.executionId = this.route.snapshot.paramMap.get('executionId') || '';
    if (!this.userId || !this.executionId) {
      this.loading = false;
      this.unauthorized = true;
      this.cdr.markForCheck();
      return;
    }
    this.loadExerciseLibrary();
    this.loadAssignableUsers();
    this.loadPlan();
  }

  get hasPlanBody(): boolean {
    return Boolean(this.planBody);
  }

  get hasPreviewPlan(): boolean {
    return Boolean(this.previewPlan);
  }

  private loadPlan(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !this.authService.canAccessUserData(this.userId)) {
      this.loading = false;
      this.unauthorized = true;
      this.cdr.markForCheck();
      return;
    }

    this.aiPlansService.getByUser(this.userId).subscribe(response => {
      if (!response) {
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      const targetPlan = this.findPlan(response);
      this.planSummary = targetPlan;
      const planKey = targetPlan?.planKey;
      if (!planKey) {
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      this.aiPlansService
        .getByUser(this.userId, { includePlanBodies: true })
        .subscribe(fullResponse => {
          this.handlePlanBody(fullResponse, planKey);
        });
    });
  }

  private findPlan(response: AiUserPlansResponse): AiPlanSummary | null {
    return response.plans.find(plan => plan.executionId === this.executionId) || null;
  }

  private handlePlanBody(response: AiUserPlansResponse | null, planKey: string): void {
    this.loading = false;
    if (!response) {
      this.cdr.markForCheck();
      return;
    }
    const plan = response.plans.find(item => item.planKey === planKey) || null;
    this.planBody = (plan?.plan as AiPlanBody) || null;
    this.progressions = this.normalizeProgressions(this.planBody?.progressions || null);
    this.buildPreviewPlan();
    this.cdr.markForCheck();
  }

  private loadExerciseLibrary(): void {
    this.api.getExerciseLibrary().subscribe({
      next: (libraryResponse) => {
        const rawItems = libraryResponse.items || [];
        const exercises = rawItems.map((item: any) => this.flattenDynamoItem(item));
        this.exerciseLibraryMap = new Map(exercises.map((ex: any) => [ex.id, ex]));
        this.buildPreviewPlan();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('[AI Plan Detail] Failed to load exercise library', error);
        this.exerciseLibraryMap = new Map();
        this.buildPreviewPlan();
        this.cdr.markForCheck();
      }
    });
  }

  private flattenDynamoItem(raw: any): any {
    const flattened: any = {};
    for (const [key, value] of Object.entries(raw || {})) {
      if (value && typeof value === 'object') {
        if ('S' in value) {
          flattened[key] = (value as any).S || '';
        } else if ('N' in value) {
          flattened[key] = Number((value as any).N) || 0;
        } else if ('BOOL' in value) {
          flattened[key] = (value as any).BOOL;
        } else if ('L' in value) {
          const list = (value as any).L || [];
          flattened[key] = list.map((item: any) => {
            if (item.S !== undefined) return item.S;
            if (item.N !== undefined) return Number(item.N);
            if (item.BOOL !== undefined) return item.BOOL;
            return item;
          });
        } else if ('SS' in value) {
          flattened[key] = (value as any).SS || [];
        } else {
          flattened[key] = value;
        }
      } else {
        flattened[key] = value;
      }
    }
    return flattened;
  }

  private normalizeProgressions(progressions: PlanProgressions | string | null): PlanProgressions | null {
    if (!progressions) return null;
    if (typeof progressions === 'string') {
      try {
        const parsed = JSON.parse(progressions);
        return parsed && typeof parsed === 'object' ? (parsed as PlanProgressions) : null;
      } catch {
        return null;
      }
    }
    return progressions as PlanProgressions;
  }

  private buildPreviewPlan(): void {
    if (!this.planBody) return;
    const rawSessions = Array.isArray(this.planBody)
      ? this.planBody
      : this.planBody.sessions || [];
    const sessions = parsePlanSessions(rawSessions);
    const enrichedSessions = enrichPlanSessionsFromLibrary(sessions, this.exerciseLibraryMap);
    const normalizedSessions = normalizePlanSessionsForRender(enrichedSessions);

    this.previewPlan = {
      name: this.planSummary ? `Plan IA (${this.planSummary.createdAt})` : 'Plan IA',
      date: this.planSummary?.createdAt,
      sessions: normalizedSessions,
      generalNotes: this.planBody.generalNotes,
      objective: this.planBody.objective,
      progressions: this.progressions
    };
  }

  openAssignUserDialog(): void {
    if (!this.userSelectDialog) {
      this.snackBar.open('No se pudo abrir el selector de usuarios.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (this.assignableUsers.length === 0) {
      this.snackBar.open('No hay usuarios disponibles para asignar.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.applyUserFilter();
    this.userSelectDialogRef = this.dialog.open(this.userSelectDialog, {
      width: '640px',
      maxWidth: '94vw'
    });

    this.userSelectDialogRef.afterClosed().subscribe(() => {
      this.userSelectDialogRef = null;
    });
  }

  applyUserFilter(): void {
    const q = (this.userSearch || '').trim().toLowerCase();
    if (!q) {
      this.filteredAssignableUsers = this.assignableUsers.slice();
      this.cdr.markForCheck();
      return;
    }

    this.filteredAssignableUsers = this.assignableUsers.filter(user => this.getUserSearchText(user).includes(q));
    this.cdr.markForCheck();
  }

  private getUserSearchText(user: AppUser | null | undefined): string {
    if (!user) return '';
    const given = user.givenName || '';
    const family = user.familyName || '';
    const email = user.email || '';
    return `${given} ${family} ${email}`.trim().toLowerCase();
  }

  selectUserForAssignment(user: AppUser): void {
    const userId = user?.id?.trim();
    if (!userId || !this.previewPlan) {
      this.snackBar.open('No se pudo identificar el usuario.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.userSelectDialogRef?.close();
    this.assignToUser(user);
  }

  assignToUser(user: AppUser): void {
    this.planAssignmentService.setPlanData(user, this.previewPlan);
    this.router.navigate(['/planner']);
  }

  saveAsTemplate(): void {
    this.openTemplateNameDialog();
  }

  private openTemplateNameDialog(): void {
    if (!this.templateNameDialog) {
      this.snackBar.open('No se pudo abrir el dialogo de plantilla.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.templateNameInput = '';
    this.templateNameDialogRef = this.dialog.open(this.templateNameDialog, {
      width: '480px',
      maxWidth: '94vw'
    });
    this.templateNameDialogRef.afterClosed().subscribe(() => {
      this.templateNameInput = '';
      this.templateNameDialogRef = null;
      this.cdr.markForCheck();
    });
  }

  confirmTemplateName(): void {
    const templateName = this.templateNameInput.trim();
    if (!templateName) {
      this.snackBar.open('Ingresa un nombre de plantilla.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.templateNameDialogRef?.close();
    this.persistTemplatePlan(templateName);
  }

  private persistTemplatePlan(templateName: string): void {
    if (!this.previewPlan) {
      this.snackBar.open('No hay plan para guardar.', 'Cerrar', { duration: 3000 });
      return;
    }
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.snackBar.open('No se pudo determinar el entrenador.', 'Cerrar', { duration: 3000 });
      return;
    }

    const planId = `plan-${Date.now()}`;
    const planName = templateName || (this.planSummary
      ? `Plan IA ${new Date(this.planSummary.createdAt || '').toLocaleDateString()}`
      : 'Plan IA');
    const payload: any = {
      planId,
      name: planName,
      date: new Date().toISOString(),
      sessions: normalizePlanSessionsForRender(this.previewPlan.sessions || []),
      generalNotes: this.planBody?.generalNotes,
      objective: this.planBody?.objective,
      userId: currentUser.id,
      isTemplate: true,
      templateName
    };
    if (this.progressions) {
      payload.progressions = this.progressions;
    }

    this.isSavingTemplate = true;
    this.cdr.markForCheck();

    this.api.saveWorkoutPlan(payload).subscribe({
      next: (res) => {
        this.isSavingTemplate = false;
        if (res) {
          this.snackBar.open('Plantilla guardada correctamente.', 'Cerrar', { duration: 2500 });
          this.cdr.markForCheck();
          return;
        }
        this.snackBar.open('No se pudo guardar la plantilla.', 'Cerrar', { duration: 3000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('[AI Plan Detail] Template save failed', error);
        this.isSavingTemplate = false;
        this.snackBar.open('No se pudo guardar la plantilla.', 'Cerrar', { duration: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  private loadAssignableUsers(): void {
    const currentUser = this.authService.getCurrentUser();
    const canAssign = currentUser?.role === 'admin' || currentUser?.role === 'trainer';
    if (!canAssign) {
      this.assignableUsers = [];
      this.filteredAssignableUsers = [];
      this.cdr.markForCheck();
      return;
    }

    this.userApi.getUsersForCurrentTenant().subscribe(list => {
      const clientsOnly = (list || []).filter(user => user.role === 'client');
      this.assignableUsers = clientsOnly;
      this.applyUserFilter();
      this.cdr.markForCheck();
    });
  }
}