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
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
// Removed dialog-based preview; use dedicated route instead.

@Component({
  selector: 'app-workout-plans',
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
    WorkoutPlanViewComponent
  ],
  templateUrl: './workout-plans.component.html',
  styleUrls: ['./workout-plans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkoutPlansComponent implements OnInit {
  plans: any[] = [];
  viewPlans: any[] = [];

  // filtros
  origin: 'all' | 'user' | 'trainer' = 'all';
  q = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  private pinnedIds = new Set<string>();

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    // Load workout plans only for the authenticated user
    this.api.getWorkoutPlansByUser().subscribe((data) => {
      this.plans = (data || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.applyFilters();
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

    let arr = this.plans.filter(p => {
      const name = (p.name || '').toLowerCase();
      const notes = (p.generalNotes || '').toLowerCase();
      const t = p.date ? new Date(p.date).getTime() : 0;
      const matchQ = !qn || name.includes(qn) || notes.includes(qn);
      const matchFrom = from === null || t >= from!;
      const matchTo = to === null || t <= to!;
      let matchOrigin = true;
      if (this.origin === 'trainer') matchOrigin = !!p.trainerId;
      if (this.origin === 'user') matchOrigin = !p.trainerId;
      return matchQ && matchFrom && matchTo && matchOrigin;
    });

    this.viewPlans = arr.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  clearFilters() {
    this.origin = 'all';
    this.q = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
    this.cdr.markForCheck();
  }

  preview(plan: any) { this.router.navigate(['/plan', this.getPlanId(plan)]); }

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
      this.api.deleteWorkoutPlan(planId).subscribe(res => {
        if (res !== null) {
          this.plans = this.plans.filter(p => (p.planId || p.id) !== planId);
          this.applyFilters();
          this.snackBar.open('Plan eliminado', 'Cerrar', { duration: 2500 });
          this.cdr.markForCheck();
        } else {
          this.snackBar.open('No se pudo eliminar el plan', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }
}
