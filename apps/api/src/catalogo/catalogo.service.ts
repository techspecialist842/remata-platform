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
import { RescateStatus, RescateTipo } from '../common/enums/marketplace.enum';
import { AuditLogService } from '../audit/audit-log.service';
import { CrearRescateDto } from './dto/crear-rescate.dto';
import { BuscarRescatesDto } from './dto/buscar-rescates.dto';
import { UbicacionComercioDto } from './dto/ubicacion-comercio.dto';

/** Un grado de latitud son ~111 km en cualquier punto del planeta. */
const KM_POR_GRADO_LAT = 111.32;

/** Radio asumido cuando se pide cercanía sin decir cuánta. */
const RADIO_KM_POR_DEFECTO = 5;

/**
 * Distancia en kilómetros entre el punto buscado y el comercio.
 *
 * Haversine sobre una esfera de radio medio. El error frente al elipsoide real
 * es de hasta un 0,5%, que a 5 km son 25 metros: irrelevante para decidir si
 * una panadería queda cerca, y a cambio es una sola expresión SQL sin
 * extensiones ni dependencias.
 */
const HAVERSINE_KM = `(
  6371 * acos(
    least(1, greatest(-1,
      cos(radians(:lat)) * cos(radians(m.latitud))
        * cos(radians(m.longitud) - radians(:lng))
      + sin(radians(:lat)) * sin(radians(m.latitud))
    ))
  )
)`;

export interface PaginatedRescates {
  // La distancia solo viaja cuando se buscó por cercanía; en el resto de
  // búsquedas no existe y sería mentira devolver un cero.
  items: (Rescate | (Rescate & { distanciaKm: number }))[];
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

  /**
   * Fija la dirección y el punto de retiro.
   *
   * Sin coordenadas el comercio sigue vendiendo, solo que no aparece en las
   * búsquedas por cercanía. Por eso se permite guardar solo la dirección: es
   * mejor que la tenga escrita a que no tenga nada mientras consigue las
   * coordenadas.
   */
  async fijarUbicacion(
    userId: string,
    dto: UbicacionComercioDto,
  ): Promise<Merchant> {
    const merchant = await this.merchantDe(userId);

    const dioLat = dto.latitud !== undefined;
    const dioLng = dto.longitud !== undefined;
    if (dioLat !== dioLng) {
      throw new BadRequestException(
        'La latitud y la longitud se guardan juntas',
      );
    }

    if (dto.direccion !== undefined) merchant.direccion = dto.direccion;
    if (dioLat) {
      merchant.latitud = dto.latitud!;
      merchant.longitud = dto.longitud!;
    }

    await this.merchants.save(merchant);

    await this.audit.record({
      actorUserId: userId,
      action: 'catalogo.comercio.ubicacion',
      targetType: 'merchant',
      targetId: merchant.id,
      // Las coordenadas quedan en la auditoría: ubican un local, que es dato
      // público del comercio, y permiten reconstruir por qué apareció o dejó de
      // aparecer en una búsqueda.
      metadata: { latitud: merchant.latitud, longitud: merchant.longitud },
    });

    return merchant;
  }

  /** Resolves the merchant profile for a user, or fails if they have none. */
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
        tipo: dto.tipo ?? RescateTipo.UNITARIO,
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
    if (dto.tipo) {
      qb.andWhere('r.tipo = :tipo', { tipo: dto.tipo });
    }
    if (dto.merchantId) {
      qb.andWhere('r.merchant_id = :merchantId', {
        merchantId: dto.merchantId,
      });
    }
    if (dto.precioMaxCentavos !== undefined) {
      qb.andWhere('r.precio_centavos <= :max', { max: dto.precioMaxCentavos });
    }

    const cerca = this.puntoDeBusqueda(dto);
    if (cerca) {
      // Se une con el comercio porque el punto de retiro vive en él: un rescate
      // se recoge en el local, no en una coordenada propia.
      qb.innerJoin('merchants', 'm', 'm.id = r.merchant_id')
        .andWhere('m.latitud IS NOT NULL')
        .andWhere('m.longitud IS NOT NULL');

      // Prefiltro por caja delimitadora antes de calcular distancias. Es lo que
      // permite que el índice (latitud, longitud) haga algo: comparar rangos es
      // indexable, calcular haversine sobre cada fila no lo es.
      const gradosLat = cerca.radioKm / KM_POR_GRADO_LAT;
      const gradosLng =
        cerca.radioKm /
        (KM_POR_GRADO_LAT * Math.cos((cerca.lat * Math.PI) / 180));

      qb.andWhere('m.latitud BETWEEN :latMin AND :latMax', {
        latMin: cerca.lat - gradosLat,
        latMax: cerca.lat + gradosLat,
      }).andWhere('m.longitud BETWEEN :lngMin AND :lngMax', {
        lngMin: cerca.lng - gradosLng,
        lngMax: cerca.lng + gradosLng,
      });

      // Y ahora sí la distancia real sobre las pocas filas que quedaron. La
      // caja es un cuadrado y el radio un círculo: sin esto entrarían las
      // esquinas, hasta un 41% más lejos de lo pedido.
      qb.andWhere(`${HAVERSINE_KM} <= :radioKm`, {
        lat: cerca.lat,
        lng: cerca.lng,
        radioKm: cerca.radioKm,
      });

      qb.addSelect(HAVERSINE_KM, 'distancia_km');
    }

    // Buscando por cercanía manda la distancia; si no, vence antes lo que
    // primero caduca, que es de lo que trata esta aplicación.
    if (cerca) {
      qb.orderBy('distancia_km', 'ASC').addOrderBy('r.valido_hasta', 'ASC');
    } else {
      qb.orderBy('r.valido_hasta', 'ASC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    // getManyAndCount descartaría la distancia: no es columna de la entidad.
    // getRawAndEntities devuelve ambas cosas y se emparejan por posición.
    const total = await qb.getCount();
    if (!cerca) {
      return { items: await qb.getMany(), total, page, pageSize };
    }

    const { entities, raw } = await qb.getRawAndEntities<{
      distancia_km: string;
    }>();
    const items = entities.map((r, i) => ({
      ...r,
      distanciaKm: Math.round(Number(raw[i].distancia_km) * 100) / 100,
    }));
    return { items, total, page, pageSize };
  }

  /** Las tres coordenadas van juntas o no hay búsqueda por cercanía. */
  private puntoDeBusqueda(
    dto: BuscarRescatesDto,
  ): { lat: number; lng: number; radioKm: number } | null {
    const { lat, lng, radioKm } = dto;
    if (lat === undefined && lng === undefined && radioKm === undefined) {
      return null;
    }
    if (lat === undefined || lng === undefined) {
      throw new BadRequestException(
        'Para buscar por cercanía hacen falta lat y lng',
      );
    }
    return { lat, lng, radioKm: radioKm ?? RADIO_KM_POR_DEFECTO };
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
