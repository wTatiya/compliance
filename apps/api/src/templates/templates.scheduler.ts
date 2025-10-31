import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TemplatesService } from './templates.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TemplatesScheduler {
  private readonly logger = new Logger(TemplatesScheduler.name);

  constructor(
    private readonly templatesService: TemplatesService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Cron('0 5 0 1 * *')
  async handleMonthlyGeneration() {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    try {
      const templates = await this.templatesService.listAllTemplates();
      const generatedTaskIds: string[] = [];

      for (const template of templates) {
        const result = await this.templatesService.generateMonthlyTask(template.id, {
          month,
          year,
          automated: true
        });

        if (result.created || result.updated) {
          generatedTaskIds.push(result.task.id);
        }

        if (result.created) {
          await this.notificationsService.notifyTaskCreation(result.task.id, {
            automated: true,
            reason: 'Monthly task generation'
          });
        }
      }

      await this.templatesService.recordAutomationRun({
        month,
        year,
        templateCount: templates.length,
        generatedTaskIds
      });

      this.logger.log(
        `Monthly compliance automation complete for ${templates.length} templates (created/updated: ${generatedTaskIds.length}).`
      );
    } catch (error) {
      this.logger.error('Failed to generate monthly compliance tasks', error instanceof Error ? error.stack : error);
      await this.templatesService.recordAutomationRun({
        month,
        year,
        error: error instanceof Error ? error.message : error
      });
    }
  }
}
