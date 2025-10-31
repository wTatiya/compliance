import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { DepartmentGuard } from '../authorization/guards/department.guard';
import { DepartmentScoped } from '../common/decorators/department-scope.decorator';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/permissions.enum';

@Controller('departments/:departmentId/assignments')
@UseGuards(JwtAuthGuard, PermissionsGuard, DepartmentGuard)
@DepartmentScoped('departmentId')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @Permissions(Permission.ViewAssignments)
  list(@Param('departmentId') departmentId: string) {
    return this.assignmentsService.listAssignments(departmentId);
  }
}
