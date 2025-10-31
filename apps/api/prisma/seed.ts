import { AssignmentStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      departmentName: 'Information Security',
      roleNames: ['Compliance Manager']
    },
    {
      firstName: 'Noah',
      lastName: 'Wright',
      email: 'noah.wright@example.com',
      departmentName: 'Information Security',
      roleNames: ['Control Owner']
    },
    {
      firstName: 'Priya',
      lastName: 'Chandrasekar',
      email: 'priya.chandrasekar@example.com',
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
        department: { connect: { name: assignee.departmentName } }
      },
      update: {
        firstName: assignee.firstName,
        lastName: assignee.lastName,
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
      name: 'ISO 27001 Readiness',
      version: 1,
      description: 'Baseline tasks required for ISO 27001 certification readiness.',
      departmentName: 'Information Security',
      tasks: [
        {
          title: 'Review access control policy',
          details: 'Validate that access control policies are current and approved.',
          dueDays: 30
        },
        {
          title: 'Conduct risk assessment workshop',
          details: 'Facilitate annual risk assessment with stakeholders.',
          dueDays: 45
        }
      ]
    },
    {
      name: 'SOX Quarterly Controls',
      version: 1,
      description: 'Quarterly key controls for SOX readiness and attestations.',
      departmentName: 'Finance Compliance',
      tasks: [
        {
          title: 'Reconcile revenue recognition reports',
          details: 'Ensure revenue recognition aligns with GAAP requirements.',
          dueDays: 15
        },
        {
          title: 'Review segregation of duties matrix',
          details: 'Confirm no conflicts in critical finance system roles.',
          dueDays: 20
        }
      ]
    }
  ];

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
        department: template.departmentName
          ? { connect: { name: template.departmentName } }
          : undefined,
        tasks: {
          create: template.tasks.map((task) => ({
            title: task.title,
            details: task.details,
            dueDays: task.dueDays ?? null
          }))
        }
      },
      update: {
        description: template.description,
        department: template.departmentName
          ? { connect: { name: template.departmentName } }
          : { disconnect: true }
      }
    });

    for (const task of template.tasks) {
      await prisma.complianceTask.upsert({
        where: {
          templateId_title: {
            templateId: createdTemplate.id,
            title: task.title
          }
        },
        create: {
          title: task.title,
          details: task.details,
          dueDays: task.dueDays ?? null,
          template: { connect: { id: createdTemplate.id } }
        },
        update: {
          details: task.details,
          dueDays: task.dueDays ?? null
        }
      });
    }
  }

  const accessPolicyTask = await prisma.complianceTask.findFirst({
    where: { title: 'Review access control policy' }
  });
  const revenueReconcileTask = await prisma.complianceTask.findFirst({
    where: { title: 'Reconcile revenue recognition reports' }
  });
  const ivy = await prisma.assignee.findUnique({ where: { email: 'ivy.nguyen@example.com' } });
  const noah = await prisma.assignee.findUnique({ where: { email: 'noah.wright@example.com' } });

  if (accessPolicyTask && ivy) {
    await prisma.assignment.upsert({
      where: {
        assigneeId_taskId: {
          assigneeId: ivy.id,
          taskId: accessPolicyTask.id
        }
      },
      create: {
        assignee: { connect: { id: ivy.id } },
        task: { connect: { id: accessPolicyTask.id } },
        status: AssignmentStatus.IN_PROGRESS,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20)
      },
      update: {}
    });
  }

  if (revenueReconcileTask && noah) {
    await prisma.assignment.upsert({
      where: {
        assigneeId_taskId: {
          assigneeId: noah.id,
          taskId: revenueReconcileTask.id
        }
      },
      create: {
        assignee: { connect: { id: noah.id } },
        task: { connect: { id: revenueReconcileTask.id } },
        status: AssignmentStatus.PENDING
      },
      update: {}
    });
  }

  if (accessPolicyTask && ivy) {
    const existingAuditLog = await prisma.auditLog.findFirst({
      where: {
        taskId: accessPolicyTask.id,
        action: 'Task assigned to Ivy Nguyen'
      }
    });

    if (!existingAuditLog) {
      await prisma.auditLog.create({
        data: {
          task: { connect: { id: accessPolicyTask.id } },
          actor: { connect: { id: ivy.id } },
          action: 'Task assigned to Ivy Nguyen',
          metadata: { source: 'seed-script' }
        }
      });
    }
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
