import { AssignmentStatus, ComplianceTaskStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const now = new Date();
const currentMonth = now.getUTCMonth() + 1;
const currentYear = now.getUTCFullYear();

function calculateDueDate(dueDay: number, month: number, year: number): Date {
  const normalizedDay = Math.min(Math.max(Math.trunc(dueDay), 1), 31);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(normalizedDay, lastDay);

  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

async function seedReferenceData() {
  const departments = [
    {
      name: 'Information Security',
      description: 'Oversees security posture, controls, and policies.'
    },
    {
      name: 'Finance Compliance',
      description: 'Ensures finance and accounting adhere to regulations.'
    }
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: { name: department.name },
      create: department,
      update: { description: department.description }
    });
  }

  const roles = [
    { name: 'Compliance Manager', description: 'Coordinates compliance initiatives.' },
    { name: 'Control Owner', description: 'Owns controls and remediation tasks.' },
    { name: 'Auditor', description: 'Performs control testing and auditing.' }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: role,
      update: { description: role.description }
    });
  }

  const assignees = [
    {
      firstName: 'Ivy',
      lastName: 'Nguyen',
      email: 'ivy.nguyen@example.com',
      phoneNumber: '+15551230100',
      departmentName: 'Information Security',
      roleNames: ['Compliance Manager']
    },
    {
      firstName: 'Noah',
      lastName: 'Wright',
      email: 'noah.wright@example.com',
      phoneNumber: '+15551230200',
      departmentName: 'Information Security',
      roleNames: ['Control Owner']
    },
    {
      firstName: 'Priya',
      lastName: 'Chandrasekar',
      email: 'priya.chandrasekar@example.com',
      phoneNumber: '+15551230300',
      departmentName: 'Finance Compliance',
      roleNames: ['Auditor']
    }
  ];

  for (const assignee of assignees) {
    const record = await prisma.assignee.upsert({
      where: { email: assignee.email },
      create: {
        firstName: assignee.firstName,
        lastName: assignee.lastName,
        email: assignee.email,
        phoneNumber: assignee.phoneNumber,
        department: { connect: { name: assignee.departmentName } }
      },
      update: {
        firstName: assignee.firstName,
        lastName: assignee.lastName,
        phoneNumber: assignee.phoneNumber,
        department: { connect: { name: assignee.departmentName } }
      }
    });

    for (const roleName of assignee.roleNames) {
      await prisma.assigneeRole.upsert({
        where: {
          assigneeId_roleId: {
            assigneeId: record.id,
            roleId: (await prisma.role.findUniqueOrThrow({ where: { name: roleName } })).id
          }
        },
        create: {
          assignee: { connect: { id: record.id } },
          role: { connect: { name: roleName } }
        },
        update: {}
      });
    }
  }

  const templates = [
    {
      name: 'Monthly Access Review',
      version: 1,
      description: 'Collect and validate system access reviews for critical applications.',
      departmentName: 'Information Security',
      dueDay: 10,
      forms: ['Access review checklist', 'Exception approval form'],
      requiredDocs: ['access-review-report.pdf', 'exception-approvals.zip']
    },
    {
      name: 'Monthly Financial Controls',
      version: 1,
      description: 'Compile financial evidence supporting SOX key controls.',
      departmentName: 'Finance Compliance',
      dueDay: 12,
      forms: ['Control owner attestation', 'Variance analysis form'],
      requiredDocs: ['ledger-export.csv', 'variance-explanations.docx']
    }
  ];

  const generatedTasks: Record<string, { id: string; dueDay: number }> = {};

  for (const template of templates) {
    const createdTemplate = await prisma.complianceTemplate.upsert({
      where: {
        name_version: {
          name: template.name,
          version: template.version
        }
      },
      create: {
        name: template.name,
        version: template.version,
        description: template.description,
        dueDay: template.dueDay,
        forms: template.forms,
        requiredDocs: template.requiredDocs,
        department: template.departmentName
          ? { connect: { name: template.departmentName } }
          : undefined
      },
      update: {
        description: template.description,
        dueDay: template.dueDay,
        forms: template.forms,
        requiredDocs: template.requiredDocs,
        department: template.departmentName
          ? { connect: { name: template.departmentName } }
          : { disconnect: true }
      }
    });

    const dueDate = calculateDueDate(template.dueDay, currentMonth, currentYear);
    const title = `${template.name} - ${dueDate.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric'
    })}`;

    const createdTask = await prisma.complianceTask.upsert({
      where: {
        templateId_month_year: {
          templateId: createdTemplate.id,
          month: currentMonth,
          year: currentYear
        }
      },
      create: {
        title,
        details: template.description,
        month: currentMonth,
        year: currentYear,
        dueDate,
        status: ComplianceTaskStatus.PENDING,
        template: { connect: { id: createdTemplate.id } }
      },
      update: {
        title,
        details: template.description,
        dueDate,
        status: ComplianceTaskStatus.PENDING
      }
    });

    generatedTasks[template.name] = { id: createdTask.id, dueDay: template.dueDay };
  }

  const ivy = await prisma.assignee.findUnique({ where: { email: 'ivy.nguyen@example.com' } });
  const noah = await prisma.assignee.findUnique({ where: { email: 'noah.wright@example.com' } });

  if (ivy && generatedTasks['Monthly Access Review']) {
    const { id: taskId, dueDay } = generatedTasks['Monthly Access Review'];

    await prisma.assignment.upsert({
      where: {
        assigneeId_taskId: {
          assigneeId: ivy.id,
          taskId
        }
      },
      create: {
        assignee: { connect: { id: ivy.id } },
        task: { connect: { id: taskId } },
        status: AssignmentStatus.IN_PROGRESS,
        dueDate: calculateDueDate(dueDay, currentMonth, currentYear)
      },
      update: {}
    });

    const existingAuditLog = await prisma.auditLog.findFirst({
      where: {
        taskId,
        action: 'task.assigned.seed.ivy'
      }
    });

    if (!existingAuditLog) {
      await prisma.auditLog.create({
        data: {
          task: { connect: { id: taskId } },
          actor: { connect: { id: ivy.id } },
          action: 'task.assigned.seed.ivy',
          metadata: { source: 'seed-script', assignee: ivy.email }
        }
      });
    }
  }

  if (noah && generatedTasks['Monthly Financial Controls']) {
    const { id: taskId } = generatedTasks['Monthly Financial Controls'];

    await prisma.assignment.upsert({
      where: {
        assigneeId_taskId: {
          assigneeId: noah.id,
          taskId
        }
      },
      create: {
        assignee: { connect: { id: noah.id } },
        task: { connect: { id: taskId } },
        status: AssignmentStatus.PENDING
      },
      update: {}
    });
  }
}

async function main() {
  try {
    await seedReferenceData();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seeding failed', error);
  process.exit(1);
});
