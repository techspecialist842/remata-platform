import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Orden } from '../entities/orden.entity';
import { OrdenItem } from '../entities/orden-item.entity';
import { Rescate } from '../entities/rescate.entity';
import { Merchant } from '../entities/merchant.entity';
import {
  CancelacionMotivo,
  OrdenStatus,
  RescateStatus,
} from '../common/enums/marketplace.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationChannelType,
  NotificationPriority,
} from '../entities/notification.entity';
import { CuponesService } from './cupones.service';
import { ReputacionService } from './reputacion.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';

/** Minutes a buyer has to be confirmed by the merchant before the order lapses. */
const VENTANA_CONFIRMACION_MIN = 30;

// Allowed transitions. Everything not listed here is rejected, so an invalid
// move fails loudly instead of silently corrupting an order's history.
const TRANSICIONES: Record<OrdenStatus, OrdenStatus[]> = {
  [OrdenStatus.CREADA]: [OrdenStatus.CONFIRMADA, OrdenStatus.CANCELADA],
  [OrdenStatus.CONFIRMADA]: [OrdenStatus.CUMPLIDA, OrdenStatus.CANCELADA],
  [OrdenStatus.CUMPLIDA]: [],
  [OrdenStatus.CANCELADA]: [],
};

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    private readonly dataSource: DataSource,
    private readonly cupones: CuponesService,
    private readonly reputacion: ReputacionService,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async crear(compradorId: string, dto: CrearOrdenDto): Promise<Orden> {
    return this.dataSource.transaction(async (manager) => {
      const rescate = await manager.findOne(Rescate, {
        where: { id: dto.rescateId },
      });
      if (!rescate) {
        throw new NotFoundException('Rescate no encontrado');
      }

      const ahora = new Date();
      if (
        rescate.status !== RescateStatus.PUBLICADO ||
        rescate.validoDesde > ahora ||
        rescate.validoHasta <= ahora
      ) {
        throw new BadRequestException(
          'El rescate no está disponible para compra',
        );
      }

      // Reserva atómica. Un SELECT seguido de UPDATE permitiría que dos
      // compradores simultáneos leyeran la misma disponibilidad y ambos
      // pasaran; la condición va dentro del propio UPDATE para que sea la base
      // de datos quien arbitre. affected = 0 significa que otro ganó la carrera.
      const reserva = await manager
        .createQueryBuilder()
        .update(Rescate)
        .set({ cantidadDisponible: () => '"cantidad_disponible" - :n' })
        .where('id = :id', { id: rescate.id })
        .andWhere('cantidad_disponible >= :n')
        .andWhere('status = :status', { status: RescateStatus.PUBLICADO })
        .setParameter('n', dto.cantidad)
        .execute();

      if (!reserva.affected) {
        throw new ConflictException('No hay unidades suficientes disponibles');
      }

      const subtotalCentavos = rescate.precioCentavos * dto.cantidad;

      let descuentoCentavos = 0;
      let cuponId: string | null = null;
      let cuponCodigo: string | null = null;
      if (dto.cuponCodigo) {
        const aplicado = await this.cupones.calcular(
          dto.cuponCodigo,
          subtotalCentavos,
          rescate.merchantId,
        );
        await this.cupones.consumir(manager, aplicado.cupon.id);
        descuentoCentavos = aplicado.descuentoCentavos;
        cuponId = aplicado.cupon.id;
        cuponCodigo = aplicado.cupon.codigo;
      }

      const expiraAt = new Date(
        ahora.getTime() + VENTANA_CONFIRMACION_MIN * 60_000,
      );

      const orden = await manager.save(
        manager.create(Orden, {
          numero: this.generarNumero(),
          compradorId,
          merchantId: rescate.merchantId,
          status: OrdenStatus.CREADA,
          subtotalCentavos,
          descuentoCentavos,
          totalCentavos: subtotalCentavos - descuentoCentavos,
          moneda: rescate.moneda,
          cuponId,
          cuponCodigo,
          expiraAt,
        }),
      );

      // Copia de los datos al momento de la compra: el rescate puede cambiar de
      // precio, agotarse o vencer después, y la orden debe seguir reflejando lo
      // que efectivamente se acordó.
      await manager.save(
        manager.create(OrdenItem, {
          ordenId: orden.id,
          rescateId: rescate.id,
          tituloSnapshot: rescate.titulo,
          precioUnitarioCentavos: rescate.precioCentavos,
          cantidad: dto.cantidad,
          totalLineaCentavos: subtotalCentavos,
        }),
      );

      // Si la reserva dejó el rescate sin unidades, sale del catálogo.
      await manager
        .createQueryBuilder()
        .update(Rescate)
        .set({ status: RescateStatus.AGOTADO })
        .where('id = :id', { id: rescate.id })
        .andWhere('cantidad_disponible = 0')
        .andWhere('status = :publicado', { publicado: RescateStatus.PUBLICADO })
        .execute();

      await this.audit.record({
        actorUserId: compradorId,
        action: 'ordenes.orden.creada',
        targetType: 'orden',
        targetId: orden.id,
        metadata: { rescateId: rescate.id, totalCentavos: orden.totalCentavos },
      });

      await this.notifications.enqueue({
        userId: compradorId,
        channel: NotificationChannelType.EMAIL,
        templateKey: 'ordenes.creada',
        priority: NotificationPriority.NORMAL,
        payload: { numero: orden.numero, expiraAt: expiraAt.toISOString() },
      });

      return orden;
    });
  }

  async confirmar(userId: string, ordenId: string): Promise<Orden> {
    const merchant = await this.merchantDe(userId);
    const orden = await this.delComercioOFalla(ordenId, merchant.id);
    this.verificarTransicion(orden.status, OrdenStatus.CONFIRMADA);

    if (orden.expiraAt <= new Date()) {
      throw new BadRequestException(
        'La orden expiró y ya no puede confirmarse',
      );
    }

    orden.status = OrdenStatus.CONFIRMADA;
    orden.confirmadaAt = new Date();
    await this.ordenes.save(orden);

    await this.audit.record({
      actorUserId: userId,
      action: 'ordenes.orden.confirmada',
      targetType: 'orden',
      targetId: orden.id,
    });

    await this.notifications.enqueue({
      userId: orden.compradorId,
      channel: NotificationChannelType.EMAIL,
      templateKey: 'ordenes.confirmada',
      priority: NotificationPriority.HIGH,
      payload: { numero: orden.numero },
    });

    return orden;
  }

  async cumplir(userId: string, ordenId: string): Promise<Orden> {
    const merchant = await this.merchantDe(userId);
    const orden = await this.delComercioOFalla(ordenId, merchant.id);
    this.verificarTransicion(orden.status, OrdenStatus.CUMPLIDA);

    orden.status = OrdenStatus.CUMPLIDA;
    orden.cumplidaAt = new Date();
    await this.ordenes.save(orden);

    // El inventario NO se devuelve: la mercadería se entregó.
    await this.reputacion.registrarCumplida(
      orden.merchantId,
      orden.compradorId,
    );

    await this.audit.record({
      actorUserId: userId,
      action: 'ordenes.orden.cumplida',
      targetType: 'orden',
      targetId: orden.id,
    });

    await this.notifications.enqueue({
      userId: orden.compradorId,
      channel: NotificationChannelType.EMAIL,
      templateKey: 'ordenes.cumplida',
      priority: NotificationPriority.NORMAL,
      payload: { numero: orden.numero },
    });

    return orden;
  }

  async cancelar(
    userId: string,
    ordenId: string,
    motivo: CancelacionMotivo,
    nota?: string,
  ): Promise<Orden> {
    return this.dataSource.transaction(async (manager) => {
      const orden = await manager.findOne(Orden, { where: { id: ordenId } });
      if (!orden) {
        throw new NotFoundException('Orden no encontrada');
      }

      // El comprador solo puede cancelar la suya; el comercio, las que recibe.
      const merchant = await manager.findOne(Merchant, { where: { userId } });
      const esComprador = orden.compradorId === userId;
      const esComercio = merchant?.id === orden.merchantId;
      if (!esComprador && !esComercio) {
        throw new NotFoundException('Orden no encontrada');
      }
      if (esComprador && motivo === CancelacionMotivo.NO_SHOW) {
        throw new ForbiddenException('El comprador no puede marcar no-show');
      }

      this.verificarTransicion(orden.status, OrdenStatus.CANCELADA);

      await this.liberar(manager, orden, motivo, nota ?? null);

      await this.audit.record({
        actorUserId: userId,
        action: 'ordenes.orden.cancelada',
        targetType: 'orden',
        targetId: orden.id,
        metadata: { motivo },
      });

      await this.notifications.enqueue({
        userId: esComprador ? orden.merchantId : orden.compradorId,
        channel: NotificationChannelType.EMAIL,
        templateKey: 'ordenes.cancelada',
        priority: NotificationPriority.HIGH,
        payload: { numero: orden.numero, motivo },
      });

      return orden;
    });
  }

  /**
   * Cancels orders never confirmed within their window, returning the reserved
   * units to the catalogue. Without this, an abandoned order would hold stock
   * hostage indefinitely.
   */
  async expirarPendientes(): Promise<number> {
    const vencidas = await this.ordenes.find({
      where: { status: OrdenStatus.CREADA, expiraAt: LessThan(new Date()) },
      take: 100,
    });

    for (const orden of vencidas) {
      await this.dataSource.transaction(async (manager) => {
        await this.liberar(manager, orden, CancelacionMotivo.EXPIRADA, null);
      });
      await this.audit.record({
        action: 'ordenes.orden.expirada',
        targetType: 'orden',
        targetId: orden.id,
      });
    }
    return vencidas.length;
  }

  // Ambos listados cargan sus líneas: una orden identificada solo por número no
  // le sirve a nadie. El comercio necesita saber qué debe preparar y quien
  // compró, qué reservó. El título viaja como copia tomada en la compra, así
  // que sigue siendo fiel aunque la publicación cambie después.
  async misOrdenes(compradorId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.ordenes.findAndCount({
      where: { compradorId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async ordenesDelComercio(userId: string, page = 1, pageSize = 20) {
    const merchant = await this.merchantDe(userId);
    const [items, total] = await this.ordenes.findAndCount({
      where: { merchantId: merchant.id },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  // --- internos ---

  /** Shared cancellation path: restores stock, returns the coupon, stamps the order. */
  private async liberar(
    manager: EntityManager,
    orden: Orden,
    motivo: CancelacionMotivo,
    nota: string | null,
  ): Promise<void> {
    const items = await manager.find(OrdenItem, {
      where: { ordenId: orden.id },
    });

    for (const item of items) {
      await manager
        .createQueryBuilder()
        .update(Rescate)
        .set({ cantidadDisponible: () => '"cantidad_disponible" + :n' })
        .where('id = :id', { id: item.rescateId })
        .setParameter('n', item.cantidad)
        .execute();

      // Si había quedado agotado y todavía está vigente, vuelve al catálogo.
      await manager
        .createQueryBuilder()
        .update(Rescate)
        .set({ status: RescateStatus.PUBLICADO })
        .where('id = :id', { id: item.rescateId })
        .andWhere('status = :agotado', { agotado: RescateStatus.AGOTADO })
        .andWhere('valido_hasta > NOW()')
        .execute();
    }

    if (orden.cuponId) {
      await this.cupones.devolver(manager, orden.cuponId);
    }

    orden.status = OrdenStatus.CANCELADA;
    orden.canceladaAt = new Date();
    orden.cancelacionMotivo = motivo;
    orden.cancelacionNota = nota;
    await manager.save(orden);

    if (motivo === CancelacionMotivo.NO_SHOW) {
      await this.reputacion.registrarNoShow(orden.compradorId);
    }
  }

  private verificarTransicion(desde: OrdenStatus, hacia: OrdenStatus): void {
    if (!TRANSICIONES[desde].includes(hacia)) {
      throw new BadRequestException(
        `Transición inválida: una orden ${desde} no puede pasar a ${hacia}`,
      );
    }
  }

  private async merchantDe(userId: string): Promise<Merchant> {
    const merchant = await this.merchants.findOne({ where: { userId } });
    if (!merchant) {
      throw new ForbiddenException('La cuenta no tiene un perfil de comercio');
    }
    return merchant;
  }

  private async delComercioOFalla(
    ordenId: string,
    merchantId: string,
  ): Promise<Orden> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    // Misma respuesta para "no existe" y "es de otro comercio", para que el
    // endpoint no sirva para descubrir identificadores de órdenes ajenas.
    if (!orden || orden.merchantId !== merchantId) {
      throw new NotFoundException('Orden no encontrada');
    }
    return orden;
  }

  /** Human-readable and hard to guess: R-YYMMDD-XXXXXXXX. */
  private generarNumero(): string {
    const f = new Date();
    const fecha =
      String(f.getUTCFullYear()).slice(2) +
      String(f.getUTCMonth() + 1).padStart(2, '0') +
      String(f.getUTCDate()).padStart(2, '0');
    const sufijo = crypto
      .randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .slice(0, 8);
    return `R-${fecha}-${sufijo}`;
  }
}
