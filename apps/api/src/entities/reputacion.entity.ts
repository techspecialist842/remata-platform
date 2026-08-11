import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Derived projection, not a source of truth: every field here is recomputable
// from ordenes and resenas. It exists so listing a merchant does not require
// aggregating their whole order history on every request.
//
// The same shape covers buyers and merchants — a buyer's "reputation" is their
// no-show record, which is what a merchant needs to see before confirming.
@Entity('reputaciones')
export class Reputacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 'merchant' or 'usuario' — who this reputation belongs to. */
  @Column({ name: 'sujeto_tipo' })
  sujetoTipo: string;

  @Index({ unique: true })
  @Column({ name: 'sujeto_id', type: 'uuid' })
  sujetoId: string;

  /** Sum of ratings, kept alongside the count so the average stays exact. */
  @Column({ name: 'suma_calificaciones', type: 'integer', default: 0 })
  sumaCalificaciones: number;

  @Column({ name: 'total_resenas', type: 'integer', default: 0 })
  totalResenas: number;

  @Column({ name: 'ordenes_cumplidas', type: 'integer', default: 0 })
  ordenesCumplidas: number;

  @Column({ name: 'no_shows', type: 'integer', default: 0 })
  noShows: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
