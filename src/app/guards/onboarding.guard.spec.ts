import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { OnboardingGuard } from './onboarding.guard';
import { AuthService } from '../services/auth.service';

describe('OnboardingGuard', () => {
  let guard: OnboardingGuard;
  let authStatusSubject: BehaviorSubject<string>;
  let authService: {
    authStatus$: any;
    hasPlannerGroups: jasmine.Spy;
    isClientOnly: jasmine.Spy;
  };
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authStatusSubject = new BehaviorSubject<string>('authenticated');
    authService = {
      authStatus$: authStatusSubject.asObservable(),
      hasPlannerGroups: jasmine.createSpy('hasPlannerGroups').and.returnValue(false),
      isClientOnly: jasmine.createSpy('isClientOnly').and.returnValue(false)
    };
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        OnboardingGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(OnboardingGuard);
  });

  it('redirects to login when not authenticated', async () => {
    authStatusSubject.next('unauthenticated');

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('allows onboarding when required', async () => {
    authStatusSubject.next('authenticated');
    authService.hasPlannerGroups.and.returnValue(false);
    authService.isClientOnly.and.returnValue(false);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when user already has planner groups', async () => {
    authStatusSubject.next('authenticated');
    authService.hasPlannerGroups.and.returnValue(true);
    authService.isClientOnly.and.returnValue(false);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('redirects to unauthorized when user is client-only', async () => {
    authStatusSubject.next('authenticated');
    authService.hasPlannerGroups.and.returnValue(false);
    authService.isClientOnly.and.returnValue(true);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  it('allows through on SSR (server platform)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        OnboardingGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    });
    const ssrGuard = TestBed.inject(OnboardingGuard);

    const result = await firstValueFrom(ssrGuard.canActivate({} as any, {} as any));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
