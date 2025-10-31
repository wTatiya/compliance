import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { DepartmentGuard } from './department.guard';
import { AccessControlService } from '../access-control.service';
import { Role } from '../roles.enum';
import { DEPARTMENT_PARAM_KEY } from '../../common/decorators/department-scope.decorator';

const createExecutionContext = (user: any, params: Record<string, string>): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ user, params })
  }),
  getHandler: () => handler,
  getClass: () => classRef
}) as unknown as ExecutionContext;

const handler = () => undefined;
const classRef = class {};

describe('DepartmentGuard', () => {
  let guard: DepartmentGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    Reflect.defineMetadata(DEPARTMENT_PARAM_KEY, 'departmentId', handler);
    guard = new DepartmentGuard(reflector, new AccessControlService());
  });

  it('allows admin users for any department', () => {
    const context = createExecutionContext({ roles: [Role.Admin], departmentIds: [] }, { departmentId: 'dept-123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows managers assigned to the requested department', () => {
    const user = { roles: [Role.DepartmentManager], departmentIds: ['dept-1', 'dept-2'] };
    const context = createExecutionContext(user, { departmentId: 'dept-2' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks managers from unassigned departments', () => {
    const user = { roles: [Role.DepartmentManager], departmentIds: ['dept-1'] };
    const context = createExecutionContext(user, { departmentId: 'dept-2' });
    expect(() => guard.canActivate(context)).toThrow();
  });
});
