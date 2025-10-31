import { AssignmentStatus, ComplianceTaskStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function calculateDueDate(dueDay: number, month: number, year: number): Date {
  const normalizedDay = Math.min(Math.max(Math.trunc(dueDay), 1), 31);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(normalizedDay, lastDay);

  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

async function resetDatabase() {
  await prisma.assignment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.complianceTask.deleteMany();
  await prisma.complianceTemplate.deleteMany();
  await prisma.assigneeDepartment.deleteMany();
  await prisma.assigneeRole.deleteMany();
  await prisma.assignee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
}

async function seedDepartments() {
  const [informationSecurity, fieldOperations] = await Promise.all([
    prisma.department.create({
      data: {
        name: 'Information Security',
        description: 'Protects data, access, and infrastructure for the organisation.'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Field Operations',
        description: 'Coordinates frontline teams performing on-site compliance tasks.'
      }
    })
  ]);

  return { informationSecurity, fieldOperations };
}

type SeededDepartments = Awaited<ReturnType<typeof seedDepartments>>;

async function seedRoles() {
  const roleNames = [
    { name: 'Admin', description: 'Full platform access for configuration and oversight.' },
    { name: 'DepartmentManager', description: 'Manages departmental compliance programs.' },
    { name: 'Assignee', description: 'Completes assigned compliance actions.' }
  ];

  for (const role of roleNames) {
    await prisma.role.create({ data: role });
  }
}

type SeededAssignees = {
  admin: { id: string };
  manager: { id: string };
  frontline: { id: string };
};

async function seedAssignees(departments: SeededDepartments): Promise<SeededAssignees> {
  const password = await bcrypt.hash('Compliance123!', 10);

  const admin = await prisma.assignee.create({
    data: {
      firstName: 'Ada',
      lastName: 'Quinn',
      email: 'admin.qa@example.com',
      phoneNumber: '+15551234500',
      passwordHash: password,
      department: { connect: { id: departments.informationSecurity.id } }
    }
  });

  const manager = await prisma.assignee.create({
    data: {
      firstName: 'Micah',
      lastName: 'Ford',
      email: 'manager.qa@example.com',
      phoneNumber: '+15551234501',
      passwordHash: password,
      department: { connect: { id: departments.fieldOperations.id } }
    }
  });

  const frontline = await prisma.assignee.create({
    data: {
      firstName: 'Lina',
      lastName: 'Rivera',
      email: 'frontline.qa@example.com',
      phoneNumber: '+15551234502',
      passwordHash: password,
      department: { connect: { id: departments.fieldOperations.id } }
    }
  });

  const roleMap = new Map<string, string>();
  for (const role of await prisma.role.findMany()) {
    roleMap.set(role.name, role.id);
  }

  await prisma.assigneeRole.createMany({
    data: [
      { assigneeId: admin.id, roleId: roleMap.get('Admin')! },
      { assigneeId: manager.id, roleId: roleMap.get('DepartmentManager')! },
      { assigneeId: frontline.id, roleId: roleMap.get('Assignee')! }
    ]
  });

  await prisma.assigneeDepartment.createMany({
    data: [
      { assigneeId: admin.id, departmentId: departments.informationSecurity.id, isManager: true },
      { assigneeId: admin.id, departmentId: departments.fieldOperations.id, isManager: true },
      { assigneeId: manager.id, departmentId: departments.fieldOperations.id, isManager: true },
      { assigneeId: frontline.id, departmentId: departments.fieldOperations.id, isManager: false }
    ]
  });

  return { admin, manager, frontline };
}

async function seedTemplatesAndTasks(departments: SeededDepartments, assignees: SeededAssignees) {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const identityReview = await prisma.complianceTemplate.create({
    data: {
      name: 'Identity Access Review',
      description: 'Confirm that privileged accounts are accurate and necessary.',
      dueDay: 9,
      forms: ['access-review-checklist.pdf'],
      requiredDocs: ['privileged-accounts.csv'],
      department: { connect: { id: departments.informationSecurity.id } }
    }
  });

  const fieldInspection = await prisma.complianceTemplate.create({
    data: {
      name: 'Field Inspection Log',
      description: 'Capture site visit outcomes with photos and signatures.',
      dueDay: 5,
      forms: ['inspection-template.docx'],
      requiredDocs: ['photo-evidence.zip'],
      department: { connect: { id: departments.fieldOperations.id } }
    }
  });

  const identityTask = await prisma.complianceTask.create({
    data: {
      title: 'Identity Access Review - Current Month',
      details: identityReview.description,
      month,
      year,
      dueDate: calculateDueDate(identityReview.dueDay, month, year),
      status: ComplianceTaskStatus.IN_PROGRESS,
      template: { connect: { id: identityReview.id } }
    }
  });

  const fieldTask = await prisma.complianceTask.create({
    data: {
      title: 'Field Inspection Log - Current Month',
      details: fieldInspection.description,
      month,
      year,
      dueDate: calculateDueDate(fieldInspection.dueDay, month, year),
      status: ComplianceTaskStatus.PENDING,
      template: { connect: { id: fieldInspection.id } }
    }
  });

  await prisma.assignment.createMany({
    data: [
      {
        assigneeId: assignees.admin.id,
        taskId: identityTask.id,
        status: AssignmentStatus.IN_PROGRESS,
        dueDate: identityTask.dueDate
      },
      {
        assigneeId: assignees.manager.id,
        taskId: fieldTask.id,
        status: AssignmentStatus.PENDING,
        dueDate: fieldTask.dueDate
      },
      {
        assigneeId: assignees.frontline.id,
        taskId: fieldTask.id,
        status: AssignmentStatus.PENDING,
        dueDate: fieldTask.dueDate
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        action: 'seed.qa.identity-assigned',
        actorId: assignees.admin.id,
        taskId: identityTask.id,
        metadata: { note: 'QA baseline record' }
      },
      {
        action: 'seed.qa.field-assigned',
        actorId: assignees.manager.id,
        taskId: fieldTask.id,
        metadata: { note: 'QA baseline record' }
      }
    ]
  });
}

async function main() {
  try {
    await resetDatabase();
    const departments = await seedDepartments();
    await seedRoles();
    const assignees = await seedAssignees(departments);
    await seedTemplatesAndTasks(departments, assignees);

    console.log('QA seed complete', {
      loginEmail: 'admin.qa@example.com',
      password: 'Compliance123!'
    });
  } catch (error) {
    console.error('QA seed failed', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
