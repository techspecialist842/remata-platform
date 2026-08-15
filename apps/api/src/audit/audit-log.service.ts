import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
  //
  // [manager] DEBE pasarse cuando se llama desde dentro de una transacción.
  // Sin él esta escritura pide una segunda conexión del pool mientras la
  // transacción ya retiene la primera —y el bloqueo de fila—; con tantas
  // peticiones concurrentes como conexiones tenga el pool, todas quedan
  // esperando una conexión que nadie puede liberar. Se manifiesta solo bajo
  // carga, que es cuando peor viene.
  async record(
    input: RecordAuditInput,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    const entry = repo.create({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    await repo.save(entry);
  }
}
