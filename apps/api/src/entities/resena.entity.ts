import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Purchase-verified reviews: one per fulfilled order, enforced by the unique
// index on ordenId. A review cannot exist without an order that reached
// CUMPLIDA, which is what makes the rating trustworthy.
@Entity('resenas')
export class Resena {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @Index()
  @Column({ name: 'autor_id', type: 'uuid' })
  autorId: string;

  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'rescate_id', type: 'uuid' })
  rescateId: string;

  /** 1 to 5. Enforced in the DTO and by a check constraint in the migration. */
  @Column({ type: 'smallint' })
  calificacion: number;

  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
