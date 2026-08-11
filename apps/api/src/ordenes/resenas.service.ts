import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resena } from '../entities/resena.entity';
import { Orden } from '../entities/orden.entity';
import { OrdenItem } from '../entities/orden-item.entity';
import { OrdenStatus } from '../common/enums/marketplace.enum';
import { ReputacionService } from './reputacion.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class ResenasService {
  constructor(
    @InjectRepository(Resena) private readonly resenas: Repository<Resena>,
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(OrdenItem) private readonly items: Repository<OrdenItem>,
    private readonly reputacion: ReputacionService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Purchase-verified: a review can only be written by the buyer of an order
   * that actually reached CUMPLIDA. That is what separates this from an open
   * rating box anyone can spam.
   */
  async crear(
    autorId: string,
    ordenId: string,
    calificacion: number,
    comentario?: string,
  ): Promise<Resena> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden || orden.compradorId !== autorId) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (orden.status !== OrdenStatus.CUMPLIDA) {
      throw new BadRequestException('Solo se puede reseñar una orden cumplida');
    }

    const yaExiste = await this.resenas.findOne({ where: { ordenId } });
    if (yaExiste) {
      throw new ConflictException('Esta orden ya tiene una reseña');
    }

    const item = await this.items.findOne({ where: { ordenId } });
    if (!item) {
      throw new BadRequestException('La orden no tiene líneas');
    }

    const resena = await this.resenas.save(
      this.resenas.create({
        ordenId,
        autorId,
        merchantId: orden.merchantId,
        rescateId: item.rescateId,
        calificacion,
        comentario: comentario ?? null,
      }),
    );

    await this.reputacion.registrarResena(orden.merchantId, calificacion);

    await this.audit.record({
      actorUserId: autorId,
      action: 'reputacion.resena.creada',
      targetType: 'resena',
      targetId: resena.id,
      metadata: { merchantId: orden.merchantId, calificacion },
    });

    return resena;
  }

  async delComercio(merchantId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.resenas.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }
}
