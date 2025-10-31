import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplianceTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface UpdateOptions {
  actorId?: string | null;
  reason?: string;
}

@Injectable()
export class ComplianceTasksService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService) {}

  listTasks(departmentId: string) {
    return this.prisma.complianceTask.findMany({
      where: { template: { departmentId } },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            dueDay: true,
            forms: true,
            requiredDocs: true
          }
        }
      },
      orderBy: [{ dueDate: 'asc' }]
    });
  }

  skipTask(departmentId: string, taskId: string, options: UpdateOptions = {}) {
    return this.updateTaskStatus(departmentId, taskId, ComplianceTaskStatus.SKIPPED, 'task.skipped', options);
  }

  closeTask(departmentId: string, taskId: string, options: UpdateOptions = {}) {
    return this.updateTaskStatus(departmentId, taskId, ComplianceTaskStatus.CLOSED, 'task.closed', options);
  }

  reopenTask(departmentId: string, taskId: string, options: UpdateOptions = {}) {
    return this.updateTaskStatus(departmentId, taskId, ComplianceTaskStatus.PENDING, 'task.reopened', options);
  }

  private async updateTaskStatus(
    departmentId: string,
    taskId: string,
    status: ComplianceTaskStatus,
    action: string,
    options: UpdateOptions
  ) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.complianceTask.findFirst({
        where: { id: taskId, template: { departmentId } }
      });

      if (!task) {
        throw new NotFoundException('Task not found');
      }

      const closedStatuses = new Set<ComplianceTaskStatus>([
        ComplianceTaskStatus.SKIPPED,
        ComplianceTaskStatus.CLOSED,
        ComplianceTaskStatus.COMPLETED
      ]);
      const isClosedStatus = closedStatuses.has(status);

      const updated = await tx.complianceTask.update({
        where: { id: taskId },
        data: {
          status,
          manualOverride: true,
          closedAt: isClosedStatus ? new Date() : null
        }
      });

      const metadata: Record<string, unknown> = {
        taskId,
        departmentId,
        fromStatus: task.status,
        toStatus: status,
        reason: options.reason ?? null
      };

      await this.auditLogs.logSensitiveAction(action, {
        actorId: options.actorId ?? null,
        departmentId,
        taskId,
        metadata,
        entities: [
          {
            type: 'complianceTask',
            id: taskId,
            fromStatus: task.status,
            toStatus: status
          }
        ],
        transaction: tx
      });

      return updated;
    });
  }
}
