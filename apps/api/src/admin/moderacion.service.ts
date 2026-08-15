import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rescate } from '../entities/rescate.entity';
import { Orden } from '../entities/orden.entity';
import { RescateStatus, OrdenStatus } from '../common/enums/marketplace.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { ReportesService } from '../catalogo/reportes.service';

@Injectable()
export class ModeracionService {
  constructor(
    @InjectRepository(Rescate) private readonly rescates: Repository<Rescate>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    private readonly reportes: ReportesService,
    private readonly audit: AuditLogService,
  ) {}

  /** Todos los rescates, en cualquier estado y de cualquier comercio. */
  async listarRescates(status?: RescateStatus, page = 1, pageSize = 20) {
    const [items, total] = await this.rescates.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /**
   * Takes a listing off the marketplace. RETIRADO is terminal by design: the
   * merchant cannot simply republish what moderation removed, they have to
   * create a new listing — which leaves the original decision on record.
   */
  async retirar(
    adminId: string,
    rescateId: string,
    motivo: string,
  ): Promise<Rescate> {
    const rescate = await this.rescates.findOne({ where: { id: rescateId } });
    if (!rescate) {
      throw new NotFoundException('Rescate no encontrado');
    }
    if (rescate.status === RescateStatus.RETIRADO) {
      throw new BadRequestException('El rescate ya está retirado');
    }

    rescate.status = RescateStatus.RETIRADO;
    rescate.motivoModeracion = motivo;
    await this.rescates.save(rescate);

    // Retirar resuelve la denuncia: sin esto la publicación seguiría en la cola
    // para siempre, y la cola dejaría de significar «pendiente de mirar».
    const reportesCerrados = await this.reportes.marcarRevisados(
      adminId,
      rescate.id,
    );

    await this.audit.record({
      actorUserId: adminId,
      action: 'moderacion.rescate.retirado',
      targetType: 'rescate',
      targetId: rescate.id,
      metadata: { motivo, merchantId: rescate.merchantId, reportesCerrados },
    });

    return rescate;
  }

  /** Órdenes de toda la plataforma, para soporte y resolución de incidencias. */
  async listarOrdenes(status?: OrdenStatus, page = 1, pageSize = 20) {
    const [items, total] = await this.ordenes.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async verOrden(id: string): Promise<Orden> {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }
    return orden;
  }
}
