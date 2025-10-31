import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../access-control.service';
import { AuthUser } from '../../auth/auth.service';
import { DEPARTMENT_PARAM_KEY } from '../../common/decorators/department-scope.decorator';

@Injectable()
export class DepartmentGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly accessControl: AccessControlService) {}

  canActivate(context: ExecutionContext): boolean {
    const departmentParam = this.reflector.getAllAndOverride<string>(DEPARTMENT_PARAM_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!departmentParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (this.accessControl.isPrivileged(user.roles)) {
      return true;
    }

    const departmentId =
      request.params?.[departmentParam] ?? request.query?.[departmentParam] ?? request.body?.[departmentParam];

    if (!departmentId) {
      throw new BadRequestException(`Missing department parameter: ${departmentParam}`);
    }

    if (!user.departmentIds?.includes(departmentId)) {
      throw new ForbiddenException('You do not have access to this department');
    }

    return true;
  }
}
