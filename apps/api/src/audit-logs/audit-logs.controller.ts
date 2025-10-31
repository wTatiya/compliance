import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/permissions.enum';
import { AuditLogQueryFilters } from './audit-log.types';

interface ListAuditLogsQuery {
  action?: string;
  actorId?: string;
  departmentId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Permissions(Permission.ReviewAuditLogs)
  listAuditLogs(@Query() query: ListAuditLogsQuery) {
    const filters: AuditLogQueryFilters = {};

    if (query.action) {
      filters.action = query.action;
    }

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    if (query.departmentId) {
      filters.departmentId = query.departmentId;
    }

    if (query.entityType) {
      filters.entityType = query.entityType;
    }

    if (query.entityId) {
      filters.entityId = query.entityId;
    }

    if (query.limit) {
      const parsedLimit = Number(query.limit);
      if (Number.isFinite(parsedLimit)) {
        filters.limit = parsedLimit;
      }
    }

    if (query.offset) {
      const parsedOffset = Number(query.offset);
      if (Number.isFinite(parsedOffset)) {
        filters.offset = parsedOffset;
      }
    }

    if (query.startDate) {
      const parsed = new Date(query.startDate);
      if (!Number.isNaN(parsed.getTime())) {
        filters.startDate = parsed;
      }
    }

    if (query.endDate) {
      const parsed = new Date(query.endDate);
      if (!Number.isNaN(parsed.getTime())) {
        filters.endDate = parsed;
      }
    }

    return this.auditLogsService.findLogs(filters);
  }
}
