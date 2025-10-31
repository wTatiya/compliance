import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogEntity, AuditLogQueryFilters, LogSensitiveActionOptions } from './audit-log.types';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly retentionDays: number;

  constructor(private readonly prisma: PrismaService, configService: ConfigService) {
    this.retentionDays = this.resolveRetentionDays(configService.get('AUDIT_LOG_RETENTION_DAYS'));
  }

  async logSensitiveAction(action: string, options: LogSensitiveActionOptions = {}) {
    const normalizedEntities = this.normalizeEntities(options.entities ?? []);
    const normalizedMetadata = this.normalizeMetadata(options.metadata ?? {});
    const client = options.transaction ?? this.prisma;

    const data: Prisma.AuditLogCreateInput = {
      action,
      metadata:
        normalizedMetadata && Object.keys(normalizedMetadata).length > 0
          ? (normalizedMetadata as Prisma.InputJsonValue)
          : undefined,
      affectedEntities:
        normalizedEntities.length > 0 ? (normalizedEntities as Prisma.InputJsonValue) : undefined,
      primaryEntityType: normalizedEntities[0]?.type,
      primaryEntityId: normalizedEntities[0]?.id ?? undefined
    };

    if (options.actorId) {
      data.actor = { connect: { id: options.actorId } };
    }

    if (options.departmentId) {
      data.department = { connect: { id: options.departmentId } };
    }

    if (options.taskId) {
      data.task = { connect: { id: options.taskId } };
    }

    await client.auditLog.create({ data });
  }

  async findLogs(filters: AuditLogQueryFilters = {}) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.entityType) {
      where.primaryEntityType = filters.entityType;
    }

    if (filters.entityId) {
      where.primaryEntityId = filters.entityId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};

      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }

      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const take = this.resolveTake(filters.limit);
    const skip = this.resolveSkip(filters.offset);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          department: {
            select: {
              id: true,
              name: true
            }
          },
          task: {
            select: {
              id: true,
              title: true
            }
          }
        }
      })
    ]);

    return {
      total,
      limit: take,
      offset: skip,
      records
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async enforceRetentionPolicy() {
    if (this.retentionDays <= 0) {
      return;
    }

    const cutoff = new Date(Date.now() - this.retentionDays * 86400000);
    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    });

    if (result.count > 0) {
      this.logger.log(`Purged ${result.count} audit log records older than ${this.retentionDays} days.`);
    }
  }

  private normalizeEntities(entities: AuditLogEntity[]): AuditLogEntity[] {
    return entities
      .filter((entity) => entity && typeof entity.type === 'string' && entity.type.length > 0)
      .map((entity) => {
        const sanitized: AuditLogEntity = { type: entity.type };

        if (entity.id) {
          sanitized.id = entity.id;
        }

        if (entity.name) {
          sanitized.name = entity.name;
        }

        for (const [key, value] of Object.entries(entity)) {
          if (['type', 'id', 'name'].includes(key)) {
            continue;
          }

          if (value !== undefined) {
            sanitized[key] = value;
          }
        }

        return sanitized;
      });
  }

  private normalizeMetadata(metadata: Record<string, unknown>) {
    const cleanedEntries = Object.entries(metadata).filter(([, value]) => value !== undefined);
    return Object.fromEntries(cleanedEntries);
  }

  private resolveRetentionDays(raw: unknown): number {
    if (raw === null || raw === undefined) {
      return 365;
    }

    const numeric = Number(raw);

    if (!Number.isFinite(numeric)) {
      return 365;
    }

    if (numeric <= 0) {
      return 0;
    }

    return Math.max(30, Math.trunc(numeric));
  }

  private resolveTake(limit?: number) {
    if (!limit || !Number.isFinite(limit) || limit <= 0) {
      return 50;
    }

    return Math.min(200, Math.trunc(limit));
  }

  private resolveSkip(offset?: number) {
    if (!offset || !Number.isFinite(offset) || offset < 0) {
      return 0;
    }

    return Math.trunc(offset);
  }
}
