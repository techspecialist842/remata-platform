import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Merchant } from './merchant.entity';
import { RescateStatus, RescateTipo } from '../common/enums/marketplace.enum';

// A "rescate" is a merchant's time-limited offer: surplus stock sold at a
// discount within a window. Money is stored as integer minor units plus a
// currency code — never floating point (see CANONICAL_DATA_EVENT_MODEL).
@Entity('rescates')
@Index(['status', 'validoHasta'])
export class Rescate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column()
  titulo: string;

  /**
   * Qué clase de oferta es.
   *
   * Por defecto unitario, que es lo que ya existía: las publicaciones creadas
   * antes de este campo son artículos sueltos, y ese default las deja
   * correctamente clasificadas sin tener que tocarlas.
   */
  @Column({ type: 'enum', enum: RescateTipo, default: RescateTipo.UNITARIO })
  tipo: RescateTipo;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  categoria: string | null;

  /** Selling price in minor units (e.g. cents). */
  @Column({ name: 'precio_centavos', type: 'integer' })
  precioCentavos: number;

  /** Reference price before the discount, for display. */
  @Column({ name: 'precio_original_centavos', type: 'integer', nullable: true })
  precioOriginalCentavos: number | null;

  @Column({ length: 3, default: 'USD' })
  moneda: string;

  @Column({ name: 'cantidad_total', type: 'integer' })
  cantidadTotal: number;

  // Decremented when an order reserves units, restored on cancellation. Kept
  // as a column rather than derived from orders so the catalogue can filter on
  // availability without aggregating.
  @Column({ name: 'cantidad_disponible', type: 'integer' })
  cantidadDisponible: number;

  @Column({ name: 'valido_desde', type: 'timestamptz' })
  validoDesde: Date;

  @Column({ name: 'valido_hasta', type: 'timestamptz' })
  validoHasta: Date;

  @Column({
    type: 'enum',
    enum: RescateStatus,
    default: RescateStatus.BORRADOR,
  })
  status: RescateStatus;

  /** Set when an admin takes the listing down; shown to the merchant. */
  @Column({ name: 'motivo_moderacion', type: 'varchar', nullable: true })
  motivoModeracion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
