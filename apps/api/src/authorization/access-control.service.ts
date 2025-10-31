import { Injectable } from '@nestjs/common';
import { Permission } from './permissions.enum';
import { Role } from './roles.enum';

const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [Role.Admin]: [Role.Admin, Role.DepartmentManager, Role.Assignee],
  [Role.DepartmentManager]: [Role.DepartmentManager, Role.Assignee],
  [Role.Assignee]: [Role.Assignee]
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.Admin]: Object.values(Permission),
  [Role.DepartmentManager]: [Permission.ViewAssignments, Permission.ManageAssignments, Permission.ViewDepartments],
  [Role.Assignee]: [Permission.ViewAssignments]
};

@Injectable()
export class AccessControlService {
  isPrivileged(roles: Role[]): boolean {
    return roles.includes(Role.Admin);
  }

  userHasPermission(userRoles: Role[], permission: Permission): boolean {
    for (const role of userRoles) {
      const inheritedRoles = ROLE_HIERARCHY[role] ?? [role];
      for (const inheritedRole of inheritedRoles) {
        const permissions = ROLE_PERMISSIONS[inheritedRole] ?? [];
        if (permissions.includes(permission)) {
          return true;
        }
      }
    }

    return false;
  }

  userHasAllPermissions(userRoles: Role[], permissions: Permission[]): boolean {
    return permissions.every((permission) => this.userHasPermission(userRoles, permission));
  }
}
