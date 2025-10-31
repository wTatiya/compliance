import { ComplianceTaskStatus } from '@prisma/client';

export interface StatusBreakdown {
  status: ComplianceTaskStatus;
  count: number;
}

export interface DepartmentSummary {
  departmentId: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  overdueTasks: number;
}

export interface TrendPoint {
  label: string;
  pending: number;
  inProgress: number;
  completed: number;
  skipped: number;
  closed: number;
}

export interface DashboardMetrics {
  generatedAt: string;
  totals: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
  };
  statusBreakdown: StatusBreakdown[];
  departmentSummaries: DepartmentSummary[];
  overdueByDepartment: Array<Pick<DepartmentSummary, 'departmentId' | 'name' | 'overdueTasks'>>;
  monthlyTrends: TrendPoint[];
}

export interface MetricsQueryOptions {
  departmentId?: string;
}
