import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Rescate } from '../entities/rescate.entity';
import { Merchant } from '../entities/merchant.entity';
import { RescateStatus } from '../common/enums/marketplace.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { CrearRescateDto } from './dto/crear-rescate.dto';
import { BuscarRescatesDto } from './dto/buscar-rescates.dto';

export interface PaginatedRescates {
  items: Rescate[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class CatalogoService {
  constructor(
    @InjectRepository(Rescate) private readonly rescates: Repository<Rescate>,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    private readonly audit: AuditLogService,
  ) {}

  /** Resolves the merchant profile for a user, or fails if they have none. */
  /**
   * El perfil comercial de quien llama.
   *
   * Existe porque la sesión solo entrega el userId, mientras que la reputación
   * y las órdenes se indexan por merchantId. Sin esto, un comercio no tiene
   * forma de preguntar por sus propios datos.
   */
  async miComercio(userId: string): Promise<Merchant> {
    return this.merchantDe(userId);
  }

  private async merchantDe(userId: string): Promise<Merchant> {
    const merchant = await this.merchants.findOne({ where: { userId } });
    if (!merchant) {
      throw new ForbiddenException('La cuenta no tiene un perfil de comercio');
    }
    return merchant;
  }

  async crear(userId: string, dto: CrearRescateDto): Promise<Rescate> {
    const merchant = await this.merchantDe(userId);

    const desde = new Date(dto.validoDesde);
    const hasta = new Date(dto.validoHasta);
    if (hasta <= desde) {
      throw new BadRequestException(
        'validoHasta debe ser posterior a validoDesde',
      );
    }
    if (
      dto.precioOriginalCentavos !== undefined &&
      dto.precioOriginalCentavos <= dto.precioCentavos
    ) {
      throw new BadRequestException(
        'precioOriginalCentavos debe ser mayor al precio de venta',
      );
    }

    // Starts as BORRADOR: publishing is a separate, deliberate action, so a
    // half-written listing is never visible to buyers.
    const rescate = await this.rescates.save(
      this.rescates.create({
        merchantId: merchant.id,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        categoria: dto.categoria ?? null,
        precioCentavos: dto.precioCentavos,
        precioOriginalCentavos: dto.precioOriginalCentavos ?? null,
        cantidadTotal: dto.cantidadTotal,
        cantidadDisponible: dto.cantidadTotal,
        validoDesde: desde,
        validoHasta: hasta,
        status: RescateStatus.BORRADOR,
      }),
    );

    await this.audit.record({
      actorUserId: userId,
      action: 'catalogo.rescate.creado',
      targetType: 'rescate',
      targetId: rescate.id,
    });

    return rescate;
  }

  async publicar(userId: string, rescateId: string): Promise<Rescate> {
    const merchant = await this.merchantDe(userId);
    const rescate = await this.propioOFalla(rescateId, merchant.id);

    if (rescate.status === RescateStatus.RETIRADO) {
      throw new ForbiddenException(
        'Un rescate retirado por moderación no puede republicarse',
      );
    }
    if (rescate.validoHasta <= new Date()) {
      throw new BadRequestException(
        'El rescate ya venció; actualizá su vigencia',
      );
    }
    if (rescate.cantidadDisponible < 1) {
      throw new BadRequestException(
        'No hay unidades disponibles para publicar',
      );
    }

    rescate.status = RescateStatus.PUBLICADO;
    await this.rescates.save(rescate);

    await this.audit.record({
      actorUserId: userId,
      action: 'catalogo.rescate.publicado',
      targetType: 'rescate',
      targetId: rescate.id,
    });

    return rescate;
  }

  async pausar(userId: string, rescateId: string): Promise<Rescate> {
    const merchant = await this.merchantDe(userId);
    const rescate = await this.propioOFalla(rescateId, merchant.id);

    if (rescate.status !== RescateStatus.PUBLICADO) {
      throw new BadRequestException(
        'Solo se puede pausar un rescate publicado',
      );
    }

    rescate.status = RescateStatus.PAUSADO;
    await this.rescates.save(rescate);

    await this.audit.record({
      actorUserId: userId,
      action: 'catalogo.rescate.pausado',
      targetType: 'rescate',
      targetId: rescate.id,
    });

    return rescate;
  }

  /** Public catalogue: only what a buyer may actually purchase right now. */
  async buscar(dto: BuscarRescatesDto): Promise<PaginatedRescates> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const ahora = new Date();

    const qb = this.rescates
      .createQueryBuilder('r')
      .where('r.status = :status', { status: RescateStatus.PUBLICADO })
      .andWhere('r.valido_desde <= :ahora', { ahora })
      .andWhere('r.valido_hasta > :ahora', { ahora })
      .andWhere('r.cantidad_disponible > 0');

    if (dto.q) {
      qb.andWhere('r.titulo ILIKE :q', { q: `%${dto.q}%` });
    }
    if (dto.categoria) {
      qb.andWhere('r.categoria = :categoria', { categoria: dto.categoria });
    }
    if (dto.merchantId) {
      qb.andWhere('r.merchant_id = :merchantId', {
        merchantId: dto.merchantId,
      });
    }
    if (dto.precioMaxCentavos !== undefined) {
      qb.andWhere('r.precio_centavos <= :max', { max: dto.precioMaxCentavos });
    }

    const [items, total] = await qb
      .orderBy('r.valido_hasta', 'ASC') // los que vencen antes, primero
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async verPublicado(id: string): Promise<Rescate> {
    const rescate = await this.rescates.findOne({ where: { id } });
    if (!rescate || rescate.status !== RescateStatus.PUBLICADO) {
      throw new NotFoundException('Rescate no encontrado');
    }
    return rescate;
  }

  /** Everything the merchant owns, in any state — their own management view. */
  async misRescates(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedRescates> {
    const merchant = await this.merchantDe(userId);
    const [items, total] = await this.rescates.findAndCount({
      where: { merchantId: merchant.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /**
   * Marks listings whose window has closed. Status is denormalised so the
   * catalogue query stays a plain indexed filter; this keeps it truthful.
   */
  async vencerCaducados(): Promise<number> {
    const result = await this.rescates.update(
      { status: RescateStatus.PUBLICADO, validoHasta: LessThan(new Date()) },
      { status: RescateStatus.VENCIDO },
    );
    return result.affected ?? 0;
  }

  private async propioOFalla(
    rescateId: string,
    merchantId: string,
  ): Promise<Rescate> {
    const rescate = await this.rescates.findOne({ where: { id: rescateId } });
    if (!rescate) {
      throw new NotFoundException('Rescate no encontrado');
    }
    // Same response for "does not exist" and "belongs to someone else", so the
    // endpoint cannot be used to probe which listing ids are real.
    if (rescate.merchantId !== merchantId) {
      throw new NotFoundException('Rescate no encontrado');
    }
    return rescate;
  }
}
