import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Session } from '../../../shared/models';

/**
 * Purpose: centralize planner form creation and session-count-driven planning.
 * Input/Output: builds FormGroup instances and returns updated Session arrays.
 * Error handling: guards invalid form controls and defaults to safe fallbacks.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class PlannerFormService {
  constructor(private fb: FormBuilder) {}

  createPlannerForm(defaultDate: Date = new Date()): FormGroup {
    return this.fb.group({
      userName: [''],
      templateName: [''],
      sessionCount: [3],
      notes: [''],
      targetUserId: [''],
      objective: [''],
      date: [defaultDate]
    });
  }

  applyTemplateNameValidators(form: FormGroup | null | undefined, isTemplateMode: boolean): void {
    const control = form?.get('templateName');
    if (!control) return;
    if (isTemplateMode) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  buildSessionsFromCount(currentSessions: Session[], count: number): Session[] {
    const nextSessions = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `Sesión ${i + 1}`,
      items: currentSessions[i]?.items || []
    }));
    return nextSessions;
  }
}
