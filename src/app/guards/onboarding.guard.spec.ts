import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, firstValueFrom } from 'rxjs';
import { OnboardingGuard } from './onboarding.guard';
import { AuthService } from '../services/auth.service';

describe('OnboardingGuard', () => {
  let guard: OnboardingGuard;
  let authService: {
    isAuthenticated$: any;
    hasPlannerGroups: jasmine.Spy;
  };
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = {
      isAuthenticated$: of(true),
      hasPlannerGroups: jasmine.createSpy('hasPlannerGroups').and.returnValue(false)
    };
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        OnboardingGuard,
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    guard = TestBed.inject(OnboardingGuard);
  });

  it('redirects to login when not authenticated', async () => {
    authService.isAuthenticated$ = of(false);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('allows onboarding when required', async () => {
    authService.isAuthenticated$ = of(true);
    authService.hasPlannerGroups.and.returnValue(false);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when user already has planner groups', async () => {
    authService.isAuthenticated$ = of(true);
    authService.hasPlannerGroups.and.returnValue(true);

    const result = await firstValueFrom(guard.canActivate({} as any, {} as any));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
