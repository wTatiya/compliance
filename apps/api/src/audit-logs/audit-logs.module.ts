import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessControlService } from '../authorization/access-control.service';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AccessControlService, PermissionsGuard],
  exports: [AuditLogsService]
})
export class AuditLogsModule {}
