import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './guards/auth.guard';
import { UserRole } from './services/auth.service';

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
  {
    path: 'unauthorized',
    loadComponent: () => import('./components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
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
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'planner/:id',
        loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'templates',
        loadComponent: () => import('./pages/templates/templates.component').then(m => m.TemplatesComponent),
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'plan/:id',
        loadComponent: () => import('./pages/plan-view/plan-view.component').then(m => m.PlanViewPageComponent),
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'exercise-manager',
        loadComponent: () => import('./pages/exercise-manager/exercise-manager.component').then(m => m.ExerciseManagerComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'exercise-detail/:id',
        loadComponent: () => import('./pages/exercise-manager/components/exercise-detail/exercise-detail.component').then(m => m.ExerciseDetailComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'diagnostics',
        loadComponent: () => import('./pages/diagnostics/diagnostics.component').then(m => m.DiagnosticsComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent),
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./pages/user-detail/user-detail.component').then(m => m.UserDetailComponent),
        canActivate: [AuthGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
