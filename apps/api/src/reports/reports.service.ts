import { Injectable, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DashboardService } from '../dashboard/dashboard.service';
import { DashboardMetrics } from '../dashboard/dashboard.types';

export type ReportFormat = 'pdf' | 'xlsx';

export interface ExportReportOptions {
  departmentId?: string;
  categories: string[];
  format: ReportFormat;
}

interface ReportResult {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

@Injectable()
export class ReportsService {
  constructor(private readonly dashboardService: DashboardService) {}

  async generateReport(options: ExportReportOptions): Promise<ReportResult> {
    if (!options.categories || options.categories.length === 0) {
      throw new BadRequestException('At least one category must be selected.');
    }

    const categories = new Set(options.categories);
    const metrics = await this.dashboardService.getMetrics({ departmentId: options.departmentId });
    const reportTitle = this.buildReportTitle(metrics, options.departmentId);

    switch (options.format) {
      case 'pdf':
        return this.generatePdfReport(metrics, categories, reportTitle);
      case 'xlsx':
        return this.generateWorkbookReport(metrics, categories, reportTitle);
      default:
        throw new BadRequestException(`Unsupported report format: ${options.format}`);
    }
  }

  private async generatePdfReport(
    metrics: DashboardMetrics,
    categories: Set<string>,
    title: string
  ): Promise<ReportResult> {
    const html = this.composeHtml(metrics, categories, title);
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm' } });

      return {
        filename: `${this.slugify(title)}.pdf`,
        contentType: 'application/pdf',
        buffer: pdf
      };
    } finally {
      await browser.close();
    }
  }

  private async generateWorkbookReport(
    metrics: DashboardMetrics,
    categories: Set<string>,
    title: string
  ): Promise<ReportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Compliance Automation';
    workbook.created = new Date(metrics.generatedAt);

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.addRow({ metric: 'Report title', value: title });
    summarySheet.addRow({ metric: 'Generated at', value: new Date(metrics.generatedAt).toISOString() });
    summarySheet.addRow({ metric: 'Total tasks', value: metrics.totals.totalTasks });
    summarySheet.addRow({ metric: 'Completed tasks', value: metrics.totals.completedTasks });
    summarySheet.addRow({ metric: 'Completion rate', value: `${metrics.totals.completionRate}%` });
    summarySheet.addRow({ metric: 'Overdue tasks', value: metrics.totals.overdueTasks });

    if (categories.has('tasks')) {
      const sheet = workbook.addWorksheet('Task status');
      sheet.columns = [
        { header: 'Status', key: 'status', width: 25 },
        { header: 'Count', key: 'count', width: 15 }
      ];

      metrics.statusBreakdown.forEach((item) => {
        sheet.addRow({ status: item.status, count: item.count });
      });
    }

    if (categories.has('departments')) {
      const sheet = workbook.addWorksheet('Department performance');
      sheet.columns = [
        { header: 'Department', key: 'department', width: 30 },
        { header: 'Total tasks', key: 'total', width: 15 },
        { header: 'Completed', key: 'completed', width: 15 },
        { header: 'Completion rate', key: 'rate', width: 18 },
        { header: 'Overdue', key: 'overdue', width: 15 }
      ];

      metrics.departmentSummaries.forEach((summary) => {
        sheet.addRow({
          department: summary.name,
          total: summary.totalTasks,
          completed: summary.completedTasks,
          rate: `${summary.completionRate}%`,
          overdue: summary.overdueTasks
        });
      });
    }

    if (categories.has('overdue')) {
      const sheet = workbook.addWorksheet('Overdue breakdown');
      sheet.columns = [
        { header: 'Department', key: 'department', width: 30 },
        { header: 'Overdue tasks', key: 'overdue', width: 20 }
      ];

      metrics.overdueByDepartment.forEach((item) => {
        sheet.addRow({ department: item.name, overdue: item.overdueTasks });
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      filename: `${this.slugify(title)}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer
    };
  }

  private composeHtml(metrics: DashboardMetrics, categories: Set<string>, title: string) {
    const formattedDate = new Date(metrics.generatedAt).toLocaleString();

    const sections: string[] = [];

    if (categories.has('tasks')) {
      sections.push(`
        <section>
          <h2>Task performance</h2>
          <table>
            <thead>
              <tr><th>Status</th><th>Count</th></tr>
            </thead>
            <tbody>
              ${metrics.statusBreakdown
                .map((item) => `<tr><td>${item.status}</td><td>${item.count}</td></tr>`)
                .join('')}
            </tbody>
          </table>
        </section>
      `);
    }

    if (categories.has('departments')) {
      sections.push(`
        <section>
          <h2>Department performance</h2>
          <table>
            <thead>
              <tr><th>Department</th><th>Total tasks</th><th>Completed</th><th>Completion rate</th><th>Overdue</th></tr>
            </thead>
            <tbody>
              ${metrics.departmentSummaries
                .map(
                  (summary) =>
                    `<tr><td>${summary.name}</td><td>${summary.totalTasks}</td><td>${summary.completedTasks}</td><td>${summary.completionRate}%</td><td>${summary.overdueTasks}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `);
    }

    if (categories.has('overdue')) {
      sections.push(`
        <section>
          <h2>Overdue breakdown</h2>
          <table>
            <thead>
              <tr><th>Department</th><th>Overdue tasks</th></tr>
            </thead>
            <tbody>
              ${metrics.overdueByDepartment
                .map((item) => `<tr><td>${item.name}</td><td>${item.overdueTasks}</td></tr>`)
                .join('')}
            </tbody>
          </table>
        </section>
      `);
    }

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
            p { margin: 4px 0; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
            th, td { border: 1px solid #cbd5f5; padding: 8px; text-align: left; }
            th { background-color: #e2e8f0; }
            section { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p><strong>Generated:</strong> ${formattedDate}</p>
          <p><strong>Total tasks:</strong> ${metrics.totals.totalTasks}</p>
          <p><strong>Completed tasks:</strong> ${metrics.totals.completedTasks} (${metrics.totals.completionRate}%)</p>
          <p><strong>Overdue tasks:</strong> ${metrics.totals.overdueTasks}</p>
          ${sections.join('\n')}
        </body>
      </html>
    `;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private buildReportTitle(metrics: DashboardMetrics, departmentId?: string) {
    if (!departmentId) {
      return 'Compliance report - all departments';
    }

    const match = metrics.departmentSummaries.find((summary) => summary.departmentId === departmentId);
    const departmentName = match?.name ?? departmentId;
    return `Compliance report - ${departmentName}`;
  }
}
