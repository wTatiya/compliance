import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../authorization/roles.enum';

type AssigneeWithSecurity = {
  id: string;
  email: string;
  passwordHash?: string | null;
  departmentId?: string | null;
  roles: { role: { name: string } }[];
  departments?: { departmentId: string }[];
};

export interface AuthUser {
  id: string;
  email: string;
  roles: Role[];
  departmentIds: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  departmentIds: string[];
  sessionId: string;
}

export interface SessionToken {
  accessToken: string;
  payload: JwtPayload;
  expiresIn: number;
}

interface LoginResult {
  user: AuthUser;
  session: SessionToken;
}

@Injectable()
export class AuthService {
  private readonly defaultSessionSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    const raw = this.configService.get<string | number>('JWT_EXPIRES_IN', 3600);
    this.defaultSessionSeconds = typeof raw === 'string' ? this.parseExpires(raw) : Number(raw);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const assignee = (await this.prisma.assignee.findUnique({
      where: { email },
      include: {
        roles: {
          include: { role: true }
        },
        departments: {
          include: { department: true }
        }
      }
    })) as AssigneeWithSecurity | null;

    if (!assignee || !assignee.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, assignee.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user: AuthUser = {
      id: assignee.id,
      email: assignee.email,
      roles: assignee.roles.map(({ role }) => role.name as Role),
      departmentIds: this.extractDepartmentIds(assignee)
    };

    const session = await this.createSession(user);

    return { user, session };
  }

  async createSession(user: AuthUser, expiresInSeconds = this.defaultSessionSeconds): Promise<SessionToken> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      departmentIds: user.departmentIds,
      sessionId: randomUUID()
    };

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: expiresInSeconds });

    return { accessToken, payload, expiresIn: expiresInSeconds };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token);
  }

  buildSessionCookie(token: string, expiresInSeconds = this.defaultSessionSeconds): string {
    const expires = new Date(Date.now() + expiresInSeconds * 1000).toUTCString();
    return `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${expires}`;
  }

  private extractDepartmentIds(assignee: AssigneeWithSecurity): string[] {
    const departmentIds = new Set<string>();

    if (assignee.departmentId) {
      departmentIds.add(assignee.departmentId);
    }

    if (Array.isArray(assignee.departments)) {
      for (const membership of assignee.departments) {
        if (membership?.departmentId) {
          departmentIds.add(membership.departmentId);
        }
      }
    }

    return Array.from(departmentIds);
  }

  private parseExpires(raw: string): number {
    const trimmed = raw.trim();
    const durationRegex = /^(\d+)([smhd])$/i;
    const directSeconds = Number(trimmed);

    if (!Number.isNaN(directSeconds)) {
      return directSeconds;
    }

    const match = trimmed.match(durationRegex);

    if (!match) {
      return 3600;
    }

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}
