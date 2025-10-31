import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../permissions.enum';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AccessControlService } from '../access-control.service';
import { AuthUser } from '../../auth/auth.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly accessControl: AccessControlService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.accessControl.userHasAllPermissions(user.roles, requiredPermissions);
  }
}
