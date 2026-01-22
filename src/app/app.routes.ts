import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './guards/auth.guard';
import { OnboardingGuard } from './guards/onboarding.guard';
import { PostLoginRedirectGuard } from './guards/post-login-redirect.guard';
import { RoleGuard } from './guards/role.guard';
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
        path: 'onboarding',
        loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent),
        canActivate: [OnboardingGuard]
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'planner',
        loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'planner/:id',
        loadComponent: () => import('./components/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'templates',
        loadComponent: () => import('./pages/templates/templates.component').then(m => m.TemplatesComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'plan/:id',
        loadComponent: () => import('./pages/plan-view/plan-view.component').then(m => m.PlanViewPageComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'exercise-manager',
        loadComponent: () => import('./pages/exercise-manager/exercise-manager.component').then(m => m.ExerciseManagerComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'exercise-detail/:id',
        loadComponent: () => import('./pages/exercise-manager/components/exercise-detail/exercise-detail.component').then(m => m.ExerciseDetailComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'diagnostics',
        loadComponent: () => import('./pages/diagnostics/diagnostics.component').then(m => m.DiagnosticsComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'trainers',
        loadComponent: () => import('./pages/trainers/trainers.component').then(m => m.TrainersComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN], excludeIndependent: true }
      },
      {
        path: 'clients',
        loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./pages/user-detail/user-detail.component').then(m => m.UserDetailComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'clients/:id/body-metrics',
        loadComponent: () => import('./pages/client-body-metrics/client-body-metrics.component').then(m => m.ClientBodyMetricsComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'settings/appearance',
        loadComponent: () => import('./pages/settings/appearance-settings.component').then(m => m.AppearanceSettingsComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN] }
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
