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
