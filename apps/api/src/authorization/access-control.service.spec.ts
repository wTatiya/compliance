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

  it('respects hierarchy for department managers', () => {
    expect(service.userHasPermission([Role.DepartmentManager], Permission.ViewAssignments)).toBe(true);
    expect(service.userHasPermission([Role.DepartmentManager], Permission.ManageAssignments)).toBe(true);
  });

  it('prevents assignees from managing assignments', () => {
    expect(service.userHasPermission([Role.Assignee], Permission.ManageAssignments)).toBe(false);
  });
});
