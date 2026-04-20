import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthService, AuthStatus, UserProfile, UserRole } from '../services/auth.service';
import { RoleGuard } from './role.guard';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let authStatusSubject: BehaviorSubject<AuthStatus>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const mockUser: UserProfile = {
    id: 'trainer-1',
    email: 'trainer@example.com',
    role: UserRole.TRAINER,
    groups: ['Trainer'],
    companyId: 'company-1',
    isActive: true
  };

  beforeEach(() => {
    authStatusSubject = new BehaviorSubject<AuthStatus>('unknown');
    authService = jasmine.createSpyObj(
      'AuthService',
      ['getCurrentUser', 'hasRequiredRoles', 'isIndependentTenant'],
      {
        authStatus$: authStatusSubject.asObservable(),
        currentUser$: of(mockUser)
      }
    );
    authService.getCurrentUser.and.returnValue(mockUser);
    authService.hasRequiredRoles.and.returnValue(true);
    authService.isIndependentTenant.and.returnValue(false);

    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        RoleGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(RoleGuard);
  });

  it('resolves without deadlock when currentUser emitted before authStatus becomes authenticated', async () => {
    const resultPromise = firstValueFrom(
      guard.canActivate(
        { data: { roles: [UserRole.TRAINER] } } as any,
        { url: '/dashboard' } as any
      )
    );

    authStatusSubject.next('authenticated');
    const result = await resultPromise;

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to login when authStatus resolves to unauthenticated', async () => {
    const resultPromise = firstValueFrom(
      guard.canActivate(
        { data: { roles: [UserRole.TRAINER] } } as any,
        { url: '/dashboard' } as any
      )
    );

    authStatusSubject.next('unauthenticated');
    const result = await resultPromise;

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
