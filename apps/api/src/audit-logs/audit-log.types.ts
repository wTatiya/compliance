import { Prisma } from '@prisma/client';

export interface AuditLogEntity {
  type: string;
  id?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface LogSensitiveActionOptions {
  actorId?: string | null;
  departmentId?: string | null;
  taskId?: string | null;
  entities?: AuditLogEntity[];
  metadata?: Record<string, unknown> | null;
  transaction?: Prisma.TransactionClient;
}

export interface AuditLogQueryFilters {
  action?: string;
  actorId?: string;
  departmentId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
