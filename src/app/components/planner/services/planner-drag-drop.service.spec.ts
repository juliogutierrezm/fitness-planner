import { TestBed } from '@angular/core/testing';
import { PlannerDragDropService } from './planner-drag-drop.service';

// Purpose: placeholder test for planner drag-drop service creation.
// Input: none. Output: service instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('PlannerDragDropService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should create', () => {
    const service = TestBed.inject(PlannerDragDropService);
    expect(service).toBeTruthy();
  });
});
