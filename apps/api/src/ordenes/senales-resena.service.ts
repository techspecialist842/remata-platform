import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import { Orden } from '../entities/orden.entity';
import { Resena } from '../entities/resena.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Merchant } from '../entities/merchant.entity';
import { User } from '../entities/user.entity';
import { OrdenStatus } from '../common/enums/marketplace.enum';

/**
 * Señales de reseña posiblemente amañada.
 *
 * ## El ataque que importa
 *
 * Las reseñas ya están verificadas por compra: para dejar una hay que comprar
 * de verdad y que el comercio entregue. Eso descarta el spam masivo — cuesta
 * dinero.
 *
 * Lo que sigue siendo barato es que **el propio comercio se compre a sí mismo**
 * desde una segunda cuenta y se ponga cinco estrellas. Pierde la comisión y
 * nada más. Ese es el ataque que estas señales buscan, no el spam.
 *
 * ## Lo que estas señales NO hacen
 *
 * **No ocultan la reseña ni la excluyen de la nota.** Solo la marcan para que
 * un administrador la mire.
 *
 * Excluir automáticamente sería peor que no hacer nada: le daría a un atacante
 * una forma de **suprimir críticas legítimas** con solo hacer que parezcan
 * sospechosas —comprar desde la misma red que el reseñador, por ejemplo—. Una
 * defensa que se puede voltear contra quien protege no es una defensa.
 *
 * ## Sobre los umbrales
 *
 * Son deliberadamente conservadores. Una señal sola casi nunca significa nada:
 * una cuenta nueva que compra una vez y queda contenta es el caso corriente de
 * un marketplace que crece. Por eso hace falta más de una para marcar.
 *
 * Con volumen real habrá que recalibrarlos mirando los falsos positivos. Están
 * aquí arriba, juntos, para poder hacerlo sin buscarlos.
 */

/** Horas entre el alta de la cuenta y su compra por debajo de las cuales llama la atención. */
const HORAS_CUENTA_NUEVA = 24;

/** Reseñas al mismo comercio en una hora a partir de las cuales es una ráfaga. */
const RESENAS_RAFAGA = 3;

/** Señales necesarias para marcar la reseña. Una sola casi nunca significa nada. */
const SENALES_PARA_MARCAR = 2;

export type SenalResena =
  | 'cuenta_nueva'
  | 'unica_compra'
  | 'solo_este_comercio'
  | 'rafaga'
  | 'misma_ip';

export interface EvaluacionResena {
  senales: SenalResena[];
  sospechosa: boolean;
}

@Injectable()
export class SenalesResenaService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Resena) private readonly resenas: Repository<Resena>,
    @InjectRepository(AuditLog)
    private readonly auditoria: Repository<AuditLog>,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async evaluar(
    autorId: string,
    merchantId: string,
    ahora = new Date(),
  ): Promise<EvaluacionResena> {
    const senales: SenalResena[] = [];

    const autor = await this.users.findOne({ where: { id: autorId } });

    // --- Cuenta creada justo antes de comprar ---
    const primeraOrden = await this.ordenes.findOne({
      where: { compradorId: autorId, merchantId },
      order: { createdAt: 'ASC' },
    });
    if (autor && primeraOrden) {
      const horas =
        (primeraOrden.createdAt.getTime() - autor.createdAt.getTime()) /
        3_600_000;
      if (horas < HORAS_CUENTA_NUEVA) senales.push('cuenta_nueva');
    }

    // --- Historial del comprador ---
    const cumplidas = await this.ordenes.count({
      where: { compradorId: autorId, status: OrdenStatus.CUMPLIDA },
    });
    if (cumplidas <= 1) {
      senales.push('unica_compra');
    } else {
      // Compra varias veces, pero siempre al mismo comercio. Un cliente fiel
      // se ve igual, y por eso esta señal sola no marca nada.
      const enOtros = await this.ordenes.count({
        where: {
          compradorId: autorId,
          status: OrdenStatus.CUMPLIDA,
          merchantId: Not(merchantId),
        },
      });
      if (enOtros === 0) senales.push('solo_este_comercio');
    }

    // --- Ráfaga de reseñas al mismo comercio ---
    const haceUnaHora = new Date(ahora.getTime() - 3_600_000);
    const recientes = await this.resenas.count({
      where: { merchantId, createdAt: MoreThan(haceUnaHora) },
    });
    if (recientes >= RESENAS_RAFAGA) senales.push('rafaga');

    // --- Comprador y comercio dados de alta desde la misma dirección ---
    //
    // Es la señal más fuerte para el ataque que importa: el comercio
    // comprándose a sí mismo. También la que más falsos positivos da —una
    // oficina, un café, una red móvil compartida—, razón de más para marcar y
    // no bloquear.
    if (await this.compartenIpDeAlta(autorId, merchantId)) {
      senales.push('misma_ip');
    }

    return {
      senales,
      sospechosa: senales.length >= SENALES_PARA_MARCAR,
    };
  }

  private async compartenIpDeAlta(
    autorId: string,
    merchantId: string,
  ): Promise<boolean> {
    const merchant = await this.merchants.findOne({
      where: { id: merchantId },
    });
    if (!merchant) return false;

    const ipDe = async (userId: string) => {
      const alta = await this.auditoria.findOne({
        where: { actorUserId: userId, action: 'auth.register' },
        order: { createdAt: 'ASC' },
      });
      return alta?.ipAddress ?? null;
    };

    const [ipAutor, ipComercio] = await Promise.all([
      ipDe(autorId),
      ipDe(merchant.userId),
    ]);

    return ipAutor !== null && ipAutor === ipComercio;
  }
}
