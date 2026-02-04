import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { TemplateAssignmentService } from '../../services/template-assignment.service';
import { finalize } from 'rxjs/operators';
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
import { UserDisplayNamePipe } from '../../shared/user-display-name.pipe';
import { getTemplateDisplayName } from '../../shared/shared-utils';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    WorkoutPlanViewComponent,
    UserDisplayNamePipe
  ],
  templateUrl: './templates.component.html',
  styleUrls: ['./templates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesComponent implements OnInit {
  templates: any[] = [];
  viewTemplates: any[] = [];
  loading = true;
  currentUser: any = null;
  assignableUsers: AppUser[] = [];
  filteredAssignableUsers: AppUser[] = [];
  userSearch = '';
  selectedUserId: string | null = null;
  @ViewChild('userSelectDialog') userSelectDialog?: TemplateRef<any>;
  private userSelectDialogRef: any = null;
  private pendingTemplateId: string | null = null;

  // filtros
  q = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService,
    private userApi: UserApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private templateAssignment: TemplateAssignmentService
  ) {}

  get isGymAdmin(): boolean {
    return this.authService.isGymAdmin();
  }

  ngOnInit() {
    const qpUserId = this.route.snapshot.queryParamMap.get('userId');
    this.selectedUserId = qpUserId?.trim() || null;

    // Get current user info
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.loadAssignableUsers(user);
      if (user?.id) {
        this.loadTemplates();
      } else {
        this.loading = false;
        this.templates = [];
        this.applyFilters();
      }
      this.cdr.markForCheck();
    });

    if (!this.authService.getCurrentUser()?.id) {
      this.loading = false;
    }
  }

  private loadAssignableUsers(user: any): void {
    if (!user) {
      this.assignableUsers = [];
      this.filteredAssignableUsers = [];
      this.cdr.markForCheck();
      return;
    }

    const canAssign = user.role === 'admin' || user.role === 'trainer';
    if (!canAssign) {
      this.assignableUsers = [];
      this.filteredAssignableUsers = [];
      this.cdr.markForCheck();
      return;
    }

    this.userApi.getUsersForCurrentTenant().subscribe(list => {
      const clientsOnly = (list || []).filter(user => user.role === 'client');
      this.assignableUsers = clientsOnly;
      this.syncSelectedUserId();
      this.applyUserFilter();
    });
  }

  private syncSelectedUserId(): void {
    if (!this.selectedUserId || this.assignableUsers.length === 0) return;
    const exists = this.assignableUsers.some(user => user.id === this.selectedUserId);
    if (!exists) {
      this.selectedUserId = null;
    }
  }

  private openUserSelectDialog(templateId: string): void {
    const trimmedId = templateId?.trim();
    if (!trimmedId) {
      this.snackBar.open('No se pudo identificar la plantilla.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (!this.userSelectDialog) {
      this.snackBar.open('No se pudo abrir el selector de usuarios.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (this.assignableUsers.length === 0) {
      this.snackBar.open('No hay usuarios disponibles para asignar.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.pendingTemplateId = trimmedId;
    this.applyUserFilter();
    this.userSelectDialogRef = this.dialog.open(this.userSelectDialog, {
      width: '640px',
      maxWidth: '94vw'
    });

    this.userSelectDialogRef.afterClosed().subscribe(() => {
      this.pendingTemplateId = null;
      this.userSelectDialogRef = null;
    });
  }

  /**
   * Purpose: filter assignable users by the dialog search query.
   * Input: none (uses userSearch and assignableUsers). Output: updates filteredAssignableUsers.
   * Error handling: falls back to full list when query is empty or users list missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
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

  /**
   * Purpose: build a normalized search string for a user entry.
   * Input: user entity. Output: lowercase string for matching.
   * Error handling: returns empty string when user is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getUserSearchText(user: AppUser | null | undefined): string {
    if (!user) return '';
    const given = user.givenName || '';
    const family = user.familyName || '';
    const email = user.email || '';
    return `${given} ${family} ${email}`.trim().toLowerCase();
  }

  selectUserForAssignment(user: AppUser): void {
    const userId = user?.id?.trim();
    if (!userId) {
      this.snackBar.open('No se pudo identificar el usuario.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.selectedUserId = userId;
    const templateId = this.pendingTemplateId;
    this.userSelectDialogRef?.close();
    if (!templateId) {
      return;
    }

    this.templateAssignment.assignTemplateToUser({
      userId,
      snackBar: this.snackBar,
      templateId
    });
  }

  /**
   * Purpose: load template plans for the current tenant.
   * Input: none. Output: updates templates list state.
   * Error handling: logs and shows snackbar on API failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadTemplates(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.loading = false;
      this.templates = [];
      this.applyFilters();
      return;
    }

    this.loading = true;
    this.api.getPlansForCurrentTenant().pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (data) => {
        const templatesOnly = (data || []).filter((plan: any) => plan?.isTemplate === true);
        this.templates = templatesOnly.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error al cargar plantillas:', error);
        this.templates = [];
        this.applyFilters();
        this.snackBar.open('No se pudieron cargar las plantillas.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  getPlanId(p: any): string {
    if (p?.planId) { return p.planId; }
    if (p?.id) { return p.id; }
    if (p?.SK && typeof p.SK === 'string' && p.SK.startsWith('PLAN#')) {
      return p.SK.substring(5);
    }
    return '';
  }

  // No pin functionality on the general list view.

  applyFilters() {
    const qn = (this.q || '').trim().toLowerCase();
    const from = this.dateFrom ? new Date(this.dateFrom).getTime() : null;
    const to = this.dateTo ? new Date(this.dateTo).getTime() : null;

    let arr = this.templates.filter((p: any) => {
      const name = (getTemplateDisplayName(p) || '').toLowerCase();
      const notes = (p.generalNotes || '').toLowerCase();
      const objective = (p.objective || '').toLowerCase();
      const t = p.date ? new Date(p.date).getTime() : 0;
      const matchQ = !qn || name.includes(qn) || notes.includes(qn) || objective.includes(qn);
      const matchFrom = from === null || t >= from!;
      const matchTo = to === null || t <= to!;
      return matchQ && matchFrom && matchTo;
    });

    this.viewTemplates = arr.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  clearFilters() {
    this.q = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  trackByUserId = (_: number, user: AppUser) => user.id || user.email;

  /**
   * Purpose: resolve a template label with templateName priority.
   * Input: template plan object. Output: display name string.
   * Error handling: falls back to a generic label when names are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTemplateName(plan: any): string {
    const name = getTemplateDisplayName(plan);
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

  deleteTemplate(templateId: string) {
    if (!templateId) { return; }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar plantilla',
        message: '¿Eliminar esta plantilla? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        icon: 'delete_outline'
      }
    });

    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.deleteWorkoutPlan(templateId).subscribe(res => {
        if (res !== null) {
          // Crear nueva referencia del array para forzar detección de cambios
          this.templates = [...this.templates.filter((p: any) => (p.planId || p.id) !== templateId)];
          this.applyFilters();
          this.snackBar.open('Plantilla eliminada', 'Cerrar', { duration: 2500 });
          this.cdr.markForCheck();
        } else {
          this.snackBar.open('No se pudo eliminar la plantilla', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }

  createTemplate() {
    this.router.navigate(['/planner'], { queryParams: { templateMode: 'true' } });
  }

  assignTemplate(template: any) {
    const templateId = this.getPlanId(template);
    if (!this.selectedUserId) {
      this.openUserSelectDialog(templateId);
      return;
    }
    this.templateAssignment.assignTemplateToUser({
      userId: this.selectedUserId,
      snackBar: this.snackBar,
      templateId
    });
  }
}

