import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Orden } from './orden.entity';

// Separate table from the first day even though v1 allows a single rescate per
// order (see the plan's "un rescate por orden" recommendation). Adding it later
// would mean migrating live orders; the constraint is enforced in the service,
// not baked into the schema.
//
// Every field is a snapshot taken at purchase time. The listing can change its
// price, sell out or expire afterwards, and the order must still reflect what
// was actually agreed.
@Entity('orden_items')
export class OrdenItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Orden, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Index()
  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId: string;

  @Index()
  @Column({ name: 'rescate_id', type: 'uuid' })
  rescateId: string;

  @Column({ name: 'titulo_snapshot' })
  tituloSnapshot: string;

  @Column({ name: 'precio_unitario_centavos', type: 'integer' })
  precioUnitarioCentavos: number;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ name: 'total_linea_centavos', type: 'integer' })
  totalLineaCentavos: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
