import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReporteMotivo } from '../common/enums/marketplace.enum';

/**
 * Denuncia de una publicación por parte de quien la ve.
 *
 * La moderación es reactiva, no previa: la publicación sale al catálogo de
 * inmediato y se retira si hay motivo. En un marketplace de comida que vence el
 * mismo día, una cola de aprobación previa mataría el producto — una oferta
 * retenida cuatro horas ya no sirve para nada.
 *
 * El reporte no oculta nada por sí solo. Solo un administrador retira, y su
 * decisión queda en la auditoría. Que el reporte no tenga efecto automático es
 * deliberado: si bastara para tumbar una oferta, tumbar competencia costaría un
 * clic.
 */
@Entity('reportes')
@Index('IDX_reportes_rescate_autor', ['rescateId', 'autorId'], { unique: true })
export class Reporte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_reportes_rescate_id')
  @Column({ name: 'rescate_id', type: 'uuid' })
  rescateId: string;

  /** Quién reportó. Único por publicación: reportar diez veces no pesa más. */
  @Column({ name: 'autor_id', type: 'uuid' })
  autorId: string;

  @Column({ type: 'enum', enum: ReporteMotivo })
  motivo: ReporteMotivo;

  @Column({ type: 'varchar', nullable: true })
  nota: string | null;

  /**
   * Cuándo lo revisó un administrador. Nulo mientras siga en la cola.
   *
   * Se marca revisado tanto si se retira la publicación como si se descarta:
   * lo que importa es que alguien lo miró, no el desenlace.
   */
  @Index('IDX_reportes_revisado_at')
  @Column({ name: 'revisado_at', type: 'timestamptz', nullable: true })
  revisadoAt: Date | null;

  @Column({ name: 'revisado_por', type: 'uuid', nullable: true })
  revisadoPor: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
