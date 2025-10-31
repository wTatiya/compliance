import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import { TemplatesService, TemplatePayload, TemplateUpdatePayload } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { DepartmentGuard } from '../authorization/guards/department.guard';
import { DepartmentScoped } from '../common/decorators/department-scope.decorator';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/permissions.enum';

interface TemplateRequestBody {
  name?: string;
  description?: string | null;
  dueDay?: number;
  forms?: string[] | string;
  requiredDocs?: string[] | string;
}

interface RegenerateRequestBody {
  month?: number;
  year?: number;
  reason?: string;
}

interface RequestWithUser {
  user?: { sub?: string };
}

@Controller('departments/:departmentId/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard, DepartmentGuard)
@DepartmentScoped('departmentId')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Permissions(Permission.ViewTemplates)
  listTemplates(@Param('departmentId') departmentId: string) {
    return this.templatesService.listTemplates(departmentId);
  }

  @Get(':templateId')
  @Permissions(Permission.ViewTemplates)
  getTemplate(@Param('departmentId') departmentId: string, @Param('templateId') templateId: string) {
    return this.templatesService.getTemplate(departmentId, templateId);
  }

  @Post()
  @Permissions(Permission.ManageTemplates)
  createTemplate(
    @Param('departmentId') departmentId: string,
    @Body() body: TemplateRequestBody,
    @Req() request: RequestWithUser
  ) {
    const payload = this.parseTemplatePayload(body, true) as TemplatePayload;
    return this.templatesService.createTemplate(departmentId, payload, {
      actorId: request.user?.sub ?? null
    });
  }

  @Put(':templateId')
  @Permissions(Permission.ManageTemplates)
  updateTemplate(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Body() body: TemplateRequestBody,
    @Req() request: RequestWithUser
  ) {
    const payload = this.parseTemplatePayload(body, false) as TemplateUpdatePayload;
    return this.templatesService.updateTemplate(departmentId, templateId, payload, {
      actorId: request.user?.sub ?? null
    });
  }

  @Delete(':templateId')
  @Permissions(Permission.ManageTemplates)
  deleteTemplate(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Req() request: RequestWithUser
  ) {
    return this.templatesService.deleteTemplate(departmentId, templateId, {
      actorId: request.user?.sub ?? null
    });
  }

  @Post(':templateId/regenerate')
  @Permissions(Permission.ManageComplianceTasks)
  async regenerateTask(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Body() body: RegenerateRequestBody,
    @Req() request: RequestWithUser
  ) {
    await this.templatesService.getTemplate(departmentId, templateId);
    const { month, year } = this.resolveMonthYear(body);
    const actorId = request.user?.sub ?? null;

    return this.templatesService.generateMonthlyTask(templateId, {
      month,
      year,
      actorId,
      force: true,
      reason: body.reason,
      automated: false
    });
  }

  private parseTemplatePayload(body: TemplateRequestBody, requireAllFields: boolean): TemplatePayload | TemplateUpdatePayload {
    const parsedDueDay =
      typeof body.dueDay === 'number'
        ? body.dueDay
        : typeof body.dueDay === 'string'
        ? Number.parseInt(body.dueDay, 10)
        : undefined;
    const hasDueDay = typeof parsedDueDay === 'number' && Number.isFinite(parsedDueDay);

    if (requireAllFields) {
      if (!body.name) {
        throw new BadRequestException('Template name is required');
      }

      if (!hasDueDay) {
        throw new BadRequestException('Template dueDay must be provided');
      }
    }

    const normalizedForms = this.normalizeToArray(body.forms);
    const normalizedDocs = this.normalizeToArray(body.requiredDocs);

    if (requireAllFields) {
      return {
        name: body.name as string,
        description: body.description ?? null,
        dueDay: parsedDueDay as number,
        forms: normalizedForms,
        requiredDocs: normalizedDocs
      };
    }

    const payload: TemplateUpdatePayload = {};

    if (body.name !== undefined) {
      payload.name = body.name;
    }

    if (body.description !== undefined) {
      payload.description = body.description ?? null;
    }

    if (hasDueDay) {
      payload.dueDay = parsedDueDay;
    }

    if (normalizedForms !== undefined) {
      payload.forms = normalizedForms;
    }

    if (normalizedDocs !== undefined) {
      payload.requiredDocs = normalizedDocs;
    }

    return payload;
  }

  private normalizeToArray(value: string[] | string | undefined) {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private resolveMonthYear(body: RegenerateRequestBody) {
    const now = new Date();
    const month = typeof body.month === 'number' ? body.month : now.getUTCMonth() + 1;
    const year = typeof body.year === 'number' ? body.year : now.getUTCFullYear();

    return { month, year };
  }
}
