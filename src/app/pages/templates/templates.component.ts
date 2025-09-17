import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
// Removed dialog-based preview; use dedicated route instead.

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
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    WorkoutPlanViewComponent
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

  // filtros
  q = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    // Get current user info
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    // Load templates created by the current trainer
    this.api.getPlansByTrainer().subscribe((data) => {
      this.templates = (data || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.applyFilters();
      this.loading = false;
      this.cdr.markForCheck();
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
      const name = (p.name || '').toLowerCase();
      const notes = (p.generalNotes || '').toLowerCase();
      const t = p.date ? new Date(p.date).getTime() : 0;
      const matchQ = !qn || name.includes(qn) || notes.includes(qn);
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

  preview(plan: any) { this.router.navigate(['/plan', this.getPlanId(plan)]); }

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
          this.templates = this.templates.filter((p: any) => (p.planId || p.id) !== templateId);
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
    this.router.navigate(['/planner']);
  }

  assignTemplate(template: any) {
    // TODO: Implement template assignment to users
    this.snackBar.open('Funcionalidad de asignación próximamente', 'Cerrar', { duration: 2000 });
  }
}
