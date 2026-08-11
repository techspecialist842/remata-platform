import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CuponTipo } from '../common/enums/marketplace.enum';

@Entity('cupones')
export class Cupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stored uppercased; lookups normalise the input the same way. */
  @Index({ unique: true })
  @Column()
  codigo: string;

  @Column({ type: 'enum', enum: CuponTipo })
  tipo: CuponTipo;

  /**
   * For PORCENTAJE: whole percent (10 = 10% off).
   * For MONTO_FIJO: minor units to subtract.
   * One integer column for both so there is no float anywhere in the money path.
   */
  @Column({ type: 'integer' })
  valor: number;

  @Column({ length: 3, default: 'USD' })
  moneda: string;

  /** null = applies platform-wide; set = restricted to that merchant. */
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId: string | null;

  @Column({ name: 'minimo_orden_centavos', type: 'integer', default: 0 })
  minimoOrdenCentavos: number;

  @Column({ name: 'valido_desde', type: 'timestamptz' })
  validoDesde: Date;

  @Column({ name: 'valido_hasta', type: 'timestamptz' })
  validoHasta: Date;

  /** null = unlimited. */
  @Column({ name: 'max_usos', type: 'integer', nullable: true })
  maxUsos: number | null;

  @Column({ name: 'usos', type: 'integer', default: 0 })
  usos: number;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
