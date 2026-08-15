/**
 * Los tres tipos de oferta del MVP.
 *
 * No es decoración: cambian lo que quien compra puede esperar. En una caja
 * sorpresa el contenido es deliberadamente desconocido —esa es la gracia y
 * también el motivo de que no pueda reclamarse por «no era lo que pensaba»—, y
 * un lote de liquidación se lleva entero, no por unidades.
 */
export enum RescateTipo {
  UNITARIO = 'unitario',
  CAJA_SORPRESA = 'caja_sorpresa',
  LOTE = 'lote',
}

export enum RescateStatus {
  BORRADOR = 'borrador',
  PUBLICADO = 'publicado',
  PAUSADO = 'pausado',
  AGOTADO = 'agotado',
  VENCIDO = 'vencido',
  RETIRADO = 'retirado', // taken down by an admin during moderation
}

export enum OrdenStatus {
  CREADA = 'creada',
  CONFIRMADA = 'confirmada',
  CUMPLIDA = 'cumplida',
  CANCELADA = 'cancelada',
}

export enum CancelacionMotivo {
  COMPRADOR = 'comprador',
  COMERCIO = 'comercio',
  NO_SHOW = 'no_show', // buyer never collected — carries a reputation penalty
  EXPIRADA = 'expirada', // never confirmed within the window
  ADMIN = 'admin',
}

export enum CuponTipo {
  PORCENTAJE = 'porcentaje',
  MONTO_FIJO = 'monto_fijo',
}
