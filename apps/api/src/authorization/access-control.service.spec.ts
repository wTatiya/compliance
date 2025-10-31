import { AccessControlService } from './access-control.service';
import { Role } from './roles.enum';
import { Permission } from './permissions.enum';

describe('AccessControlService', () => {
  let service: AccessControlService;

  beforeEach(() => {
    service = new AccessControlService();
  });

  it('grants administrators every permission', () => {
    const permissions = Object.values(Permission);
    expect(service.userHasAllPermissions([Role.Admin], permissions)).toBe(true);
  });

  it('detects privileged roles', () => {
    expect(service.isPrivileged([Role.Admin])).toBe(true);
    expect(service.isPrivileged([Role.DepartmentManager])).toBe(false);
    expect(service.isPrivileged([Role.Assignee])).toBe(false);
  });

  it('respects hierarchy for department managers', () => {
    expect(service.userHasPermission([Role.DepartmentManager], Permission.ViewAssignments)).toBe(true);
    expect(service.userHasPermission([Role.DepartmentManager], Permission.ManageAssignments)).toBe(true);
  });

  it('prevents assignees from managing assignments', () => {
    expect(service.userHasPermission([Role.Assignee], Permission.ManageAssignments)).toBe(false);
  });

  it('grants access when any assigned role covers the permission', () => {
    expect(
      service.userHasPermission([Role.Assignee, Role.DepartmentManager], Permission.ManageTemplates)
    ).toBe(true);
  });

  it('requires every permission in aggregated checks', () => {
    expect(
      service.userHasAllPermissions([Role.DepartmentManager], [
        Permission.ViewAssignments,
        Permission.ManageAssignments
      ])
    ).toBe(true);

    expect(
      service.userHasAllPermissions([Role.Assignee], [
        Permission.ViewAssignments,
        Permission.ManageAssignments
      ])
    ).toBe(false);
  });
});
