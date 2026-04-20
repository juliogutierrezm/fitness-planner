import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { throwError } from 'rxjs';

import { PlannerComponent } from './planner.component';
import { AiGenerationDialogComponent } from './ai/ai-generation-dialog.component';
import { PollingResponse, WorkoutPlan } from '../../shared/models';

describe('PlannerComponent', () => {
  function createComponentWithPollingResponse(response: PollingResponse) {
    const dialogRef = {
      componentInstance: {
        updateProgress: jasmine.createSpy('updateProgress')
      },
      close: jasmine.createSpy('close')
    };
    const dialog = {
      open: jasmine.createSpy('open').and.returnValue(dialogRef)
    };
    const api = {
      pollPlanByExecution: jasmine.createSpy('pollPlanByExecution').and.returnValue(of(response))
    };
    const cdr = {
      markForCheck: jasmine.createSpy('markForCheck')
    };

    const component = new PlannerComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      cdr as any,
      api as any,
      {} as any,
      {} as any,
      {} as any,
      { open: jasmine.createSpy('open') } as any,
      dialog as any,
      {} as any,
      { clearPlanData: jasmine.createSpy('clearPlanData') } as any,
      {} as any
    );

    component['currentUserId'] = 'user-1';
    component.currentExecutionId = 'execution-1';
    spyOn<any>(component, 'applyPlanToPlanner');
    spyOn<any>(component, 'loadAiPlanQuota');

    return { api, component, dialog, dialogRef };
  }

  function createComponentForTemplateLoad(apiResult: any) {
    const api = {
      getWorkoutPlanById: jasmine.createSpy('getWorkoutPlanById').and.returnValue(apiResult)
    };
    const snackBar = {
      open: jasmine.createSpy('open')
    };
    const cdr = {
      markForCheck: jasmine.createSpy('markForCheck')
    };
    const formService = {
      applyTemplateNameValidators: jasmine.createSpy('applyTemplateNameValidators')
    };

    const component = new PlannerComponent(
      formService as any,
      {} as any,
      {} as any,
      {} as any,
      cdr as any,
      api as any,
      {} as any,
      {} as any,
      {} as any,
      snackBar as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    component.form = new FormGroup({
      templateName: new FormControl(''),
      sessionCount: new FormControl(1),
      notes: new FormControl(''),
      objective: new FormControl('')
    });

    spyOn<any>(component, 'initializeNewPlanSessions');
    spyOn<any>(component, 'applyTemplateToPlanner');

    return { api, snackBar, cdr, component };
  }

  it('opens the AI dialog in pending state and propagates in-progress updates', fakeAsync(() => {
    const { api, component, dialog, dialogRef } = createComponentWithPollingResponse({
      status: 'IN_PROGRESS',
      currentStep: 'STRUCTURING_PLAN',
      updatedAt: '2026-03-11T12:00:00.000Z'
    });

    component.startPolling();

    expect(dialog.open).toHaveBeenCalledWith(
      AiGenerationDialogComponent,
      jasmine.objectContaining({
        data: jasmine.objectContaining({
          currentStep: null,
          status: 'PENDING'
        })
      })
    );

    tick(2500);

    expect(api.pollPlanByExecution).toHaveBeenCalledWith('user-1', 'execution-1');
    expect(component.currentAiStatus).toBe('IN_PROGRESS');
    expect(component.currentAiStep).toBe('STRUCTURING_PLAN');
    expect(dialogRef.componentInstance.updateProgress).toHaveBeenCalledWith({
      currentStep: 'STRUCTURING_PLAN',
      status: 'IN_PROGRESS'
    });

    component['stopPolling']();
    discardPeriodicTasks();
  }));

  it('marks the dialog as completed before closing when the plan is ready', fakeAsync(() => {
    const plan: WorkoutPlan = {
      id: 'plan-1',
      name: 'Plan IA',
      date: '2026-03-11T12:00:00.000Z',
      sessions: []
    };
    const { component, dialogRef } = createComponentWithPollingResponse({
      status: 'COMPLETED',
      plan
    });

    component.startPolling();
    tick(2500);

    expect(dialogRef.componentInstance.updateProgress).toHaveBeenCalledWith({
      currentStep: 'FINAL_VALIDATION',
      status: 'COMPLETED'
    });
    expect(dialogRef.componentInstance.updateProgress).toHaveBeenCalledBefore(dialogRef.close);
    expect((component as any).applyPlanToPlanner).toHaveBeenCalledWith(plan);
    expect(dialogRef.close).toHaveBeenCalled();
    expect((component as any).loadAiPlanQuota).toHaveBeenCalled();
  }));

  it('shows a not found message and initializes empty sessions when template load returns 404', () => {
    const { api, snackBar, component } = createComponentForTemplateLoad(
      throwError(() => ({ status: 404 }))
    );

    (component as any).loadTemplateForPlanner(' template-404 ');

    expect(api.getWorkoutPlanById).toHaveBeenCalledWith('template-404');
    expect(snackBar.open).toHaveBeenCalledWith('No se encontró la plantilla.', 'Cerrar', { duration: 3000 });
    expect((component as any).initializeNewPlanSessions).toHaveBeenCalled();
    expect((component as any).applyTemplateToPlanner).not.toHaveBeenCalled();
    expect(component['planLoaded']).toBeTrue();
  });

  it('shows a permissions message and initializes empty sessions when template load returns 403', () => {
    const { snackBar, component } = createComponentForTemplateLoad(
      throwError(() => ({ status: 403 }))
    );

    (component as any).loadTemplateForPlanner('template-403');

    expect(snackBar.open).toHaveBeenCalledWith('No tienes permisos para cargar esta plantilla.', 'Cerrar', { duration: 3000 });
    expect((component as any).initializeNewPlanSessions).toHaveBeenCalled();
    expect((component as any).applyTemplateToPlanner).not.toHaveBeenCalled();
    expect(component['planLoaded']).toBeTrue();
  });

  it('applies the template when the template plan loads successfully', () => {
    const templatePlan = {
      planId: 'template-1',
      isTemplate: true,
      sessions: [{ id: 'session-1', items: [{}] }]
    };
    const { component } = createComponentForTemplateLoad(of(templatePlan));

    (component as any).loadTemplateForPlanner(' template-1 ');

    expect((component as any).applyTemplateToPlanner).toHaveBeenCalledWith(templatePlan);
    expect((component as any).initializeNewPlanSessions).not.toHaveBeenCalled();
    expect(component['planLoaded']).toBeTrue();
  });
});
