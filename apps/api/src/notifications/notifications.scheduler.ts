import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron('0 0 9 * * *')
  async handleDailyReminders() {
    try {
      await this.notificationsService.processUpcomingReminders({ automated: true });
      this.logger.log('Processed scheduled reminder notifications.');
    } catch (error) {
      this.logger.error(
        'Failed to process reminder notifications',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  @Cron('0 30 14 * * *')
  async handleDailyEscalations() {
    try {
      await this.notificationsService.processOverdueEscalations({ automated: true });
      this.logger.log('Processed scheduled escalation notifications.');
    } catch (error) {
      this.logger.error(
        'Failed to process escalation notifications',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }
}
