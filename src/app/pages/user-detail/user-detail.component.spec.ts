import { UserDetailComponent } from './user-detail.component';

describe('UserDetailComponent', () => {
  it('uses getPlanKey semantics when assigning a template to the current user', () => {
    const templateAssignment = {
      assignTemplateToUser: jasmine.createSpy('assignTemplateToUser')
    };
    const snackBar = {
      open: jasmine.createSpy('open')
    };

    const component = new UserDetailComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      snackBar as any,
      {} as any,
      templateAssignment as any
    );
    component.userId = 'user-1';
    component['templateDialogRef'] = {
      close: jasmine.createSpy('close')
    };

    component.selectTemplate({
      SK: 'PLAN#template-789'
    });

    expect(templateAssignment.assignTemplateToUser).toHaveBeenCalledWith(
      jasmine.objectContaining({
        userId: 'user-1',
        templateId: 'template-789',
        snackBar,
        onBeforeNavigate: jasmine.any(Function)
      })
    );
  });
});
