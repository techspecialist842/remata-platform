import { User } from '../entities/user.entity';
import { Merchant } from '../entities/merchant.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { Rescate } from '../entities/rescate.entity';
import { Orden } from '../entities/orden.entity';
import { OrdenItem } from '../entities/orden-item.entity';
import { Cupon } from '../entities/cupon.entity';
import { Resena } from '../entities/resena.entity';
import { Reputacion } from '../entities/reputacion.entity';

// Single source of truth for the entity list, shared by the runtime DatabaseModule
// and the CLI DataSource used to generate/run migrations — keeps them from drifting.
export const ENTITIES = [
  // Fase 1 — identidad y transversales
  User,
  Merchant,
  RefreshToken,
  AuditLog,
  IdempotencyKey,
  Notification,
  NotificationPreference,
  // Fase 2 — marketplace
  Rescate,
  Orden,
  OrdenItem,
  Cupon,
  Resena,
  Reputacion,
];
