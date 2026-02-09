import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { SystemGuard } from './system.guard';
import { AuthService, UserProfile, UserRole } from '../services/auth.service';

describe('SystemGuard', () => {
  let guard: SystemGuard;
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
    const authSpy = jasmine.createSpyObj('AuthService', [
      'getAuthStatusSync',
      'isSystem'
    ], {
      currentUser$: of(mockNonSystemUser)
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        SystemGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    guard = TestBed.inject(SystemGuard);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access on SSR (server platform)', (done) => {
    TestBed.resetTestingModule();
    const authSpy = jasmine.createSpyObj('AuthService', [
      'getAuthStatusSync',
      'isSystem'
    ], {
      currentUser$: of(mockNonSystemUser)
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        SystemGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    });
    const ssrGuard = TestBed.inject(SystemGuard);

    ssrGuard.canActivate({} as any, { url: '/diagnostics' } as any).subscribe(result => {
      expect(result).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      done();
    });
  });

  it('should redirect to login when user is null', (done) => {
    authService.getAuthStatusSync.and.returnValue('authenticated');
    (Object.getOwnPropertyDescriptor(authService, 'currentUser$')!.get as jasmine.Spy).and.returnValue(of(null));

    guard.canActivate({} as any, { url: '/diagnostics' } as any).subscribe(result => {
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      done();
    });
  });

  it('should redirect to unauthorized when user is not in System group', (done) => {
    authService.getAuthStatusSync.and.returnValue('authenticated');
    (Object.getOwnPropertyDescriptor(authService, 'currentUser$')!.get as jasmine.Spy).and.returnValue(of(mockNonSystemUser));
    authService.isSystem.and.returnValue(false);

    guard.canActivate({} as any, { url: '/diagnostics' } as any).subscribe(result => {
      expect(result).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
      done();
    });
  });

  it('should allow access when user is in System group', (done) => {
    authService.getAuthStatusSync.and.returnValue('authenticated');
    (Object.getOwnPropertyDescriptor(authService, 'currentUser$')!.get as jasmine.Spy).and.returnValue(of(mockSystemUser));
    authService.isSystem.and.returnValue(true);

    guard.canActivate({} as any, { url: '/diagnostics' } as any).subscribe(result => {
      expect(result).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
      done();
    });
  });
});
