// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'planner', loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent) },
      { path: 'workout-plans', loadComponent: () => import('./pages/workout-plans/workout-plans.component').then(m => m.WorkoutPlansComponent) },
        { path: 'exercise-manager', loadComponent: () => import('./pages/exercise-manager/exercise-manager.component').then(m => m.ExerciseManagerComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
