import { Body, Controller, Post, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ReportsService, ExportReportOptions } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/permissions.enum';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('export')
  @Permissions(Permission.ManageComplianceTasks)
  async exportReport(
    @Body() body: ExportReportOptions,
    @Res({ passthrough: true }) response: FastifyReply
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateReport(body);

    response.header('Content-Type', result.contentType);
    response.header('Content-Disposition', `attachment; filename="${result.filename}"`);

    return new StreamableFile(result.buffer);
  }
}
