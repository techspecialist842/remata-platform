import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reputacion } from '../entities/reputacion.entity';

export const SUJETO_MERCHANT = 'merchant';
export const SUJETO_USUARIO = 'usuario';

export interface ResumenReputacion {
  promedio: number | null;
  totalResenas: number;
  ordenesCumplidas: number;
  noShows: number;
}

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
    if (!r) {
      return {
        promedio: null,
        totalResenas: 0,
        ordenesCumplidas: 0,
        noShows: 0,
      };
    }
    return {
      promedio:
        r.totalResenas > 0
          ? Math.round((r.sumaCalificaciones / r.totalResenas) * 100) / 100
          : null,
      totalResenas: r.totalResenas,
      ordenesCumplidas: r.ordenesCumplidas,
      noShows: r.noShows,
    };
  }
}
