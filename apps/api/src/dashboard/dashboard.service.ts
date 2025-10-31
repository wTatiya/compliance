import { Injectable } from '@nestjs/common';
import { ComplianceTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardMetrics, DepartmentSummary, MetricsQueryOptions, TrendPoint } from './dashboard.types';

const CLOSED_STATUSES = new Set<ComplianceTaskStatus>([
  ComplianceTaskStatus.COMPLETED,
  ComplianceTaskStatus.CLOSED,
  ComplianceTaskStatus.SKIPPED
]);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(options: MetricsQueryOptions = {}): Promise<DashboardMetrics> {
    const where: Prisma.ComplianceTaskWhereInput = {};

    if (options.departmentId) {
      where.template = { departmentId: options.departmentId };
    }

    const tasks = await this.prisma.complianceTask.findMany({
      where,
      include: {
        template: {
          select: {
            departmentId: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const statusCounts = new Map<ComplianceTaskStatus, number>();
    Object.values(ComplianceTaskStatus).forEach((status) => statusCounts.set(status, 0));

    const departmentSummaries = new Map<string, DepartmentSummary>();
    const monthlyTrends = new Map<string, TrendPoint>();

    const now = new Date();
    let overdueTasks = 0;

    for (const task of tasks) {
      const status = task.status;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

      const departmentId = task.template.departmentId ?? 'unassigned';
      const departmentName = task.template.department?.name ?? 'Unassigned';
      const summary = departmentSummaries.get(departmentId) ?? {
        departmentId,
        name: departmentName,
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        overdueTasks: 0
      };

      summary.totalTasks += 1;
      if (task.status === ComplianceTaskStatus.COMPLETED) {
        summary.completedTasks += 1;
      }

      if (!CLOSED_STATUSES.has(task.status) && task.dueDate < now) {
        summary.overdueTasks += 1;
        overdueTasks += 1;
      }

      departmentSummaries.set(departmentId, summary);

      const trendKey = `${task.year}-${String(task.month).padStart(2, '0')}`;
      const trend =
        monthlyTrends.get(trendKey) ??
        ({
          label: this.formatTrendLabel(task.year, task.month),
          pending: 0,
          inProgress: 0,
          completed: 0,
          skipped: 0,
          closed: 0
        } satisfies TrendPoint);

      switch (task.status) {
        case ComplianceTaskStatus.PENDING:
          trend.pending += 1;
          break;
        case ComplianceTaskStatus.IN_PROGRESS:
          trend.inProgress += 1;
          break;
        case ComplianceTaskStatus.COMPLETED:
          trend.completed += 1;
          break;
        case ComplianceTaskStatus.SKIPPED:
          trend.skipped += 1;
          break;
        case ComplianceTaskStatus.CLOSED:
          trend.closed += 1;
          break;
        default:
          break;
      }

      monthlyTrends.set(trendKey, trend);
    }

    const totalTasks = tasks.length;
    const completedTasks = statusCounts.get(ComplianceTaskStatus.COMPLETED) ?? 0;

    const departmentSummaryList = Array.from(departmentSummaries.values()).map((summary) => ({
      ...summary,
      completionRate: summary.totalTasks ? Math.round((summary.completedTasks / summary.totalTasks) * 1000) / 10 : 0
    }));

    const metrics: DashboardMetrics = {
      generatedAt: new Date().toISOString(),
      totals: {
        totalTasks,
        completedTasks,
        completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0,
        overdueTasks
      },
      statusBreakdown: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
      departmentSummaries: departmentSummaryList.sort((a, b) => a.name.localeCompare(b.name)),
      overdueByDepartment: departmentSummaryList
        .filter((summary) => summary.overdueTasks > 0)
        .map((summary) => ({
          departmentId: summary.departmentId,
          name: summary.name,
          overdueTasks: summary.overdueTasks
        }))
        .sort((a, b) => b.overdueTasks - a.overdueTasks),
      monthlyTrends: Array.from(monthlyTrends.entries())
        .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0))
        .map(([, trend]) => trend)
    };

    return metrics;
  }

  private formatTrendLabel(year: number, month: number) {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }
}
