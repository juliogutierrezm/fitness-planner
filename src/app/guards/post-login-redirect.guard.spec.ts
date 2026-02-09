import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { PostLoginRedirectGuard } from './post-login-redirect.guard';
import { AuthService } from '../services/auth.service';

describe('PostLoginRedirectGuard', () => {
  let guard: PostLoginRedirectGuard;
  let authService: {
    hasPlannerGroups: jasmine.Spy;
    isClientOnly: jasmine.Spy;
    isAuthenticatedSync: jasmine.Spy;
  };
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = {
      hasPlannerGroups: jasmine.createSpy('hasPlannerGroups'),
      isClientOnly: jasmine.createSpy('isClientOnly'),
      isAuthenticatedSync: jasmine.createSpy('isAuthenticatedSync')
    };
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        PostLoginRedirectGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(PostLoginRedirectGuard);
  });

  it('allows navigation when already on onboarding', () => {
    authService.isAuthenticatedSync.and.returnValue(true);
    authService.isClientOnly.and.returnValue(false);
    authService.hasPlannerGroups.and.returnValue(false);

    const result = guard.canActivate({ routeConfig: { path: 'onboarding' } } as any, { url: '/onboarding' } as any);

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to onboarding when authenticated without planner groups', () => {
    authService.isAuthenticatedSync.and.returnValue(true);
    authService.isClientOnly.and.returnValue(false);
    authService.hasPlannerGroups.and.returnValue(false);

    const result = guard.canActivate({} as any, { url: '/dashboard' } as any);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('allows navigation when authenticated with planner groups', () => {
    authService.isAuthenticatedSync.and.returnValue(true);
    authService.isClientOnly.and.returnValue(false);
    authService.hasPlannerGroups.and.returnValue(true);

    const result = guard.canActivate({} as any, { url: '/dashboard' } as any);

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows navigation when not authenticated', () => {
    authService.isAuthenticatedSync.and.returnValue(false);
    authService.isClientOnly.and.returnValue(false);
    authService.hasPlannerGroups.and.returnValue(false);

    const result = guard.canActivate({} as any, { url: '/dashboard' } as any);

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to unauthorized when user is client-only', () => {
    authService.isAuthenticatedSync.and.returnValue(true);
    authService.isClientOnly.and.returnValue(true);
    authService.hasPlannerGroups.and.returnValue(false);

    const result = guard.canActivate({} as any, { url: '/dashboard' } as any);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});
