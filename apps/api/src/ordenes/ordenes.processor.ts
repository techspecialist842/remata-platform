import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrdenesService } from './ordenes.service';
import { CatalogoService } from '../catalogo/catalogo.service';

const INTERVALO_MS = 60_000;

// Housekeeping that keeps the catalogue honest: orders that were never
// confirmed release their reserved units, and listings past their window stop
// showing as buyable. Without this, abandoned orders would hold stock forever.
@Injectable()
export class OrdenesProcessor {
  private readonly logger = new Logger(OrdenesProcessor.name);
  private corriendo = false;

  constructor(
    private readonly ordenes: OrdenesService,
    private readonly catalogo: CatalogoService,
  ) {}

  @Interval(INTERVALO_MS)
  async tick(): Promise<void> {
    if (this.corriendo) return; // no solapar si un lote tarda más que el intervalo
    this.corriendo = true;
    try {
      const expiradas = await this.ordenes.expirarPendientes();
      const vencidos = await this.catalogo.vencerCaducados();
      if (expiradas > 0 || vencidos > 0) {
        this.logger.log(
          `Mantenimiento: ${expiradas} orden(es) expirada(s), ${vencidos} rescate(s) vencido(s)`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Fallo el mantenimiento periódico: ${(err as Error).message}`,
      );
    } finally {
      this.corriendo = false;
    }
  }
}
