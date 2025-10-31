import { Injectable } from '@nestjs/common';
import { ComplianceTaskStatus } from '@prisma/client';

export type NotificationType = 'task.created' | 'task.reminder' | 'task.escalation';

export interface NotificationTemplateContext {
  recipientName: string;
  taskTitle: string;
  dueDate: Date;
  status: ComplianceTaskStatus;
  templateName?: string | null;
  departmentName?: string | null;
  triggerReason?: string | null;
  overdueDays?: number;
}

export interface NotificationTemplateResult {
  subject: string;
  emailBody: string;
  smsBody?: string;
}

@Injectable()
export class NotificationTemplatesService {
  render(type: NotificationType, context: NotificationTemplateContext): NotificationTemplateResult {
    const dueDateLong = this.formatDate(context.dueDate, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const dueDateShort = this.formatDate(context.dueDate, {
      month: 'short',
      day: 'numeric'
    });

    switch (type) {
      case 'task.created':
        return {
          subject: `New compliance task assigned: ${context.taskTitle}`,
          emailBody: [
            `Hello ${context.recipientName},`,
            '',
            `A new compliance task has been generated${context.templateName ? ` from the template "${context.templateName}"` : ''}.`,
            `Title: ${context.taskTitle}`,
            `Current status: ${context.status.replace(/_/g, ' ').toLowerCase()}`,
            `Due date: ${dueDateLong}`,
            '',
            'Please review the task details and begin work as soon as possible.',
            '',
            'Thank you,',
            'Compliance Automation'
          ].join('\n'),
          smsBody: `New compliance task "${context.taskTitle}" due ${dueDateShort}.`
        };
      case 'task.reminder':
        return {
          subject: `Reminder: ${context.taskTitle} due ${dueDateShort}`,
          emailBody: [
            `Hello ${context.recipientName},`,
            '',
            `This is a reminder that the task "${context.taskTitle}" is due on ${dueDateLong}.`,
            `Current status: ${context.status.replace(/_/g, ' ').toLowerCase()}.`,
            context.triggerReason
              ? `Reminder reason: ${context.triggerReason}.`
              : 'Please ensure all required documentation is ready before the deadline.',
            '',
            'If you have already completed the work, please update the task status in the platform.',
            '',
            'Thank you,',
            'Compliance Automation'
          ].join('\n'),
          smsBody: `Reminder: "${context.taskTitle}" due ${dueDateShort}.`
        };
      case 'task.escalation':
        return {
          subject: `Escalation: ${context.taskTitle} is overdue`,
          emailBody: [
            `Hello ${context.recipientName},`,
            '',
            `The task "${context.taskTitle}" is overdue as of ${dueDateLong}.`,
            context.overdueDays
              ? `It has been overdue for ${context.overdueDays} day${context.overdueDays === 1 ? '' : 's'}.`
              : 'The task is now past its due date.',
            context.departmentName
              ? `Department: ${context.departmentName}.`
              : undefined,
            '',
            'Please address this item immediately or update the task status with the latest information.',
            '',
            'Thank you,',
            'Compliance Automation'
          ]
            .filter((line): line is string => typeof line === 'string')
            .join('\n'),
          smsBody: `Escalation: "${context.taskTitle}" overdue since ${dueDateShort}.`
        };
      default:
        throw new Error(`Unsupported notification type: ${type}`);
    }
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      ...options
    }).format(date);
  }
}
