import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuthService, AuthUser } from './auth.service';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../authorization/roles.enum';

describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'unit-test-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        assignee: {
          findUnique: jest.fn()
        }
      })
      .compile();

    service = moduleRef.get(AuthService);
  });

  it('creates and verifies a session token', async () => {
    const user: AuthUser = {
      id: 'user-1',
      email: 'test@example.com',
      roles: [Role.Assignee],
      departmentIds: ['dept-1']
    };

    const session = await service.createSession(user, 120);
    expect(session.accessToken).toBeDefined();
    expect(session.expiresIn).toBe(120);

    const payload = await service.verifyToken(session.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.roles).toContain(Role.Assignee);
    expect(payload.departmentIds).toEqual(['dept-1']);
  });

  it('builds a secure session cookie string', async () => {
    const session = await service.createSession(
      {
        id: 'user-2',
        email: 'cookie@example.com',
        roles: [Role.Admin],
        departmentIds: ['dept-1', 'dept-2']
      },
      60
    );

    const cookie = service.buildSessionCookie(session.accessToken, session.expiresIn);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
  });
});
