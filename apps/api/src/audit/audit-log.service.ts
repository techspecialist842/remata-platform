import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface RecordAuditInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  // Append-only: this is the ONLY write path into audit_logs. No update()/delete()
  // methods exist on this service by design (see AuditLog entity for the invariant).
  async record(input: RecordAuditInput): Promise<void> {
    const entry = this.repo.create({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    await this.repo.save(entry);
  }
}
