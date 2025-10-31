import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { MessagingChannelsService } from './messaging-channels.service';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationsScheduler } from './notifications.scheduler';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, MessagingChannelsService, NotificationTemplatesService, NotificationsScheduler],
  exports: [NotificationsService]
})
export class NotificationsModule {}
