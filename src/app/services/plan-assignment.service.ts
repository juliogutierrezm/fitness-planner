import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppUser } from '../user-api.service';

@Injectable({
  providedIn: 'root'
})
export class PlanAssignmentService {
  private planDataSource = new BehaviorSubject<{ user: AppUser | null, plan: any | null } | null>(null);
  currentPlanData = this.planDataSource.asObservable();

  constructor() { }

  setPlanData(user: AppUser, plan: any) {
    this.planDataSource.next({ user, plan });
  }

  clearPlanData() {
    this.planDataSource.next(null);
  }
}
