/**
 * Precio que baja solo conforme se acerca el vencimiento.
 *
 * ## La decisión de producto
 *
 * Es **opcional**: solo se aplica si el comercio fija un suelo. Quien no lo
 * fije vende siempre al mismo precio. Que el precio de alguien baje sin que lo
 * haya pedido sería una sorpresa desagradable.
 *
 * Baja **por tramos, no de forma continua**. Un precio que cambia cada minuto
 * es difícil de anunciar en un mostrador, imposible de comprobar para quien
 * compra, y convierte la decisión en un juego de esperar. Tres tramos se
 * entienden y se comunican:
 *
 * | Tiempo restante | Precio |
 * |---|---|
 * | Más de la mitad de la ventana | El que fijó el comercio |
 * | Entre la mitad y un cuarto | A mitad de camino hacia el suelo |
 * | Menos de un cuarto | El suelo |
 *
 * Los tramos van sobre el **porcentaje de ventana consumido**, no sobre horas
 * fijas: una oferta de dos horas y otra de dos días necesitan ritmos distintos,
 * y una regla en horas trataría igual lo que no lo es.
 *
 * ## Lo que esto no resuelve
 *
 * Bajar el precio con el tiempo incentiva a esperar. Lo que lo contrarresta es
 * que el inventario es limitado: quien espera puede quedarse sin nada. Si en la
 * práctica se ve que la gente espera sistemáticamente al último tramo, la regla
 * habrá que revisarla con datos — no antes.
 *
 * ## Supuesto pendiente de confirmar
 *
 * Los umbrales (50% y 25%) y el escalón intermedio (mitad de camino) son una
 * propuesta razonable, no una decisión del cliente. Están aquí en un solo sitio
 * justamente para poder cambiarlos sin tocar nada más.
 */

/** Fracción de ventana restante por debajo de la cual empieza el descuento. */
const TRAMO_MEDIO = 0.5;

/** Fracción por debajo de la cual se aplica el suelo. */
const TRAMO_FINAL = 0.25;

export interface RescateConPrecio {
  precioCentavos: number;
  precioMinimoCentavos: number | null;
  validoDesde: Date;
  validoHasta: Date;
}

/**
 * Precio al que se vende ahora mismo.
 *
 * Devuelve siempre un entero de centavos. Nunca sube por encima del precio
 * fijado ni baja por debajo del suelo, pase lo que pase con las fechas.
 */
export function precioVigente(r: RescateConPrecio, ahora = new Date()): number {
  const suelo = r.precioMinimoCentavos;

  // Sin suelo no hay precio dinámico. Y un suelo por encima del precio no
  // tiene sentido: se ignora en vez de producir un aumento sorpresa.
  if (suelo === null || suelo >= r.precioCentavos) {
    return r.precioCentavos;
  }

  const inicio = r.validoDesde.getTime();
  const fin = r.validoHasta.getTime();
  const ventana = fin - inicio;

  // Ventana inválida o nula: no hay proporción que calcular.
  if (ventana <= 0) return r.precioCentavos;

  const restante = (fin - ahora.getTime()) / ventana;

  // En el umbral exacto todavía NO se aplica el descuento: se abre al pasarlo.
  // Un límite tiene que caer de un lado, y este cae del lado del comercio, en
  // coherencia con el redondeo de abajo. Da igual cuál se elija mientras sea
  // uno y esté escrito.
  if (restante >= TRAMO_MEDIO) return r.precioCentavos;
  if (restante < TRAMO_FINAL) return suelo;

  // Tramo intermedio: a mitad de camino. Se redondea hacia arriba para que el
  // redondeo nunca juegue en contra del comercio.
  return Math.ceil((r.precioCentavos + suelo) / 2);
}

/**
 * Cuánto se ahorra ahora respecto del precio fijado, en centavos.
 * Cero cuando no hay descuento activo.
 */
export function descuentoDinamicoCentavos(
  r: RescateConPrecio,
  ahora = new Date(),
): number {
  return r.precioCentavos - precioVigente(r, ahora);
}
