import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reputacion } from '../entities/reputacion.entity';

export const SUJETO_MERCHANT = 'merchant';
export const SUJETO_USUARIO = 'usuario';

export interface ResumenReputacion {
  /** Media aritmética de las calificaciones. Nula mientras no haya ninguna. */
  promedio: number | null;
  /**
   * Nota ponderada, la que sirve para comparar y ordenar.
   *
   * Media bayesiana: la nota de cada comercio se mezcla con la media de la
   * plataforma, con un peso equivalente a [VOTOS_PREVIOS] reseñas. Sin esto,
   * un comercio con un único 5 supera a otro con doscientas reseñas y 4,8, que
   * es exactamente al revés de lo que dice la evidencia.
   *
   * El efecto se disuelve solo: a las cien reseñas, el prior pesa menos del 5%.
   */
  promedioPonderado: number | null;
  totalResenas: number;
  ordenesCumplidas: number;
  noShows: number;
}

/**
 * Cuántas reseñas «de la casa» pesan frente a las reales.
 *
 * Cinco es deliberadamente bajo: suficiente para que una sola opinión no
 * dispare la nota, y no tanto como para que un comercio bueno tarde meses en
 * demostrarlo.
 */
const VOTOS_PREVIOS = 5;

/**
 * Nota que se asume mientras no hay historia.
 *
 * 4,0 y no 3,0: quien publica excedente para no tirarlo suele cumplir, y
 * arrancar a todo el mundo en el medio de la escala castiga al comercio nuevo
 * sin que nadie se haya quejado. Es el punto de partida, no una nota regalada:
 * dos reseñas malas lo bajan enseguida.
 */
const NOTA_PREVIA = 4.0;

@Injectable()
export class ReputacionService {
  constructor(
    @InjectRepository(Reputacion)
    private readonly reputaciones: Repository<Reputacion>,
  ) {}

  /**
   * All counters move through this one path. Uses an UPSERT with SQL-side
   * increments rather than read-modify-write, so concurrent orders for the same
   * merchant cannot lose an update.
   */
  private async incrementar(
    sujetoTipo: string,
    sujetoId: string,
    campos: Partial<
      Record<
        'sumaCalificaciones' | 'totalResenas' | 'ordenesCumplidas' | 'noShows',
        number
      >
    >,
  ): Promise<void> {
    const columnas: Record<string, string> = {
      sumaCalificaciones: 'suma_calificaciones',
      totalResenas: 'total_resenas',
      ordenesCumplidas: 'ordenes_cumplidas',
      noShows: 'no_shows',
    };

    const entradas = Object.entries(campos).filter(([, v]) => v !== undefined);
    if (entradas.length === 0) return;

    const sets = entradas
      .map(
        ([campo]) =>
          `${columnas[campo]} = "reputaciones".${columnas[campo]} + EXCLUDED.${columnas[campo]}`,
      )
      .join(', ');

    const cols = entradas.map(([campo]) => columnas[campo]);
    const valores = entradas.map(([, v]) => v);

    await this.reputaciones.query(
      `INSERT INTO "reputaciones" (sujeto_tipo, sujeto_id, ${cols.join(', ')}, updated_at)
       VALUES ($1, $2, ${valores.map((_, i) => `$${i + 3}`).join(', ')}, NOW())
       ON CONFLICT (sujeto_id) DO UPDATE SET ${sets}, updated_at = NOW()`,
      [sujetoTipo, sujetoId, ...valores],
    );
  }

  async registrarCumplida(
    merchantId: string,
    compradorId: string,
  ): Promise<void> {
    await this.incrementar(SUJETO_MERCHANT, merchantId, {
      ordenesCumplidas: 1,
    });
    await this.incrementar(SUJETO_USUARIO, compradorId, {
      ordenesCumplidas: 1,
    });
  }

  /**
   * Recorded against the buyer only. A no-show is the buyer failing to collect;
   * penalising the merchant for it would invert the incentive and let a buyer
   * damage a merchant's standing at will.
   */
  async registrarNoShow(compradorId: string): Promise<void> {
    await this.incrementar(SUJETO_USUARIO, compradorId, { noShows: 1 });
  }

  async registrarResena(
    merchantId: string,
    calificacion: number,
  ): Promise<void> {
    await this.incrementar(SUJETO_MERCHANT, merchantId, {
      sumaCalificaciones: calificacion,
      totalResenas: 1,
    });
  }

  async resumen(sujetoId: string): Promise<ResumenReputacion> {
    const r = await this.reputaciones.findOne({ where: { sujetoId } });
    if (!r || r.totalResenas === 0) {
      // Sin reseñas no hay nota. Devolver la previa como si fuera suya sería
      // atribuirle una opinión que nadie ha dado.
      return {
        promedio: null,
        promedioPonderado: null,
        totalResenas: 0,
        ordenesCumplidas: r?.ordenesCumplidas ?? 0,
        noShows: r?.noShows ?? 0,
      };
    }

    const ponderado =
      (NOTA_PREVIA * VOTOS_PREVIOS + r.sumaCalificaciones) /
      (VOTOS_PREVIOS + r.totalResenas);

    return {
      promedio: redondear2(r.sumaCalificaciones / r.totalResenas),
      promedioPonderado: redondear2(ponderado),
      totalResenas: r.totalResenas,
      ordenesCumplidas: r.ordenesCumplidas,
      noShows: r.noShows,
    };
  }
}

/** Dos decimales: más precisión sería fingir que la escala los sostiene. */
function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}
