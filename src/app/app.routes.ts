import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  // OAuth callback route (outside of layout)
  {
    path: 'callback',
    loadComponent: () => import('./components/callback/callback.component').then(m => m.CallbackComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  
  // Main application routes
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'planner',
        loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'planner/:id',
        loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'workout-plans',
        loadComponent: () => import('./pages/workout-plans/workout-plans.component').then(m => m.WorkoutPlansComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'plans',
        redirectTo: 'workout-plans',
        pathMatch: 'full'
      },
      {
        path: 'exercise-manager',
        loadComponent: () => import('./pages/exercise-manager/exercise-manager.component').then(m => m.ExerciseManagerComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'diagnostics',
        loadComponent: () => import('./pages/diagnostics/diagnostics.component').then(m => m.DiagnosticsComponent),
        canActivate: [AuthGuard]
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
