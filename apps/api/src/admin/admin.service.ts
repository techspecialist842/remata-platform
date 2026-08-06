import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { MfaService } from '../auth/mfa/mfa.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateAdminDto } from './dto/create-admin.dto';

const BCRYPT_ROUNDS = 12;

export interface PaginatedUsers {
  items: Array<
    Pick<
      User,
      'id' | 'email' | 'role' | 'isActive' | 'createdAt' | 'lastLoginAt'
    >
  >;
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
    private readonly audit: AuditLogService,
  ) {}

  // MFA is mandatory for admins (Fase 1 requirement): the account is created
  // inactive with a pending TOTP secret, and only flips active once the new
  // admin completes enrollment via AuthController#confirmMfaEnrollment.
  async createAdmin(
    dto: CreateAdminDto,
    createdByUserId: string,
  ): Promise<{ userId: string; otpauthUrl: string; enrollmentToken: string }> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const mfaSecret = this.mfa.generateSecret();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash,
        role: Role.ADMIN,
        displayName: dto.displayName ?? null,
        isActive: false,
        mfaEnabled: false,
        mfaSecret,
      }),
    );

    await this.audit.record({
      actorUserId: createdByUserId,
      action: 'admin.created',
      targetType: 'user',
      targetId: user.id,
      metadata: { email: user.email },
    });

    return {
      userId: user.id,
      otpauthUrl: this.mfa.buildOtpAuthUrl(user.email, mfaSecret),
      enrollmentToken: await this.auth.issueEnrollmentToken(user.id),
    };
  }

  async listUsers(page = 1, pageSize = 20): Promise<PaginatedUsers> {
    const [items, total] = await this.users.findAndCount({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async setUserActive(
    targetUserId: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<void> {
    await this.users.update(targetUserId, { isActive });
    await this.audit.record({
      actorUserId,
      action: isActive ? 'admin.user.activated' : 'admin.user.deactivated',
      targetType: 'user',
      targetId: targetUserId,
    });
  }
}
