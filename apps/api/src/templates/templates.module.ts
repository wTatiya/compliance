import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TemplatesScheduler } from './templates.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesScheduler],
  exports: [TemplatesService]
})
export class TemplatesModule {}
