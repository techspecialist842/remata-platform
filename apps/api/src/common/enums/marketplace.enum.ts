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

/**
 * Por qué alguien denuncia una publicación.
 *
 * La lista es corta a propósito: un desplegable de veinte motivos hace que
 * nadie reporte, y los que reportan eligen mal. «Otro» recoge lo demás con la
 * nota escrita a mano.
 */
export enum ReporteMotivo {
  ENGANOSO = 'enganoso', // no es lo que dice ser
  PRECIO_INCORRECTO = 'precio_incorrecto',
  INSEGURO = 'inseguro', // producto en mal estado o riesgoso
  NO_DISPONIBLE = 'no_disponible', // el comercio no lo tiene
  OTRO = 'otro',
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
