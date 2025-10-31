import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ComplianceTasksService } from './compliance-tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { DepartmentGuard } from '../authorization/guards/department.guard';
import { DepartmentScoped } from '../common/decorators/department-scope.decorator';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/permissions.enum';

interface TaskActionBody {
  reason?: string;
}

interface RequestWithUser {
  user?: { sub?: string };
}

@Controller('departments/:departmentId/tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard, DepartmentGuard)
@DepartmentScoped('departmentId')
export class ComplianceTasksController {
  constructor(private readonly complianceTasksService: ComplianceTasksService) {}

  @Get()
  @Permissions(Permission.ViewTemplates)
  listTasks(@Param('departmentId') departmentId: string) {
    return this.complianceTasksService.listTasks(departmentId);
  }

  @Post(':taskId/skip')
  @Permissions(Permission.ManageComplianceTasks)
  skipTask(
    @Param('departmentId') departmentId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskActionBody,
    @Req() request: RequestWithUser
  ) {
    return this.complianceTasksService.skipTask(departmentId, taskId, {
      actorId: request.user?.sub ?? null,
      reason: body.reason
    });
  }

  @Post(':taskId/close')
  @Permissions(Permission.ManageComplianceTasks)
  closeTask(
    @Param('departmentId') departmentId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskActionBody,
    @Req() request: RequestWithUser
  ) {
    return this.complianceTasksService.closeTask(departmentId, taskId, {
      actorId: request.user?.sub ?? null,
      reason: body.reason
    });
  }

  @Post(':taskId/reopen')
  @Permissions(Permission.ManageComplianceTasks)
  reopenTask(
    @Param('departmentId') departmentId: string,
    @Param('taskId') taskId: string,
    @Body() body: TaskActionBody,
    @Req() request: RequestWithUser
  ) {
    return this.complianceTasksService.reopenTask(departmentId, taskId, {
      actorId: request.user?.sub ?? null,
      reason: body.reason
    });
  }
}
