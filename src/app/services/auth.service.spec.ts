import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService, AuthStatus, UserProfile, UserRole } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const buildUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.TRAINER,
    groups: ['Trainer'],
    companyId: 'company-1',
    isActive: true,
    ...overrides
  });

  const setAuthState = (status: AuthStatus, user: UserProfile | null): void => {
    (service as any).authStatusSubject.next(status);
    (service as any).currentUserSubject.next(user);
    (service as any).isAuthenticatedSubject.next(status === 'authenticated');
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('resolveEntryTarget returns /login when unauthenticated', () => {
    setAuthState('unauthenticated', null);

    expect(service.resolveEntryTarget()).toBe('/login');
  });

  it('resolveEntryTarget returns /onboarding when authenticated but not initialized', () => {
    setAuthState('authenticated', buildUser({ companyId: undefined }));

    expect(service.resolveEntryTarget()).toBe('/onboarding');
  });

  it('resolveEntryTarget returns /dashboard when authenticated and initialized (INDEPENDENT allowed)', () => {
    setAuthState('authenticated', buildUser({ companyId: 'INDEPENDENT' }));

    expect(service.isUserInitialized()).toBeTrue();
    expect(service.resolveEntryTarget()).toBe('/dashboard');
  });

  it('falls back to unauthenticated when auth resolution times out', fakeAsync(() => {
    spyOn(console, 'error');
    spyOn<any>(service, 'resolveBrowserAuthState').and.returnValue(new Promise(() => {}));

    const promise = service.checkAuthState(false, true);
    let settled = false;
    promise.then(() => {
      settled = true;
    });

    tick(8001);
    flushMicrotasks();

    expect(settled).toBeTrue();
    expect(service.getAuthStatusSync()).toBe('unauthenticated');
    expect(service.isAuthenticatedSync()).toBeFalse();

    let loading = true;
    service.isAuthLoading$.subscribe(value => {
      loading = value;
    }).unsubscribe();
    expect(loading).toBeFalse();
  }));
});
