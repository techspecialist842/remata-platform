import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { Merchant } from '../entities/merchant.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Role } from '../common/enums/role.enum';
import { MfaService } from './mfa/mfa.service';
import { FraudService } from '../fraud/fraud.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

// Real bcrypt hash of 'password123' (cost 12), generated once and pinned so
// these tests exercise the actual bcrypt.compare path instead of mocking it.
const PASSWORD = 'password123';
const PASSWORD_HASH =
  '$2b$12$7wlUa8xuNKsG99GgmiNSVOZIn5tRZ8QPIowGDQnWiBFlvtAGsNlT6';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let fraud: { scoreEvent: jest.Mock };
  let mfa: { verify: jest.Mock };

  const ctx = { ip: '127.0.0.1', userAgent: 'jest' };

  const adminRow = {
    id: 'admin-1',
    email: 'admin@b.com',
    passwordHash: PASSWORD_HASH,
    role: Role.ADMIN,
    isActive: true,
    mfaEnabled: true,
    mfaSecret: 'SECRET',
  };

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn((u: Partial<User>) =>
        Promise.resolve({ id: 'user-1', ...u }),
      ),
      create: jest.fn((u: Partial<User>) => u),
      update: jest.fn(),
    };
    fraud = {
      scoreEvent: jest
        .fn()
        .mockResolvedValue({ score: 0, decision: 'allow', reasons: [] }),
    };
    mfa = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: getRepositoryToken(Merchant),
          useValue: { save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            save: jest.fn((t: Partial<RefreshToken>) => Promise.resolve(t)),
            create: jest.fn((t: Partial<RefreshToken>) => t),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MfaService, useValue: mfa },
        { provide: FraudService, useValue: fraud },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: NotificationsService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('rejects self-service registration as admin', async () => {
      await expect(
        service.register(
          { email: 'a@b.com', password: PASSWORD, role: Role.ADMIN },
          ctx,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate email', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.register({ email: 'taken@b.com', password: PASSWORD }, ctx),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks registration when fraud scoring denies it', async () => {
      fraud.scoreEvent.mockResolvedValueOnce({
        score: 90,
        decision: 'deny',
        reasons: ['velocity'],
      });
      await expect(
        service.register({ email: 'x@b.com', password: PASSWORD }, ctx),
      ).rejects.toThrow(ForbiddenException);
    });

    it('issues tokens for a valid new user', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.register(
        { email: 'new@b.com', password: PASSWORD },
        ctx,
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.userId).toBeDefined();
    });
  });

  describe('login', () => {
    it('rejects an unknown email with a generic error (no user enumeration)', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'ghost@b.com', password: PASSWORD }, ctx),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...adminRow,
        role: Role.USUARIO,
      });
      await expect(
        service.login(
          { email: 'admin@b.com', password: 'not-the-password' },
          ctx,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('requests MFA for an admin without a token yet', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...adminRow });

      const result = await service.login(
        { email: 'admin@b.com', password: PASSWORD },
        ctx,
      );
      expect(result).toEqual({ mfaRequired: true });
    });

    it('rejects a bad MFA code for an admin', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...adminRow });
      mfa.verify.mockReturnValueOnce(false);

      await expect(
        service.login(
          { email: 'admin@b.com', password: PASSWORD, mfaToken: '000000' },
          ctx,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens for an admin with a valid MFA code', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...adminRow });
      mfa.verify.mockReturnValueOnce(true);

      const result = await service.login(
        { email: 'admin@b.com', password: PASSWORD, mfaToken: '123456' },
        ctx,
      );
      expect(result).toHaveProperty('accessToken', 'signed.jwt.token');
    });
  });
});
