import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-workout-plans',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './workout-plans.component.html',
  styleUrls: ['./workout-plans.component.scss']
})
export class WorkoutPlansComponent implements OnInit {
  plans: any[] = [];

  constructor(
    private api: ExerciseApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Load workout plans for the authenticated user
    this.api.getWorkoutPlansByUser().subscribe((data) => {
      this.plans = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      console.log('Planes de entrenamiento obtenidos:', this.plans);
    });
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
          this.plans = this.plans.filter(p => p.planId !== planId);
          this.snackBar.open('Plan eliminado', 'Cerrar', { duration: 2500 });
        } else {
          this.snackBar.open('No se pudo eliminar el plan', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }
}
