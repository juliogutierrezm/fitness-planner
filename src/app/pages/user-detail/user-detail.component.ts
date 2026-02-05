import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserApiService, AppUser } from '../../user-api.service';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { detectUserLocale } from '../../shared/locale.utils';
import { TemplateAssignmentService } from '../../services/template-assignment.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
import { UserDisplayNamePipe } from '../../shared/user-display-name.pipe';
import { finalize } from 'rxjs/operators';
import { 
  buildPlanOrdinalMap, 
  getPlanKey, 
  getTemplateDisplayName, 
  sortPlansByCreatedAt,
  enrichPlanSessionsFromLibrary,
  parsePlanSessions
} from '../../shared/shared-utils';
import { Exercise } from '../../shared/models';
import { PlanProgressions } from '../../components/planner/models/planner-plan.model';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  MatSnackBarModule,
  WorkoutPlanViewComponent,
  UserDisplayNamePipe
],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailComponent implements OnInit {
  userId: string | null = null;
  user: AppUser | null = null;
  plans: any[] = [];
  viewPlans: any[] = [];
  loadingPlans = false;
  templates: any[] = [];
  templateDialogLoading = false;
  @ViewChild('templateSelectDialog') templateSelectDialog?: TemplateRef<any>;
  private templateDialogRef: any = null;
  planOrdinalMap = new Map<string, number>();
  exerciseLibraryMap = new Map<string, Exercise>();
  generatingPdfForPlanId: string | null = null;

  // filtros
  q = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private userApi: UserApiService,
    private planApi: ExerciseApiService,
    private authService: AuthService,
    private pdfGenerator: PdfGeneratorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private templateAssignment: TemplateAssignmentService,
  ) {}

  get isGymAdmin(): boolean {
    return this.authService.isGymAdmin();
  }

  ngOnInit() {
    this.user = history.state.user;
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId) return;

    this.loadExerciseLibrary();
    this.loadingPlans = true;
    this.userApi.getWorkoutPlansByUserId(this.userId).subscribe(
      list => {
        this.plans = sortPlansByCreatedAt(list || []);
        this.planOrdinalMap = buildPlanOrdinalMap(this.plans);
        this.applyFilters();
        this.loadingPlans = false;
        this.cdr.markForCheck();
      },
      _ => {
        this.loadingPlans = false;
        this.cdr.markForCheck();
      }
    );
  }

  getPlanId(p: any): string {
    return getPlanKey(p);
  }

  applyFilters() {
    const qn = (this.q || '').trim().toLowerCase();
    const from = this.dateFrom ? new Date(this.dateFrom).getTime() : null;
    const to = this.dateTo ? new Date(this.dateTo).getTime() : null;

    let arr = this.plans.filter(p => {
      const objective = (p.objective || '').toLowerCase();
      const t = p.date ? new Date(p.date).getTime() : 0;
      const matchQ = !qn || objective.includes(qn);
      const matchFrom = from === null || t >= from!;
      const matchTo = to === null || t <= to!;
      return matchQ && matchFrom && matchTo;
    });

    this.viewPlans = sortPlansByCreatedAt(arr);
  }

  clearFilters() {
    this.q = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  /**
   * Purpose: open the template picker dialog for this user.
   * Input: none. Output: opens dialog and loads templates.
   * Error handling: shows snackbar when prerequisites are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openTemplateDialog(): void {
    if (!this.userId) {
      this.snackBar.open('No se pudo identificar el usuario.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (!this.templateSelectDialog) {
      this.snackBar.open('No se pudo abrir el selector de plantillas.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.templateDialogRef = this.dialog.open(this.templateSelectDialog, {
      width: '600px',
      maxWidth: '92vw'
    });
    this.loadTemplatesForDialog();
  }

  /**
   * Purpose: load tenant templates for selection in the dialog.
   * Input: none. Output: updates templates list state.
   * Error handling: logs and shows snackbar on API failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadTemplatesForDialog(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.templateDialogLoading = false;
      this.templates = [];
      this.snackBar.open('No se pudo identificar el usuario.', 'Cerrar', { duration: 3000 });
      this.cdr.markForCheck();
      return;
    }

    this.templateDialogLoading = true;
    this.cdr.markForCheck();

    this.planApi.getPlansForCurrentTenant().pipe(
      finalize(() => {
        this.templateDialogLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (list) => {
        const templatesOnly = (list || []).filter((plan: any) => plan?.isTemplate === true);
        this.templates = templatesOnly.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      error: (error: any) => {
        console.error('Error al cargar plantillas:', error);
        this.templates = [];
        this.snackBar.open('No se pudieron cargar las plantillas.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Purpose: navigate to planner with the selected template preloaded.
   * Input: template plan object. Output: navigation side effect.
   * Error handling: shows snackbar when ids are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  selectTemplate(template: any): void {
    const templateId = this.getPlanId(template);
    this.templateAssignment.assignTemplateToUser({
      userId: this.userId,
      snackBar: this.snackBar,
      templateId,
      onBeforeNavigate: () => this.templateDialogRef?.close()
    });
  }

  /**
   * Purpose: resolve a template display name with templateName priority.
   * Input: template plan object. Output: display name string.
   * Error handling: falls back to a generic label when names are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTemplateName(template: any): string {
    const name = getTemplateDisplayName(template);
    return name || 'Plantilla sin nombre';
  }

  getSessionCount(plan: any): number {
    if (!plan) return 0;

    // If sessions is a string, try to parse it as JSON
    if (typeof plan.sessions === 'string') {
      try {
        const parsed = JSON.parse(plan.sessions);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        return 0;
      }
    }

    // If sessions is already an array, return its length
    if (Array.isArray(plan.sessions)) {
      return plan.sessions.length;
    }

    return 0;
  }

  getSessionSummary(items: any[] | null | undefined): string {
    if (!items || !Array.isArray(items)) return '';
    const names: string[] = [];
    const limit = Math.min(items.length, 3);
    for (let i = 0; i < limit; i++) {
      const it = items[i];
      if (it?.name) names.push(it.name);
    }
    return names.join(', ');
  }

  /**
   * Purpose: resolve the visual plan ordinal based on createdAt ordering.
   * Input: plan object. Output: ordinal number or 0.
   * Error handling: returns 0 when map or key is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlanOrdinal(plan: any): number {
    const key = getPlanKey(plan);
    if (!key) return 0;
    return this.planOrdinalMap.get(key) || 0;
  }

  private getPlanCreatedAtTime(plan: any): number {
    const raw = plan?.createdAt || plan?.created_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(ts) ? 0 : ts;
  }

  deletePlan(planId: string) {
    if (!planId) { return; }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar plan',
        message: '¿Eliminar este plan de entrenamiento? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        icon: 'delete_outline'
      }
    });

    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.loadingPlans = true;
      this.planApi.deleteWorkoutPlan(planId).subscribe(res => {
        this.loadingPlans = false;
        if (res !== null) {
          // Actualización inmediata para reflejar la eliminación en la vista
          this.plans = [...this.plans.filter(p => (p.planId || p.id) !== planId)];
          this.planOrdinalMap = buildPlanOrdinalMap(this.plans);
          this.applyFilters();
          this.snackBar.open('Plan eliminado correctamente', 'Cerrar', { duration: 2500 });
          this.cdr.markForCheck();

          // Recargar la lista completa desde el servidor para asegurar sincronización
          if (this.userId) {
            this.userApi.getWorkoutPlansByUserId(this.userId).subscribe(
              updatedPlans => {
                this.plans = sortPlansByCreatedAt(updatedPlans || []);
                this.planOrdinalMap = buildPlanOrdinalMap(this.plans);
                this.applyFilters();
                this.cdr.markForCheck();
              },
              error => {
                console.error('Error al recargar planes después de eliminación:', error);
                this.snackBar.open('Plan eliminado (con error de sincronización)', 'Cerrar', { duration: 3000 });
                this.cdr.markForCheck();
              }
            );
          }
        } else {
          this.snackBar.open('No se pudo eliminar el plan', 'Cerrar', { duration: 3000 });
          this.cdr.markForCheck();
        }
      });
    });
  }

  /**
   * Purpose: Load exercise library for enriching plans with youtube_url.
   * Input: none. Output: updates exerciseLibraryMap.
   * Error handling: logs warning and continues with empty map on error.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadExerciseLibrary(): void {
    this.planApi.getExerciseLibrary().subscribe({
      next: (libraryResponse) => {
        const rawItems = libraryResponse?.items || [];
        const exercises = rawItems.map((item: any) => this.flattenDynamoItem(item));
        this.exerciseLibraryMap = new Map(exercises.map((ex: any) => [ex.id, ex]));
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.warn('[UserDetail] Failed to load exercise library', error);
        this.exerciseLibraryMap = new Map();
      }
    });
  }

  /**
   * Purpose: Flatten DynamoDB item format to plain object.
   */
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

  /**
   * Purpose: Generate and download PDF for a specific plan.
   * Input: plan object. Output: triggers PDF download.
   * Error handling: shows snackbar on error and resets loading state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  async downloadPlanPdf(plan: any): Promise<void> {
    const planId = this.getPlanId(plan);
    if (!plan || this.generatingPdfForPlanId) {
      return;
    }

    this.generatingPdfForPlanId = planId;
    this.cdr.markForCheck();

    try {
      // Parse and enrich sessions with youtube_url from exercise library
      const rawSessions = parsePlanSessions(plan.sessions);
      const enrichedSessions = enrichPlanSessionsFromLibrary(rawSessions, this.exerciseLibraryMap);

      // Parse progressions if available
      let progressions: PlanProgressions | null = null;
      if (plan.progressions) {
        if (typeof plan.progressions === 'string') {
          try {
            progressions = JSON.parse(plan.progressions);
          } catch {
            progressions = null;
          }
        } else {
          progressions = plan.progressions;
        }
      }

      // Build plan data for PDF
      // Use ordinal only (never templateName, plan.name may contain client name)
      const planOrdinal = this.getPlanOrdinal(plan);
      const planName = `Plan ${planOrdinal}`;
      const clientName = this.user 
        ? `${this.user.givenName || ''} ${this.user.familyName || ''}`.trim() 
        : '';
      
      // Get trainer name from current authenticated user
      const currentUser = this.authService.getCurrentUser();
      const trainerName = currentUser 
        ? `${currentUser.givenName || ''} ${currentUser.familyName || ''}`.trim() 
        : '';

      // Build filename: Plan_X_ClientName_Date
      const planDate = plan.date ? new Date(plan.date) : new Date();
      const dateStr = planDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const safeClientName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const pdfFilename = `Plan_${planOrdinal}_${safeClientName}_${dateStr}`;

      const pdfPlanData = this.pdfGenerator.buildPdfPlanData(
        planName,
        plan.date || new Date().toISOString(),
        enrichedSessions,
        {
          objective: plan.objective,
          generalNotes: plan.generalNotes,
          progressions
        }
      );

      await this.pdfGenerator.generatePlanPdf({
        plan: pdfPlanData,
        clientName,
        trainerName,
        locale: detectUserLocale(),
        filename: pdfFilename
      });

      this.snackBar.open('PDF descargado correctamente.', 'Cerrar', { duration: 2500 });
    } catch (error) {
      console.error('[UserDetail] PDF generation failed', error);
      this.snackBar.open('Error al generar el PDF. Inténtalo de nuevo.', 'Cerrar', { duration: 3000 });
    } finally {
      this.generatingPdfForPlanId = null;
      this.cdr.markForCheck();
    }
  }
}
