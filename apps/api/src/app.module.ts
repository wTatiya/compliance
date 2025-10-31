import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TemplatesModule } from './templates/templates.module';
import { ComplianceTasksModule } from './compliance-tasks/compliance-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env']
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    AssignmentsModule,
    TemplatesModule,
    ComplianceTasksModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
