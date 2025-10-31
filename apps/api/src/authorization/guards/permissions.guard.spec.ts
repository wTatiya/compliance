import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { AccessControlService } from '../access-control.service';
import { Permission } from '../permissions.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Role } from '../roles.enum';

const createExecutionContext = (user: any, handler: any, classRef: any): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ user })
  }),
  getHandler: () => handler,
  getClass: () => classRef
}) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let accessControl: AccessControlService;

  beforeEach(() => {
    reflector = new Reflector();
    accessControl = new AccessControlService();
    guard = new PermissionsGuard(reflector, accessControl);
  });

  it('allows access when permissions are met', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(PERMISSIONS_KEY, [Permission.ViewAssignments], handler);
    const context = createExecutionContext({ roles: [Role.Assignee], departmentIds: [] }, handler, {});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when permissions are missing', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(PERMISSIONS_KEY, [Permission.ManageAssignments], handler);
    const context = createExecutionContext({ roles: [Role.Assignee], departmentIds: [] }, handler, {});
    expect(guard.canActivate(context)).toBe(false);
  });
});
