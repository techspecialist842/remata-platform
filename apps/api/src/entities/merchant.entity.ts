import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('merchants')
// Sirve al prefiltro por caja delimitadora de la búsqueda por cercanía.
@Index('IDX_merchants_lat_lng', ['latitud', 'longitud'])
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'legal_name' })
  legalName: string;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  /** Dirección legible, la que se le enseña a quien va a retirar. */
  @Column({ type: 'varchar', nullable: true })
  direccion: string | null;

  // Punto de retiro. Nulos mientras el comercio no lo haya fijado: obligar a
  // darlo en el alta impediría registrarse a quien todavía no sabe desde dónde
  // va a despachar. Sin coordenadas el rescate sigue siendo comprable, solo que
  // no aparece en las búsquedas por cercanía.
  //
  // Se guardan como numeric, no como float: los grados decimales admiten
  // aritmética exacta y no queremos que una latitud se desplace unos metros por
  // redondeo. 9 dígitos con 6 decimales dan precisión de ~0,1 m, de sobra.
  //
  // No se usa PostGIS todavía. Habría que habilitar la extensión en RDS y
  // gestionarla en las migraciones, y para el volumen del MVP una caja
  // delimitadora indexada más haversine resuelve igual. Cuando la búsqueda
  // geográfica crezca —polígonos de cobertura, rutas—, PostGIS es el paso
  // siguiente y este esquema no lo estorba.
  @Column({
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  latitud: number | null;

  @Column({
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  longitud: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
