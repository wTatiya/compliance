import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ComplianceTask, ComplianceTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface TemplatePayload {
  name: string;
  description?: string | null;
  dueDay: number;
  forms?: string[];
  requiredDocs?: string[];
}

export type TemplateUpdatePayload = Partial<TemplatePayload>;

type GenerateOptions = {
  month: number;
  year: number;
  actorId?: string | null;
  force?: boolean;
  reason?: string;
  automated?: boolean;
};

type GenerateResult = {
  task: ComplianceTask;
  created: boolean;
  updated: boolean;
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(departmentId: string) {
    return this.prisma.complianceTemplate.findMany({
      where: { departmentId },
      orderBy: { name: 'asc' }
    });
  }

  async listAllTemplates() {
    return this.prisma.complianceTemplate.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async getTemplate(departmentId: string, templateId: string) {
    const template = await this.prisma.complianceTemplate.findFirst({
      where: { id: templateId, departmentId }
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(departmentId: string, payload: TemplatePayload) {
    const data = this.buildTemplateCreateData(payload, departmentId);

    return this.prisma.complianceTemplate.create({ data });
  }

  async updateTemplate(departmentId: string, templateId: string, payload: TemplateUpdatePayload) {
    await this.ensureTemplateExists(departmentId, templateId);

    const data = this.buildTemplateUpdateData(payload);

    return this.prisma.complianceTemplate.update({
      where: { id: templateId },
      data
    });
  }

  async deleteTemplate(departmentId: string, templateId: string) {
    await this.ensureTemplateExists(departmentId, templateId);

    await this.prisma.complianceTemplate.delete({ where: { id: templateId } });

    return { success: true };
  }

  async generateMonthlyTask(templateId: string, options: GenerateOptions): Promise<GenerateResult> {
    const template = await this.prisma.complianceTemplate.findUnique({ where: { id: templateId } });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const { month, year } = this.normalizeMonthYear(options.month, options.year);
    const dueDate = this.calculateDueDate(template.dueDay, month, year);
    const title = `${template.name} - ${this.formatMonthYear(month, year)}`;
    const description = template.description ?? null;
    const metadata = {
      templateId,
      month,
      year,
      departmentId: template.departmentId,
      automated: options.automated ?? false,
      reason: options.reason ?? null
    };

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.complianceTask.findUnique({
        where: { templateId_month_year: { templateId, month, year } }
      });

      if (existing && !options.force) {
        return { task: existing, created: false, updated: false };
      }

      if (existing && options.force) {
        const updated = await tx.complianceTask.update({
          where: { id: existing.id },
          data: {
            title,
            details: description,
            dueDate,
            status: ComplianceTaskStatus.PENDING,
            manualOverride: true,
            closedAt: null
          }
        });

        await this.createAuditLog(tx, updated.id, options.actorId, 'task.regenerated', metadata);

        return { task: updated, created: false, updated: true };
      }

      const created = await tx.complianceTask.create({
        data: {
          title,
          details: description,
          month,
          year,
          dueDate,
          status: ComplianceTaskStatus.PENDING,
          manualOverride: options.force ?? false,
          template: { connect: { id: templateId } }
        }
      });

      await this.createAuditLog(tx, created.id, options.actorId, 'task.generated', metadata);

      return { task: created, created: true, updated: false };
    });
  }

  async recordAutomationRun(metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        action: 'automation.tasks.monthly',
        metadata
      }
    });
  }

  private async ensureTemplateExists(departmentId: string, templateId: string) {
    const exists = await this.prisma.complianceTemplate.count({
      where: { id: templateId, departmentId }
    });

    if (!exists) {
      throw new NotFoundException('Template not found');
    }
  }

  private buildTemplateCreateData(
    payload: TemplatePayload,
    departmentId: string
  ): Prisma.ComplianceTemplateUncheckedCreateInput {
    const normalizedDueDay = this.normalizeDueDay(payload.dueDay);

    return {
      name: payload.name,
      description: payload.description ?? null,
      departmentId,
      dueDay: normalizedDueDay,
      forms: this.cleanStringArray(payload.forms),
      requiredDocs: this.cleanStringArray(payload.requiredDocs)
    } as Prisma.ComplianceTemplateUncheckedCreateInput;
  }

  private buildTemplateUpdateData(payload: TemplateUpdatePayload): Prisma.ComplianceTemplateUncheckedUpdateInput {
    const data: Prisma.ComplianceTemplateUncheckedUpdateInput = {};

    if (typeof payload.name === 'string') {
      data.name = payload.name;
    }

    if (payload.description !== undefined) {
      data.description = payload.description ?? null;
    }

    if (payload.dueDay !== undefined) {
      data.dueDay = this.normalizeDueDay(payload.dueDay);
    }

    if (payload.forms !== undefined) {
      data.forms = this.cleanStringArray(payload.forms);
    }

    if (payload.requiredDocs !== undefined) {
      data.requiredDocs = this.cleanStringArray(payload.requiredDocs);
    }

    return data;
  }

  private normalizeDueDay(day: number): number {
    if (!Number.isFinite(day)) {
      return 1;
    }

    const integerDay = Math.trunc(day);
    return Math.min(Math.max(integerDay, 1), 31);
  }

  private calculateDueDate(dueDay: number, month: number, year: number): Date {
    const normalizedDay = this.normalizeDueDay(dueDay);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(normalizedDay, lastDay);

    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }

  private formatMonthYear(month: number, year: number): string {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  private normalizeMonthYear(month: number, year: number) {
    const normalizedMonth = Math.min(Math.max(Math.trunc(month), 1), 12);
    const normalizedYear = Math.trunc(year);

    return { month: normalizedMonth, year: normalizedYear };
  }

  private cleanStringArray(values?: string[] | null) {
    if (!Array.isArray(values)) {
      return null;
    }

    const cleaned = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0));

    return cleaned.length > 0 ? cleaned : null;
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    taskId: string,
    actorId: string | null | undefined,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await tx.auditLog.create({
      data: {
        task: { connect: { id: taskId } },
        actor: actorId ? { connect: { id: actorId } } : undefined,
        action,
        metadata
      }
    });
  }
}
