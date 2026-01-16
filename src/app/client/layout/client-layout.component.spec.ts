import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ClientLayoutComponent } from './client-layout.component';
import { ThemeService, TenantTheme } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

describe('ClientLayoutComponent', () => {
  const tenantTheme: TenantTheme = {
    primaryColor: '#FF9900',
    accentColor: '#22D3EE',
    backgroundMode: 'dark',
    fontFamily: 'Inter',
    appName: 'TrainGrid',
    tagline: 'Entrena mejor. Progresa mas rapido.',
    logoUrl: '/assets/TrainGrid.png'
  };

  const themeServiceStub = {
    tenantTheme$: of(tenantTheme),
    getTenantTheme: () => of(tenantTheme),
    applyTheme: () => {},
    getCurrentTenantTheme: () => tenantTheme,
    getDefaultTenantTheme: () => tenantTheme
  };

  const authServiceStub = {
    signOut: () => Promise.resolve()
  };

  const snackBarStub = { open: jasmine.createSpy('open') };
  const routerStub = { navigate: jasmine.createSpy('navigate') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientLayoutComponent, NoopAnimationsModule],
      providers: [
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: MatSnackBar, useValue: snackBarStub },
        { provide: Router, useValue: routerStub }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientLayoutComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
