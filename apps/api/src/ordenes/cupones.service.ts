import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cupon } from '../entities/cupon.entity';
import { CuponTipo } from '../common/enums/marketplace.enum';

export interface DescuentoAplicado {
  cupon: Cupon;
  descuentoCentavos: number;
}

@Injectable()
export class CuponesService {
  constructor(
    @InjectRepository(Cupon) private readonly cupones: Repository<Cupon>,
  ) {}

  /**
   * Validates a coupon against an order subtotal and returns the discount in
   * minor units. Purely arithmetic — reserving the redemption is a separate
   * step (`consumir`) that runs inside the order transaction.
   */
  async calcular(
    codigo: string,
    subtotalCentavos: number,
    merchantId: string,
  ): Promise<DescuentoAplicado> {
    const cupon = await this.cupones.findOne({
      where: { codigo: codigo.trim().toUpperCase() },
    });
    if (!cupon || !cupon.activo) {
      throw new NotFoundException('Cupón inválido');
    }

    const ahora = new Date();
    if (cupon.validoDesde > ahora || cupon.validoHasta <= ahora) {
      throw new BadRequestException('El cupón no está vigente');
    }
    if (cupon.merchantId && cupon.merchantId !== merchantId) {
      throw new BadRequestException('El cupón no aplica a este comercio');
    }
    if (cupon.maxUsos !== null && cupon.usos >= cupon.maxUsos) {
      throw new BadRequestException('El cupón alcanzó su límite de usos');
    }
    if (subtotalCentavos < cupon.minimoOrdenCentavos) {
      throw new BadRequestException(
        `El cupón requiere un mínimo de ${cupon.minimoOrdenCentavos} centavos`,
      );
    }

    const descuentoCentavos = this.montoDescuento(cupon, subtotalCentavos);
    return { cupon, descuentoCentavos };
  }

  private montoDescuento(cupon: Cupon, subtotalCentavos: number): number {
    if (cupon.tipo === CuponTipo.PORCENTAJE) {
      // Math.floor: el redondeo siempre favorece a la plataforma sobre el
      // centavo fraccionario, y nunca produce un descuento mayor al debido.
      return Math.floor((subtotalCentavos * cupon.valor) / 100);
    }
    // Un cupón de monto fijo nunca puede dejar el total por debajo de cero.
    return Math.min(cupon.valor, subtotalCentavos);
  }

  /**
   * Increments the redemption counter, refusing to exceed the cap. Runs inside
   * the caller's transaction: a conditional UPDATE, so two concurrent orders
   * cannot both claim the last remaining use.
   */
  async consumir(manager: EntityManager, cuponId: string): Promise<void> {
    const resultado = await manager
      .createQueryBuilder()
      .update(Cupon)
      .set({ usos: () => '"usos" + 1' })
      .where('id = :id', { id: cuponId })
      .andWhere('activo = true')
      .andWhere('(max_usos IS NULL OR usos < max_usos)')
      .execute();

    if (!resultado.affected) {
      throw new BadRequestException('El cupón dejó de estar disponible');
    }
  }

  /** Returns a redemption when an order is cancelled. */
  async devolver(manager: EntityManager, cuponId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Cupon)
      .set({ usos: () => 'GREATEST("usos" - 1, 0)' })
      .where('id = :id', { id: cuponId })
      .execute();
  }
}
