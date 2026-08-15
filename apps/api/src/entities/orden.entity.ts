import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CancelacionMotivo,
  OrdenStatus,
} from '../common/enums/marketplace.enum';
import { OrdenItem } from './orden-item.entity';

@Entity('ordenes')
@Index(['compradorId', 'status'])
@Index(['merchantId', 'status'])
export class Orden {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Inverse side only: no column and no schema change, so no migration. Lets
  // the order lists say *what* was ordered — a merchant cannot confirm an
  // order they can only identify by number.
  @OneToMany(() => OrdenItem, (item) => item.orden)
  items: OrdenItem[];

  /** Human-facing reference, safe to read out loud or print. */
  @Index({ unique: true })
  @Column({ name: 'numero' })
  numero: string;

  /**
   * Token que se codifica en el QR de retiro.
   *
   * Se guarda su SHA-256, no el token en claro: quien consiga leer la base de
   * datos no debe poder fabricar el código que valida un retiro. El token
   * original se devuelve una sola vez, al crear la orden, y vive solo en el
   * dispositivo de quien compró.
   *
   * Es un secreto aparte del `numero` justamente porque el número está pensado
   * para decirse en voz alta y aparecer impreso.
   *
   * La validación por escaneo llega en Fase 4; esto es la emisión, que el plan
   * sitúa en Fase 2.
   */
  // select:false para que no salga en ningún listado sin pedirlo. Un hash no es
  // el secreto, pero regalarlo permite probar candidatos sin tocar la API, y no
  // hay razón para que un cliente lo vea nunca.
  @Index('IDX_ordenes_qr_token_hash', { unique: true })
  @Column({
    name: 'qr_token_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  qrTokenHash: string | null;

  /** Cuándo se usó el código. Nulo mientras no se haya retirado. */
  @Column({ name: 'qr_usado_at', type: 'timestamptz', nullable: true })
  qrUsadoAt: Date | null;

  @Index()
  @Column({ name: 'comprador_id', type: 'uuid' })
  compradorId: string;

  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'enum', enum: OrdenStatus, default: OrdenStatus.CREADA })
  status: OrdenStatus;

  // --- Money, all in minor units. Recomputed nowhere: these are the amounts
  // agreed at purchase time and must not drift if prices or coupons change.
  @Column({ name: 'subtotal_centavos', type: 'integer' })
  subtotalCentavos: number;

  @Column({ name: 'descuento_centavos', type: 'integer', default: 0 })
  descuentoCentavos: number;

  @Column({ name: 'total_centavos', type: 'integer' })
  totalCentavos: number;

  @Column({ length: 3, default: 'USD' })
  moneda: string;

  @Column({ name: 'cupon_id', type: 'uuid', nullable: true })
  cuponId: string | null;

  /** Coupon code as typed at purchase time, kept even if the coupon is later deleted. */
  @Column({ name: 'cupon_codigo', type: 'varchar', nullable: true })
  cuponCodigo: string | null;

  // --- Lifecycle timestamps. Each transition stamps its own; absence means the
  // transition never happened, which is more honest than a single mutable field.
  @Column({ name: 'confirmada_at', type: 'timestamptz', nullable: true })
  confirmadaAt: Date | null;

  @Column({ name: 'cumplida_at', type: 'timestamptz', nullable: true })
  cumplidaAt: Date | null;

  @Column({ name: 'cancelada_at', type: 'timestamptz', nullable: true })
  canceladaAt: Date | null;

  @Column({
    name: 'cancelacion_motivo',
    type: 'enum',
    enum: CancelacionMotivo,
    nullable: true,
  })
  cancelacionMotivo: CancelacionMotivo | null;

  @Column({ name: 'cancelacion_nota', type: 'varchar', nullable: true })
  cancelacionNota: string | null;

  /** After this instant an unconfirmed order is cancelled automatically. */
  @Column({ name: 'expira_at', type: 'timestamptz' })
  expiraAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
