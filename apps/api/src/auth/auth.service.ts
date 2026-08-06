import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { Merchant } from '../entities/merchant.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Role } from '../common/enums/role.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa/mfa.service';
import { FraudService } from '../fraud/fraud.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannelType,
  NotificationPriority,
} from '../entities/notification.entity';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly fraud: FraudService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(
    dto: RegisterDto,
    ctx: RequestContext,
  ): Promise<AuthTokens & { userId: string }> {
    if (dto.role === Role.ADMIN) {
      // Admin accounts are never created through self-service registration —
      // only through AdminService.createAdmin() by an existing admin, or the
      // bootstrap seed script for the very first one.
      throw new ForbiddenException('Admin accounts cannot be self-registered');
    }

    const fraudResult = await this.fraud.scoreEvent({
      type: 'register',
      email: dto.email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    if (fraudResult.decision === 'deny') {
      await this.audit.record({
        action: 'auth.register.blocked',
        metadata: { email: dto.email, reasons: fraudResult.reasons },
        correlationId: ctx.correlationId,
        ipAddress: ctx.ip,
      });
      throw new ForbiddenException('Registration blocked');
    }

    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash,
        role: dto.role ?? Role.USUARIO,
        displayName: dto.displayName ?? null,
      }),
    );

    if (user.role === Role.COMERCIO) {
      await this.merchants.save(
        this.merchants.create({
          userId: user.id,
          legalName: dto.displayName ?? dto.email,
        }),
      );
    }

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: user.role, fraudScore: fraudResult.score },
      correlationId: ctx.correlationId,
      ipAddress: ctx.ip,
    });

    await this.notifications.enqueue({
      userId: user.id,
      channel: NotificationChannelType.EMAIL,
      templateKey: 'security.account_created',
      priority: NotificationPriority.NORMAL,
    });

    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, userId: user.id };
  }

  async login(
    dto: LoginDto,
    ctx: RequestContext,
  ): Promise<(AuthTokens & { userId: string }) | { mfaRequired: true }> {
    const fraudResult = await this.fraud.scoreEvent({
      type: 'login',
      email: dto.email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    if (fraudResult.decision === 'deny') {
      await this.audit.record({
        action: 'auth.login.blocked',
        metadata: { email: dto.email, reasons: fraudResult.reasons },
        correlationId: ctx.correlationId,
        ipAddress: ctx.ip,
      });
      throw new ForbiddenException('Login temporarily blocked');
    }

    // Select mfaSecret explicitly: the entity marks it `select: false` by default.
    const user = await this.users.findOne({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    });
    const genericError = new UnauthorizedException('Invalid credentials');
    if (!user || !user.isActive) {
      throw genericError;
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw genericError;
    }

    if (user.role === Role.ADMIN) {
      if (!user.mfaEnabled) {
        // Should not be reachable: isActive only flips true once MFA enrollment
        // completes (see AuthService.confirmMfaEnrollment). Fail closed anyway.
        throw new ForbiddenException(
          'MFA enrollment incomplete for this admin account',
        );
      }
      if (!dto.mfaToken) {
        return { mfaRequired: true };
      }
      if (!this.mfa.verify(dto.mfaToken, user.mfaSecret as string)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.users.update(user.id, { lastLoginAt: new Date() });

    await this.audit.record({
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      metadata: { fraudScore: fraudResult.score },
      correlationId: ctx.correlationId,
      ipAddress: ctx.ip,
    });

    await this.notifications.enqueue({
      userId: user.id,
      channel: NotificationChannelType.EMAIL,
      templateKey: 'security.login',
      priority:
        user.role === Role.ADMIN
          ? NotificationPriority.HIGH
          : NotificationPriority.LOW,
      payload: { ip: ctx.ip, userAgent: ctx.userAgent },
    });

    const tokens = await this.issueTokens(user, ctx);
    return { ...tokens, userId: user.id };
  }

  async refresh(rawToken: string, ctx: RequestContext): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findOne({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: the presented token is single-use.
    await this.refreshTokens.update(stored.id, { revokedAt: new Date() });
    return this.issueTokens(user, ctx);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.refreshTokens.update({ tokenHash }, { revokedAt: new Date() });
  }

  async issueEnrollmentToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, purpose: 'mfa-enrollment' },
      {
        secret: this.config.get<string>('JWT_ENROLLMENT_SECRET'),
        expiresIn: '1h',
      },
    );
  }

  async resolveEnrollmentToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, {
        secret: this.config.get<string>('JWT_ENROLLMENT_SECRET'),
      });
      if (payload.purpose !== 'mfa-enrollment') {
        throw new Error('wrong token purpose');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired enrollment token');
    }
  }

  async confirmMfaEnrollment(userId: string, token: string): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, role: true, mfaSecret: true, mfaEnabled: true },
    });
    if (!user || !user.mfaSecret) {
      throw new BadRequestException(
        'No pending MFA enrollment for this account',
      );
    }
    if (!this.mfa.verify(token, user.mfaSecret)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.users.update(userId, { mfaEnabled: true, isActive: true });
  }

  private async issueTokens(
    user: User,
    ctx: RequestContext,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ip ?? null,
      }),
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
