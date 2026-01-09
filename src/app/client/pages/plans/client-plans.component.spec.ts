import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ClientPlansComponent } from './client-plans.component';
import { ClientPlansService } from '../../services/client-data.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('ClientPlansComponent', () => {
  const plansServiceStub = {
    getMyPlans: () => of([])
  };

  const snackBarStub = { open: jasmine.createSpy('open') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientPlansComponent, NoopAnimationsModule],
      providers: [
        { provide: ClientPlansService, useValue: plansServiceStub },
        { provide: MatSnackBar, useValue: snackBarStub }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientPlansComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
