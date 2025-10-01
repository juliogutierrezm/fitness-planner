import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { WorkoutPlanViewComponent } from '../../components/workout-plan-view/workout-plan-view.component';
import { UserDisplayNamePipe } from '../../shared/user-display-name.pipe';

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

  // filtros
  q = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private userApi: UserApiService,
    private planApi: ExerciseApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.user = history.state.user;
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId) return;

    this.loadingPlans = true;
    this.userApi.getWorkoutPlansByUserId(this.userId).subscribe(
      list => {
        this.plans = (list || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    if (p?.planId) return p.planId;
    if (p?.id) return p.id;
    if (p?.SK && typeof p.SK === 'string' && p.SK.startsWith('PLAN#')) {
      return p.SK.substring(5);
    }
    return '';
  }

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
      return matchQ && matchFrom && matchTo;
    });

    this.viewPlans = arr.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
          // Recargar la lista completa desde el servidor para asegurar sincronización
          if (this.userId) {
            this.userApi.getWorkoutPlansByUserId(this.userId).subscribe(
              updatedPlans => {
                this.plans = (updatedPlans || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                this.applyFilters();
                this.snackBar.open('Plan eliminado correctamente', 'Cerrar', { duration: 2500 });
                this.cdr.markForCheck();
              },
              error => {
                console.error('Error al recargar planes después de eliminación:', error);
                // Eliminación optimista si falla la recarga
                this.plans = [...this.plans.filter(p => (p.planId || p.id) !== planId)];
                this.applyFilters();
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


}
