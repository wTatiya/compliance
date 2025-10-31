import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService, AuthUser } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../authorization/roles.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: 'unit-test-secret', signOptions: { expiresIn: '1h' } })
        },
        {
          provide: PrismaService,
          useValue: {
            assignee: {
              findUnique: jest.fn()
            }
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'JWT_SECRET') {
                return 'unit-test-secret';
              }

              if (key === 'JWT_EXPIRES_IN') {
                return '1h';
              }

              return defaultValue;
            })
          }
        },
        {
          provide: AuditLogsService,
          useValue: { logSensitiveAction: jest.fn() }
        }
      ]
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
