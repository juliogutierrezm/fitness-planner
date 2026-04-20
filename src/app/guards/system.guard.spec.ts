import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthService, AuthStatus, UserProfile, UserRole } from '../services/auth.service';
import { SystemGuard } from './system.guard';

describe('SystemGuard', () => {
  let guard: SystemGuard;
  let authStatusSubject: BehaviorSubject<AuthStatus>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const mockSystemUser: UserProfile = {
    id: 'user-1',
    email: 'system@example.com',
    role: UserRole.ADMIN,
    groups: ['Admin', 'System'],
    isActive: true
  };

  const mockNonSystemUser: UserProfile = {
    id: 'user-2',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    groups: ['Admin'],
    isActive: true
  };

  beforeEach(() => {
    authStatusSubject = new BehaviorSubject<AuthStatus>('unknown');
    authService = jasmine.createSpyObj(
      'AuthService',
      ['getCurrentUser', 'isSystem'],
      {
        authStatus$: authStatusSubject.asObservable(),
        currentUser$: of(mockNonSystemUser)
      }
    );
    authService.getCurrentUser.and.returnValue(mockNonSystemUser);
    authService.isSystem.and.returnValue(false);

    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        SystemGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(SystemGuard);
  });

  it('resolves without deadlock when currentUser emitted before authStatus becomes authenticated', async () => {
    authService.getCurrentUser.and.returnValue(mockSystemUser);
    authService.isSystem.and.returnValue(true);

    const resultPromise = firstValueFrom(guard.canActivate({} as any, { url: '/diagnostics' } as any));

    authStatusSubject.next('authenticated');
    const result = await resultPromise;

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to login when authStatus resolves to unauthenticated', async () => {
    const resultPromise = firstValueFrom(guard.canActivate({} as any, { url: '/diagnostics' } as any));

    authStatusSubject.next('unauthenticated');
    const result = await resultPromise;

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirects to unauthorized when user is not in System group', async () => {
    authService.getCurrentUser.and.returnValue(mockNonSystemUser);
    authService.isSystem.and.returnValue(false);

    const resultPromise = firstValueFrom(guard.canActivate({} as any, { url: '/diagnostics' } as any));

    authStatusSubject.next('authenticated');
    const result = await resultPromise;

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('allows through on SSR (server platform)', async () => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        SystemGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    });

    const ssrGuard = TestBed.inject(SystemGuard);
    const result = await firstValueFrom(ssrGuard.canActivate({} as any, { url: '/diagnostics' } as any));

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
