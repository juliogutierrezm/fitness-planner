import { Routes } from '@angular/router';
import { ClientLayoutComponent } from './layout/client-layout.component';

/**
 * Purpose: define client-only routes scoped to the client layout shell.
 * Input: none. Output: Routes array for lazy loading.
 * Error handling: guarded at the app route entry for role enforcement.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    component: ClientLayoutComponent,
    children: [
      {
        path: 'plans/:planId/sessions/:sessionIndex/exercises/:exerciseIndex/video',
        loadComponent: () => import('./pages/exercise-video/client-exercise-video.component').then(m => m.ClientExerciseVideoComponent)
      },
      {
        path: 'plans/:planId/sessions/:sessionIndex/exercises/:exerciseIndex',
        loadComponent: () => import('./pages/exercise-detail/client-exercise-detail.component').then(m => m.ClientExerciseDetailComponent)
      },
      {
        path: 'plans/:planId/sessions/:sessionIndex',
        loadComponent: () => import('./pages/session-exercises/client-session-exercises.component').then(m => m.ClientSessionExercisesComponent)
      },
      {
        path: 'plans/:planId',
        loadComponent: () => import('./pages/plan-detail/client-plan-detail.component').then(m => m.ClientPlanDetailComponent)
      },
      {
        path: 'plans',
        loadComponent: () => import('./pages/plans/client-plans.component').then(m => m.ClientPlansComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/client-profile.component').then(m => m.ClientProfileComponent)
      },
      { path: '', redirectTo: 'plans', pathMatch: 'full' }
    ]
  }
];
