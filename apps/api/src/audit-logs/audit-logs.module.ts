import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService]
})
export class AuditLogsModule {}
