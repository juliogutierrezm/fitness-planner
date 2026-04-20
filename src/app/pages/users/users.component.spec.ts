import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { UsersComponent } from './users.component';
import { UserApiService } from '../../user-api.service';
import { AuthService, UserRole } from '../../services/auth.service';
import { ExerciseApiService } from '../../exercise-api.service';

describe('UsersComponent', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let component: UsersComponent;
  let apiSpy: jasmine.SpyObj<UserApiService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let snackOpenSpy: jasmine.Spy;
  let dialogOpenSpy: jasmine.Spy;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<UserApiService>('UserApiService', [
      'canCreateUsers',
      'getUsersForCurrentTenant',
      'resendVerificationCode'
    ]);
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser'], {
      currentUser$: of({
        id: 'admin-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        groups: [],
        companyId: 'gym-1',
        isActive: true
      })
    });
    apiSpy.canCreateUsers.and.returnValue(true);
    apiSpy.getUsersForCurrentTenant.and.returnValue(of([]));
    authSpy.getCurrentUser.and.returnValue({ id: 'admin-1', role: UserRole.ADMIN, companyId: 'gym-1' } as any);

    await TestBed.configureTestingModule({
      imports: [UsersComponent, NoopAnimationsModule],
      providers: [
        { provide: UserApiService, useValue: apiSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: ExerciseApiService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    dialogOpenSpy = spyOn(component['dialog'], 'open');
    snackOpenSpy = spyOn(component['snack'], 'open');
    fixture.detectChanges();
  });

  it('does not call the API when the confirmation dialog is cancelled', () => {
    dialogOpenSpy.and.returnValue({
      afterClosed: () => of(false)
    } as any);

    component.resendVerificationCode({
      id: 'user-1',
      email: 'test@example.com',
      role: 'client'
    });

    expect(dialogOpenSpy).toHaveBeenCalled();
    expect(apiSpy.resendVerificationCode).not.toHaveBeenCalled();
  });

  it('shows a success snackbar and clears loading after a successful resend', fakeAsync(() => {
    const resendSubject = new Subject<any>();
    dialogOpenSpy.and.returnValue({
      afterClosed: () => of(true)
    } as any);
    apiSpy.resendVerificationCode.and.returnValue(resendSubject.asObservable());

    component.resendVerificationCode({
      id: 'user-1',
      email: 'test@example.com',
      role: 'client'
    });

    expect(component.resendingCodeUserId).toBe('user-1');

    resendSubject.next({ ok: true });
    resendSubject.complete();
    tick();

    expect(snackOpenSpy).toHaveBeenCalledWith('Código reenviado correctamente', 'Cerrar', { duration: 1800 });
    expect(component.resendingCodeUserId).toBeNull();
  }));

  it('shows an error snackbar when the service returns null', fakeAsync(() => {
    dialogOpenSpy.and.returnValue({
      afterClosed: () => of(true)
    } as any);
    apiSpy.resendVerificationCode.and.returnValue(of(null));

    component.resendVerificationCode({
      id: 'user-1',
      email: 'test@example.com',
      role: 'client'
    });
    tick();

    expect(snackOpenSpy).toHaveBeenCalledWith('No se pudo reenviar el código', 'Cerrar', { duration: 2500 });
    expect(component.resendingCodeUserId).toBeNull();
  }));

  it('shows an error snackbar when the resend request errors', fakeAsync(() => {
    dialogOpenSpy.and.returnValue({
      afterClosed: () => of(true)
    } as any);
    apiSpy.resendVerificationCode.and.returnValue(throwError(() => new Error('boom')));

    component.resendVerificationCode({
      id: 'user-1',
      email: 'test@example.com',
      role: 'client'
    });
    tick();

    expect(snackOpenSpy).toHaveBeenCalledWith('No se pudo reenviar el código', 'Cerrar', { duration: 2500 });
    expect(component.resendingCodeUserId).toBeNull();
  }));
});
