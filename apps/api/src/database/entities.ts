import { User } from '../entities/user.entity';
import { Merchant } from '../entities/merchant.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';

// Single source of truth for the entity list, shared by the runtime DatabaseModule
// and the CLI DataSource used to generate/run migrations — keeps them from drifting.
export const ENTITIES = [
  User,
  Merchant,
  RefreshToken,
  AuditLog,
  IdempotencyKey,
  Notification,
  NotificationPreference,
];
