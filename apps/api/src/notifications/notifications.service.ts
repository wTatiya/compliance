import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Assignment,
  Assignee,
  AssigneeDepartment,
  ComplianceTask,
  ComplianceTaskStatus,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingChannelsService, DeliveryResult } from './messaging-channels.service';
import {
  NotificationTemplatesService,
  NotificationType
} from './notification-templates.service';

export type NotificationChannel = 'email' | 'sms';

interface NotificationOptions {
  automated?: boolean;
  reason?: string | null;
}

interface ReminderOptions extends NotificationOptions {
  windowHours?: number;
}

interface NotificationRecipient {
  id: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  role: 'assignee' | 'manager';
}

type TaskWithRelations = ComplianceTask & {
  template: {
    id: string;
    name: string;
    departmentId: string | null;
    department?: { id: string; name: string } | null;
  };
  assignments: (Assignment & { assignee: Assignee })[];
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingChannels: MessagingChannelsService,
    private readonly templates: NotificationTemplatesService
  ) {}

  async notifyTaskCreation(taskId: string, options: NotificationOptions = {}) {
    const task = await this.loadTask(taskId);
    const recipients = this.buildAssigneeRecipients(task.assignments);

    await this.dispatchNotifications(task, recipients, 'task.created', options);
  }

  async processUpcomingReminders(options: ReminderOptions = {}) {
    const windowHours = options.windowHours ?? 48;
    const now = new Date();
    const upperBound = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
    const automated = options.automated;

    const tasks = await this.prisma.complianceTask.findMany({
      where: {
        status: { in: [ComplianceTaskStatus.PENDING, ComplianceTaskStatus.IN_PROGRESS] },
        dueDate: {
          gte: now,
          lte: upperBound
        }
      },
      include: {
        template: { include: { department: true } },
        assignments: { include: { assignee: true } }
      }
    });

    for (const task of tasks) {
      const recipients = this.buildAssigneeRecipients(task.assignments);
      if (!recipients.length) {
        continue;
      }

      const hoursUntilDue = Math.max(0, Math.floor((task.dueDate.getTime() - now.getTime()) / (60 * 60 * 1000)));
      const reason = options.reason ?? `Task due in approximately ${hoursUntilDue} hour${hoursUntilDue === 1 ? '' : 's'}`;

      await this.dispatchNotifications(task, recipients, 'task.reminder', {
        automated,
        reason
      });
    }
  }

  async processOverdueEscalations(options: NotificationOptions = {}) {
    const now = new Date();

    const tasks = await this.prisma.complianceTask.findMany({
      where: {
        status: { in: [ComplianceTaskStatus.PENDING, ComplianceTaskStatus.IN_PROGRESS] },
        dueDate: {
          lt: now
        }
      },
      include: {
        template: { include: { department: true } },
        assignments: { include: { assignee: true } }
      }
    });

    for (const task of tasks) {
      const assigneeRecipients = this.buildAssigneeRecipients(task.assignments);
      const managerRecipients = await this.getManagerRecipients(task.template.departmentId ?? null);
      const recipients = this.mergeRecipients(assigneeRecipients, managerRecipients);

      if (!recipients.length) {
        continue;
      }

      const overdueDays = Math.max(
        1,
        Math.floor((now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      );

      await this.dispatchNotifications(task, recipients, 'task.escalation', {
        ...options,
        reason: options.reason ?? 'Task is overdue',
        automated: options.automated ?? true,
        overdueDays
      });
    }
  }

  private async dispatchNotifications(
    task: TaskWithRelations,
    recipients: NotificationRecipient[],
    type: NotificationType,
    options: NotificationOptions & { overdueDays?: number }
  ) {
    this.logger.debug(
      `Dispatching ${type} notification for task ${task.id} to ${recipients.length} recipient(s).`
    );
    for (const recipient of recipients) {
      await this.notifyRecipient(task, recipient, type, options);
    }
  }

  private async notifyRecipient(
    task: TaskWithRelations,
    recipient: NotificationRecipient,
    type: NotificationType,
    options: NotificationOptions & { overdueDays?: number }
  ) {
    const context = {
      recipientName: recipient.name,
      taskTitle: task.title,
      dueDate: task.dueDate,
      status: task.status,
      templateName: task.template.name,
      departmentName: task.template.department?.name ?? null,
      triggerReason: options.reason ?? null,
      overdueDays: options.overdueDays
    };

    let templateCache: ReturnType<NotificationTemplatesService['render']> | null = null;
    const getTemplate = () => {
      if (!templateCache) {
        templateCache = this.templates.render(type, context);
      }
      return templateCache;
    };

    if (recipient.email) {
      const shouldSend = await this.shouldSendNotification(
        task.id,
        type,
        'email',
        recipient.email,
        options.automated ?? false
      );

      if (shouldSend) {
        const template = getTemplate();
        const result = await this.messagingChannels.sendEmail({
          to: recipient.email,
          subject: template.subject,
          body: template.emailBody
        });
        await this.recordDelivery(task.id, type, 'email', recipient, result, options);
      }
    }

    if (recipient.phoneNumber) {
      const shouldSendSms = await this.shouldSendNotification(
        task.id,
        type,
        'sms',
        recipient.phoneNumber,
        options.automated ?? false
      );

      if (shouldSendSms) {
        const template = getTemplate();
        const smsBody = template.smsBody ?? template.emailBody;
        const result = await this.messagingChannels.sendSms({
          to: recipient.phoneNumber,
          body: smsBody
        });
        await this.recordDelivery(task.id, type, 'sms', recipient, result, options);
      }
    }
  }

  private async shouldSendNotification(
    taskId: string,
    type: NotificationType,
    channel: NotificationChannel,
    recipient: string,
    automated: boolean
  ) {
    const lookbackHours = automated ? 24 : 1;
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const existing = await this.prisma.auditLog.findFirst({
      where: {
        taskId,
        action: 'notification.delivery',
        createdAt: { gte: since },
        metadata: {
          path: ['notificationType'],
          equals: type
        },
        AND: [
          { metadata: { path: ['channel'], equals: channel } },
          { metadata: { path: ['recipient'], equals: recipient } }
        ]
      }
    });

    return !existing;
  }

  private async recordDelivery(
    taskId: string,
    type: NotificationType,
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    result: DeliveryResult,
    options: NotificationOptions & { overdueDays?: number }
  ) {
    const metadata: Prisma.JsonObject = {
      notificationType: type,
      channel,
      recipient: channel === 'email' ? recipient.email : recipient.phoneNumber,
      recipientId: recipient.id,
      recipientRole: recipient.role,
      success: result.success,
      statusCode: result.statusCode ?? null,
      externalId: result.externalId ?? null,
      error: result.error ?? null,
      automated: options.automated ?? false,
      reason: options.reason ?? null,
      overdueDays: options.overdueDays ?? null
    };

    await this.prisma.auditLog.create({
      data: {
        task: { connect: { id: taskId } },
        action: 'notification.delivery',
        metadata
      }
    });
  }

  private buildAssigneeRecipients(assignments: (Assignment & { assignee: Assignee })[]) {
    const recipients: NotificationRecipient[] = [];

    for (const assignment of assignments) {
      const assignee = assignment.assignee;
      if (!assignee) {
        continue;
      }

      recipients.push({
        id: assignee.id,
        name: this.combineName(assignee),
        email: assignee.email,
        phoneNumber: assignee.phoneNumber,
        role: 'assignee'
      });
    }

    return recipients;
  }

  private async getManagerRecipients(departmentId: string | null) {
    if (!departmentId) {
      return [];
    }

    const memberships = await this.prisma.assigneeDepartment.findMany({
      where: { departmentId, isManager: true },
      include: { assignee: true }
    });

    return memberships
      .filter((membership): membership is AssigneeDepartment & { assignee: Assignee } => Boolean(membership.assignee))
      .map((membership) => ({
        id: membership.assignee.id,
        name: this.combineName(membership.assignee),
        email: membership.assignee.email,
        phoneNumber: membership.assignee.phoneNumber,
        role: 'manager' as const
      }));
  }

  private mergeRecipients(
    primary: NotificationRecipient[],
    secondary: NotificationRecipient[]
  ): NotificationRecipient[] {
    const merged = new Map<string, NotificationRecipient>();

    for (const recipient of [...primary, ...secondary]) {
      const key = recipient.id;
      if (!merged.has(key)) {
        merged.set(key, recipient);
      } else {
        const existing = merged.get(key)!;
        merged.set(key, {
          ...existing,
          email: existing.email ?? recipient.email,
          phoneNumber: existing.phoneNumber ?? recipient.phoneNumber,
          role: existing.role === 'manager' ? existing.role : recipient.role
        });
      }
    }

    return Array.from(merged.values());
  }

  private combineName(assignee: Assignee) {
    const parts = [assignee.firstName, assignee.lastName].filter((value) => Boolean(value && value.length > 0));
    return parts.join(' ') || assignee.email;
  }

  private async loadTask(taskId: string): Promise<TaskWithRelations> {
    const task = await this.prisma.complianceTask.findUnique({
      where: { id: taskId },
      include: {
        template: { include: { department: true } },
        assignments: { include: { assignee: true } }
      }
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task as TaskWithRelations;
  }
}
