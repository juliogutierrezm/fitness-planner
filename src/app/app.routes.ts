import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './guards/auth.guard';
import { AuthFlowGuard } from './guards/auth-flow.guard';
import { OnboardingGuard } from './guards/onboarding.guard';
import { PostLoginRedirectGuard } from './guards/post-login-redirect.guard';
import { RoleGuard } from './guards/role.guard';
import { UserRole } from './services/auth.service';

export const routes: Routes = [
  // Rutas publicas de autenticacion
  {
    path: 'confirm-code',
    redirectTo: 'confirm-signup',
    pathMatch: 'full'
  },
  {
    path: 'force-new-password',
    redirectTo: 'force-change-password',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'none' }
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'none' }
  },
  {
    path: 'confirm-signup',
    loadComponent: () => import('./components/confirm-code/confirm-code.component').then(m => m.ConfirmCodeComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'confirmSignUp', fallback: '/signup' }
  },
  {
    path: 'force-change-password',
    loadComponent: () => import('./components/force-new-password/force-new-password.component').then(m => m.ForceNewPasswordComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'newPasswordRequired', fallback: '/login' }
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'none' }
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [AuthFlowGuard],
    data: { flow: 'resetPassword', fallback: '/forgot-password' }
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
        path: 'ai-plans',
        loadComponent: () => import('./pages/ai-plans-dashboard/ai-plans-dashboard.component').then(m => m.AiPlansDashboardComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'ai-plans/user/:id',
        loadComponent: () => import('./pages/ai-plans-user/ai-plans-user.component').then(m => m.AiPlansUserComponent),
        canActivate: [AuthGuard, PostLoginRedirectGuard, RoleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.TRAINER] }
      },
      {
        path: 'ai-plans/user/:id/plan/:executionId',
        loadComponent: () => import('./pages/ai-plan-detail/ai-plan-detail.component').then(m => m.AiPlanDetailComponent),
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
