import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthFlowGuard } from './auth-flow.guard';
import { AuthService, AuthStatus } from '../services/auth.service';

describe('AuthFlowGuard', () => {
  let guard: AuthFlowGuard;
  let authStatusSubject: BehaviorSubject<AuthStatus>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authStatusSubject = new BehaviorSubject<AuthStatus>('unknown');
    authService = jasmine.createSpyObj(
      'AuthService',
      [
        'getAuthFlowSnapshot',
        'isAuthenticatedSync',
        'resolveEntryTarget',
        'clearAuthFlowState',
        'getAuthFlowRoute'
      ],
      {
        authStatus$: authStatusSubject.asObservable()
      }
    );
    authService.getAuthFlowSnapshot.and.returnValue(null);
    authService.getAuthFlowRoute.and.returnValue('/login');
    authService.isAuthenticatedSync.and.returnValue(false);
    authService.resolveEntryTarget.and.returnValue('/dashboard');

    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthFlowGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(AuthFlowGuard);
  });

  it('redirects authenticated non-initialized users from /login to /onboarding', async () => {
    authService.isAuthenticatedSync.and.returnValue(true);
    authService.resolveEntryTarget.and.returnValue('/onboarding');

    const resultPromise = firstValueFrom(
      guard.canActivate({ data: { flow: 'none' }, routeConfig: { path: 'login' } } as any)
    );

    authStatusSubject.next('authenticated');
    const result = await resultPromise;

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('allows /login when unauthenticated and no pending auth flow exists', async () => {
    authService.isAuthenticatedSync.and.returnValue(false);
    authService.getAuthFlowSnapshot.and.returnValue(null);

    const resultPromise = firstValueFrom(
      guard.canActivate({ data: { flow: 'none' }, routeConfig: { path: 'login' } } as any)
    );

    authStatusSubject.next('unauthenticated');
    const result = await resultPromise;

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
