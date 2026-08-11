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
