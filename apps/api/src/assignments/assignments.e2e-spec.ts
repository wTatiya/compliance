import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { DepartmentGuard } from '../authorization/guards/department.guard';
import { AccessControlService } from '../authorization/access-control.service';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../auth/auth.service';
import { Role } from '../authorization/roles.enum';

describe('AssignmentsController (integration)', () => {
  let app: INestApplication;
  let currentUser: AuthUser;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        AssignmentsService,
        AccessControlService,
        PermissionsGuard,
        DepartmentGuard,
        Reflector,
        {
          provide: JwtAuthGuard,
          useFactory: () => ({
            canActivate: (context: any) => {
              const requestObject = context.switchToHttp().getRequest();
              requestObject.user = currentUser;
              return true;
            }
          })
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows administrators to access assignments for any department', async () => {
    currentUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      roles: [Role.Admin],
      departmentIds: []
    };

    const response = await request(app.getHttpServer()).get('/departments/finance/assignments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ departmentId: 'finance', assignments: [] });
  });

  it('allows assignees to access assignments for their own department', async () => {
    currentUser = {
      id: 'assignee-1',
      email: 'assignee@example.com',
      roles: [Role.Assignee],
      departmentIds: ['dept-1']
    };

    const response = await request(app.getHttpServer()).get('/departments/dept-1/assignments');

    expect(response.status).toBe(200);
    expect(response.body.departmentId).toBe('dept-1');
  });

  it('blocks assignees from departments they do not belong to', async () => {
    currentUser = {
      id: 'assignee-2',
      email: 'assignee2@example.com',
      roles: [Role.Assignee],
      departmentIds: ['dept-1']
    };

    const response = await request(app.getHttpServer()).get('/departments/dept-2/assignments');

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('do not have access');
  });
});
