import { Module } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { AuthModule } from '../auth/auth.module';
import { AccessControlService } from '../authorization/access-control.service';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { DepartmentGuard } from '../authorization/guards/department.guard';

@Module({
  imports: [AuthModule],
  providers: [AssignmentsService, AccessControlService, PermissionsGuard, DepartmentGuard],
  controllers: [AssignmentsController]
})
export class AssignmentsModule {}
