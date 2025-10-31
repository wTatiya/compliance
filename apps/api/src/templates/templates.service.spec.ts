import { NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';

const template = {
  id: 'template-1',
  name: 'Monthly Access Review',
  description: 'Verify all privileged access monthly.',
  departmentId: 'dept-1',
  dueDay: 15
};

const baseTask = {
  id: 'task-1',
  title: 'Monthly Access Review - March 2024',
  details: template.description,
  month: 3,
  year: 2024,
  dueDate: new Date('2024-03-15T23:59:59.999Z'),
  status: 'PENDING' as const,
  manualOverride: false
};

type MockTransaction = {
  complianceTask: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('TemplatesService automation flows', () => {
  let service: TemplatesService;
  const auditLogs = { logSensitiveAction: jest.fn() };
  const tx: MockTransaction = {
    complianceTask: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
  const prisma = {
    complianceTemplate: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (callback: (transaction: MockTransaction) => Promise<unknown>) =>
      callback(tx)
    )
  } as unknown as any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-20T12:00:00Z'));
    jest.clearAllMocks();
    prisma.complianceTemplate.findUnique.mockResolvedValue(template);
    service = new TemplatesService(prisma, auditLogs as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a new monthly task when none exists', async () => {
    const createdTask = { ...baseTask, id: 'task-created' };
    tx.complianceTask.findUnique.mockResolvedValue(null);
    tx.complianceTask.create.mockResolvedValue(createdTask);

    const result = await service.generateMonthlyTask(template.id, { month: 3, year: 2024, automated: true });

    expect(prisma.complianceTemplate.findUnique).toHaveBeenCalledWith({ where: { id: template.id } });
    expect(tx.complianceTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Monthly Access Review - March 2024',
        status: 'PENDING',
        manualOverride: false
      })
    });
    expect(auditLogs.logSensitiveAction).toHaveBeenCalledWith(
      'task.generated',
      expect.objectContaining({
        metadata: expect.objectContaining({ automated: true })
      })
    );
    expect(result).toEqual({ task: createdTask, created: true, updated: false });
  });

  it('updates an existing monthly task when forced', async () => {
    const existingTask = { ...baseTask, id: 'task-existing' };
    const regeneratedTask = { ...existingTask, manualOverride: true };
    tx.complianceTask.findUnique.mockResolvedValue(existingTask);
    tx.complianceTask.update.mockResolvedValue(regeneratedTask);

    const result = await service.generateMonthlyTask(template.id, {
      month: 3,
      year: 2024,
      automated: false,
      force: true,
      reason: 'Data refresh'
    });

    expect(tx.complianceTask.update).toHaveBeenCalledWith({
      where: { id: existingTask.id },
      data: expect.objectContaining({
        title: 'Monthly Access Review - March 2024',
        status: 'PENDING',
        manualOverride: true
      })
    });
    expect(auditLogs.logSensitiveAction).toHaveBeenCalledWith(
      'task.regenerated',
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: 'Data refresh' })
      })
    );
    expect(result).toEqual({ task: regeneratedTask, created: false, updated: true });
  });

  it('returns an existing task without auditing when force flag is not set', async () => {
    tx.complianceTask.findUnique.mockResolvedValue(baseTask);

    const result = await service.generateMonthlyTask(template.id, { month: 3, year: 2024, automated: false });

    expect(tx.complianceTask.update).not.toHaveBeenCalled();
    expect(tx.complianceTask.create).not.toHaveBeenCalled();
    expect(auditLogs.logSensitiveAction).not.toHaveBeenCalledWith('task.generated', expect.anything());
    expect(result).toEqual({ task: baseTask, created: false, updated: false });
  });

  it('throws when the template cannot be found', async () => {
    prisma.complianceTemplate.findUnique.mockResolvedValue(null);

    await expect(
      service.generateMonthlyTask('missing-template', { month: 3, year: 2024 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records automation executions', async () => {
    await service.recordAutomationRun({ month: 3, year: 2024, total: 5 });

    expect(auditLogs.logSensitiveAction).toHaveBeenCalledWith('automation.tasks.monthly', {
      metadata: { month: 3, year: 2024, total: 5 },
      entities: [
        {
          type: 'automation',
          name: 'monthly-task-generation'
        }
      ]
    });
  });
});
