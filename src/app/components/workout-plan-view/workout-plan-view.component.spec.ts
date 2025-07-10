import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutPlanViewComponent } from './workout-plan-view.component';

describe('WorkoutPlanViewComponent', () => {
  let component: WorkoutPlanViewComponent;
  let fixture: ComponentFixture<WorkoutPlanViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutPlanViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutPlanViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
