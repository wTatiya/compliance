import ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { DashboardMetrics } from '../dashboard/dashboard.types';

const metrics: DashboardMetrics = {
  generatedAt: '2024-03-01T12:00:00.000Z',
  totals: {
    totalTasks: 20,
    completedTasks: 15,
    completionRate: 75,
    overdueTasks: 5
  },
  statusBreakdown: [
    { status: 'PENDING' as any, count: 5 },
    { status: 'COMPLETED' as any, count: 15 }
  ],
  departmentSummaries: [
    {
      departmentId: 'dept-1',
      name: 'Information Security',
      totalTasks: 10,
      completedTasks: 8,
      completionRate: 80,
      overdueTasks: 2
    },
    {
      departmentId: 'dept-2',
      name: 'Finance',
      totalTasks: 10,
      completedTasks: 7,
      completionRate: 70,
      overdueTasks: 3
    }
  ],
  overdueByDepartment: [
    { departmentId: 'dept-1', name: 'Information Security', overdueTasks: 2 },
    { departmentId: 'dept-2', name: 'Finance', overdueTasks: 3 }
  ],
  monthlyTrends: []
};

describe('ReportsService', () => {
  let service: ReportsService;
  const dashboardService = {
    getMetrics: jest.fn().mockResolvedValue(metrics)
  } as unknown as DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(dashboardService);
  });

  it('requires at least one category', async () => {
    await expect(
      service.generateReport({ categories: [], format: 'xlsx' as const })
    ).rejects.toThrow('At least one category must be selected.');
  });

  it('delegates to the workbook generator for spreadsheet exports', async () => {
    const workbookSpy = jest
      .spyOn(service as any, 'generateWorkbookReport')
      .mockResolvedValue({
        filename: 'report.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('test')
      });

    const result = await service.generateReport({ categories: ['tasks'], format: 'xlsx' });

    expect(dashboardService.getMetrics).toHaveBeenCalledWith({ departmentId: undefined });
    expect(workbookSpy).toHaveBeenCalledWith(metrics, new Set(['tasks']), 'Compliance report - all departments');
    expect(result.filename).toBe('report.xlsx');
  });

  it('delegates to the pdf generator for pdf exports', async () => {
    const pdfSpy = jest.spyOn(service as any, 'generatePdfReport').mockResolvedValue({
      filename: 'report.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('pdf')
    });

    const result = await service.generateReport({ categories: ['tasks'], format: 'pdf' });

    expect(pdfSpy).toHaveBeenCalledWith(metrics, new Set(['tasks']), 'Compliance report - all departments');
    expect(result.contentType).toBe('application/pdf');
  });

  it('builds department specific titles when an id is provided', async () => {
    const workbookSpy = jest
      .spyOn(service as any, 'generateWorkbookReport')
      .mockResolvedValue({
        filename: 'report.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('test')
      });

    await service.generateReport({ categories: ['tasks'], format: 'xlsx', departmentId: 'dept-2' });

    expect(workbookSpy).toHaveBeenCalledWith(
      metrics,
      new Set(['tasks']),
      'Compliance report - Finance'
    );
  });

  it('produces detailed worksheets for workbook exports', async () => {
    const result = await (service as any).generateWorkbookReport(
      metrics,
      new Set(['tasks', 'departments', 'overdue']),
      'Compliance report - all departments'
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);

    expect(workbook.creator).toBe('Compliance Automation');
    const summary = workbook.getWorksheet('Summary');
    expect(summary).toBeDefined();
    const tasksSheet = workbook.getWorksheet('Task status');
    const departmentsSheet = workbook.getWorksheet('Department performance');
    const overdueSheet = workbook.getWorksheet('Overdue breakdown');

    expect(tasksSheet?.rowCount).toBeGreaterThan(1);
    expect(departmentsSheet?.rowCount).toBeGreaterThan(1);
    expect(overdueSheet?.rowCount).toBeGreaterThan(1);
    expect(result.filename).toBe('compliance-report-all-departments.xlsx');
    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });
});
