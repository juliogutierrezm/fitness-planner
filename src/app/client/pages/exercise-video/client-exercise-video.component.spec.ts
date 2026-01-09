import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientExerciseVideoComponent } from './client-exercise-video.component';
import { ClientDataService } from '../../services/client-data.service';

// Purpose: placeholder test for exercise video component creation.
// Input: none. Output: component instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientExerciseVideoComponent', () => {
  const clientDataStub = {
    getMyPlans: () => of([])
  };

  const snackBarStub = { open: jasmine.createSpy('open') };
  const routerStub = { navigate: jasmine.createSpy('navigate') };
  const activatedRouteStub = {
    paramMap: of(convertToParamMap({ planId: 'plan-1', sessionIndex: '0', exerciseIndex: '0' }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientExerciseVideoComponent, NoopAnimationsModule],
      providers: [
        { provide: ClientDataService, useValue: clientDataStub },
        { provide: MatSnackBar, useValue: snackBarStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientExerciseVideoComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
