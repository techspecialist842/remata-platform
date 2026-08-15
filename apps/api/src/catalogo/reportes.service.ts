import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Reporte } from '../entities/reporte.entity';
import { Rescate } from '../entities/rescate.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { ReporteMotivo } from '../common/enums/marketplace.enum';

/**
 * Moderación reactiva de publicaciones.
 *
 * Un reporte no oculta nada por sí solo: solo pone la publicación en una cola
 * que un administrador revisa. Si bastara para tumbarla, tumbar competencia
 * costaría un clic.
 */
@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Reporte)
    private readonly reportes: Repository<Reporte>,
    @InjectRepository(Rescate)
    private readonly rescates: Repository<Rescate>,
    private readonly audit: AuditLogService,
  ) {}

  async reportar(
    autorId: string,
    rescateId: string,
    motivo: ReporteMotivo,
    nota?: string,
  ): Promise<Reporte> {
    const rescate = await this.rescates.findOne({ where: { id: rescateId } });
    if (!rescate) throw new NotFoundException('Rescate no encontrado');

    const yaReporto = await this.reportes.findOne({
      where: { rescateId, autorId },
    });
    if (yaReporto) {
      throw new ConflictException('Ya reportaste esta publicación');
    }

    const reporte = await this.reportes.save(
      this.reportes.create({
        rescateId,
        autorId,
        motivo,
        nota: nota ?? null,
      }),
    );

    await this.audit.record({
      actorUserId: autorId,
      action: 'catalogo.rescate.reportado',
      targetType: 'rescate',
      targetId: rescateId,
      metadata: { motivo },
    });

    return reporte;
  }

  /**
   * La cola: publicaciones con reportes sin revisar, la más denunciada primero.
   *
   * Se agrupa por publicación en vez de listar reportes sueltos porque lo que
   * se modera es la oferta, no cada queja: diez reportes sobre lo mismo son una
   * decisión, no diez.
   */
  async cola(page = 1, pageSize = 20) {
    const filas = await this.reportes
      .createQueryBuilder('rep')
      .select('rep.rescate_id', 'rescateId')
      .addSelect('COUNT(*)::int', 'reportes')
      .addSelect('MIN(rep.created_at)', 'primerReporte')
      .where('rep.revisado_at IS NULL')
      .groupBy('rep.rescate_id')
      // Más denunciadas primero; a igualdad, las que llevan más esperando.
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('MIN(rep.created_at)', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{
        rescateId: string;
        reportes: number;
        primerReporte: Date;
      }>();

    const total = await this.reportes
      .createQueryBuilder('rep')
      .select('COUNT(DISTINCT rep.rescate_id)::int', 'n')
      .where('rep.revisado_at IS NULL')
      .getRawOne<{ n: number }>();

    if (filas.length === 0) {
      return { items: [], total: total?.n ?? 0, page, pageSize };
    }

    // Una sola consulta para todas las publicaciones de la página: pedirlas de
    // una en una dentro del bucle sería el clásico N+1.
    const rescates = await this.rescates.find({
      where: { id: In(filas.map((f) => f.rescateId)) },
    });
    const porId = new Map(rescates.map((r) => [r.id, r]));

    const motivos = await this.reportes.find({
      where: {
        rescateId: In(filas.map((f) => f.rescateId)),
        revisadoAt: IsNull(),
      },
    });

    return {
      items: filas.map((f) => ({
        rescate: porId.get(f.rescateId) ?? null,
        reportes: f.reportes,
        primerReporte: f.primerReporte,
        motivos: motivos
          .filter((m) => m.rescateId === f.rescateId)
          .map((m) => ({ motivo: m.motivo, nota: m.nota })),
      })),
      total: total?.n ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Marca revisados los reportes abiertos de una publicación.
   *
   * Se usa tanto al retirarla como al descartar la denuncia: lo que saca algo
   * de la cola es que alguien lo haya mirado, no el desenlace.
   */
  async marcarRevisados(adminId: string, rescateId: string): Promise<number> {
    const r = await this.reportes.update(
      { rescateId, revisadoAt: IsNull() },
      { revisadoAt: new Date(), revisadoPor: adminId },
    );
    return r.affected ?? 0;
  }

  async descartar(adminId: string, rescateId: string): Promise<number> {
    const n = await this.marcarRevisados(adminId, rescateId);
    if (n === 0) {
      throw new NotFoundException('No hay reportes abiertos para ese rescate');
    }

    await this.audit.record({
      actorUserId: adminId,
      action: 'admin.reporte.descartado',
      targetType: 'rescate',
      targetId: rescateId,
      metadata: { reportesCerrados: n },
    });

    return n;
  }
}
