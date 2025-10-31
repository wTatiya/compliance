import { Module } from '@nestjs/common';
import { ComplianceTasksController } from './compliance-tasks.controller';
import { ComplianceTasksService } from './compliance-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceTasksController],
  providers: [ComplianceTasksService]
})
export class ComplianceTasksModule {}
