import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AssignmentsModule } from './assignments.module';
import { AuthService } from '../auth/auth.service';
import { Role } from '../authorization/roles.enum';
import { PrismaService } from '../prisma/prisma.service';

describe('AssignmentsController (integration)', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AssignmentsModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        assignee: {
          findUnique: jest.fn()
        }
      })
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    authService = moduleRef.get(AuthService);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows administrators to access any department', async () => {
    const { accessToken } = await authService.createSession({
      id: 'admin-1',
      email: 'admin@example.com',
      roles: [Role.Admin],
      departmentIds: ['dept-root']
    });

    await request(app.getHttpServer())
      .get('/departments/dept-abc/assignments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }: Response) => {
        expect(body.departmentId).toBe('dept-abc');
      });
  });

  it('blocks managers from departments they are not assigned to', async () => {
    const { accessToken } = await authService.createSession({
      id: 'manager-1',
      email: 'manager@example.com',
      roles: [Role.DepartmentManager],
      departmentIds: ['dept-1']
    });

    await request(app.getHttpServer())
      .get('/departments/dept-2/assignments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('supports multi-department access for managers', async () => {
    const { accessToken } = await authService.createSession({
      id: 'manager-2',
      email: 'manager2@example.com',
      roles: [Role.DepartmentManager],
      departmentIds: ['dept-1', 'dept-2']
    });

    await request(app.getHttpServer())
      .get('/departments/dept-2/assignments')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }: Response) => {
        expect(body.departmentId).toBe('dept-2');
      });
  });
});
