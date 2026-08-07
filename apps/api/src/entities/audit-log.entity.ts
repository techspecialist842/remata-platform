import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Immutable by convention: no service in this codebase issues UPDATE or DELETE
// against this table. Rows are append-only audit evidence (Fase 1 acceptance
// criteria: "logging de auditoría básico (inmutable)").
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'varchar', nullable: true })
  actorUserId: string | null;

  @Index()
  @Column()
  action: string;

  @Column({ name: 'target_type', type: 'varchar', nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'correlation_id', type: 'varchar', nullable: true })
  correlationId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
