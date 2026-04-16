import { TemplatesComponent } from './templates.component';

describe('TemplatesComponent', () => {
  function createComponent() {
    const templateAssignment = {
      assignTemplateToUser: jasmine.createSpy('assignTemplateToUser')
    };
    const snackBar = {
      open: jasmine.createSpy('open')
    };

    const component = new TemplatesComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      snackBar as any,
      {} as any,
      {} as any,
      {} as any,
      templateAssignment as any
    );

    return { component, snackBar, templateAssignment };
  }

  it('uses getPlanKey semantics when assigning a template to a selected user', () => {
    const { component, templateAssignment, snackBar } = createComponent();
    component.selectedUserId = 'user-1';

    component.assignTemplate({
      SK: 'PLAN#template-123'
    });

    expect(templateAssignment.assignTemplateToUser).toHaveBeenCalledWith(
      jasmine.objectContaining({
        userId: 'user-1',
        templateId: 'template-123',
        snackBar
      })
    );
  });

  it('uses the pending template id normalized from SK when selecting a user from the dialog', () => {
    const { component, templateAssignment, snackBar } = createComponent();
    component['pendingTemplateId'] = component.getPlanId({
      SK: 'PLAN#template-456'
    });
    component['userSelectDialogRef'] = {
      close: jasmine.createSpy('close')
    };

    component.selectUserForAssignment({
      id: 'user-2',
      email: 'user2@example.com',
      role: 'client'
    });

    expect(templateAssignment.assignTemplateToUser).toHaveBeenCalledWith(
      jasmine.objectContaining({
        userId: 'user-2',
        templateId: 'template-456',
        snackBar
      })
    );
  });
});
