// Modelos del dominio. Mapean uno a uno lo que devuelve la API.

/// Moneda que se asume cuando una respuesta no la trae.
///
/// El servidor guarda la moneda en cada registro y la envía siempre; esto solo
/// cubre el hueco. Es USD por la decisión del modelo canónico de datos
/// —«multi-moneda desde el diseño, aunque el MVP sea solo USD»—: adivinar PAB
/// aquí haría que la pantalla contradijera lo que la base de datos guardó.
const String monedaPorDefecto = 'USD';

/// Qué clase de oferta es.
///
/// Cambia lo que quien compra puede esperar, así que se dice siempre: en una
/// caja sorpresa el contenido es desconocido a propósito, y un lote se lleva
/// entero.
enum TipoOferta { unitario, cajaSorpresa, lote }

TipoOferta _tipoDesde(String? v) => switch (v) {
      'caja_sorpresa' => TipoOferta.cajaSorpresa,
      'lote' => TipoOferta.lote,
      // Incluye null: lo que no declara tipo es un artículo suelto, igual que
      // decide el servidor.
      _ => TipoOferta.unitario,
    };

String tipoOfertaApi(TipoOferta t) => switch (t) {
      TipoOferta.unitario => 'unitario',
      TipoOferta.cajaSorpresa => 'caja_sorpresa',
      TipoOferta.lote => 'lote',
    };

extension TipoOfertaTexto on TipoOferta {
  String get etiqueta => switch (this) {
        TipoOferta.unitario => 'Unidad',
        TipoOferta.cajaSorpresa => 'Caja sorpresa',
        TipoOferta.lote => 'Lote',
      };

  /// Lo que hay que saber antes de comprar, no un eslogan.
  String get explicacion => switch (this) {
        TipoOferta.unitario => 'Se vende por unidad.',
        TipoOferta.cajaSorpresa =>
          'El contenido es sorpresa: lo elige el comercio con lo que le haya '
              'quedado. Por eso está más barato.',
        TipoOferta.lote => 'Se lleva completo, no por unidades sueltas.',
      };
}

/// Estado de una publicación. Solo importa en el panel del comercio: la
/// vitrina pública únicamente devuelve las publicadas.
enum EstadoRescate {
  borrador,
  publicado,
  pausado,
  agotado,
  vencido,
  retirado,
  desconocido,
}

EstadoRescate _estadoRescateDesde(String? v) => switch (v) {
      'borrador' => EstadoRescate.borrador,
      'publicado' => EstadoRescate.publicado,
      'pausado' => EstadoRescate.pausado,
      'agotado' => EstadoRescate.agotado,
      'vencido' => EstadoRescate.vencido,
      'retirado' => EstadoRescate.retirado,
      _ => EstadoRescate.desconocido,
    };

class Rescate {
  Rescate({
    required this.id,
    required this.titulo,
    required this.tipo,
    required this.descripcion,
    required this.categoria,
    required this.precioCentavos,
    required this.precioOriginalCentavos,
    required this.moneda,
    required this.cantidadDisponible,
    required this.cantidadTotal,
    required this.estado,
    required this.validoDesde,
    required this.validoHasta,
    this.distanciaKm,
  });

  final String id;
  final String titulo;
  final TipoOferta tipo;
  final String? descripcion;
  final String? categoria;
  final int precioCentavos;
  final int? precioOriginalCentavos;
  final String moneda;
  final int cantidadDisponible;
  final int cantidadTotal;
  final EstadoRescate estado;
  final DateTime validoDesde;
  final DateTime validoHasta;

  /// Solo llega cuando se buscó por cercanía; nula en el resto de búsquedas.
  final double? distanciaKm;

  /// Unidades ya comprometidas. El comercio necesita saberlo antes de pausar:
  /// pausar no cancela las reservas que ya existen.
  int get cantidadVendida => cantidadTotal - cantidadDisponible;

  /// Whole-percent saving versus the reference price, or null when there is none.
  int? get descuentoPorcentaje {
    final original = precioOriginalCentavos;
    if (original == null || original <= precioCentavos) return null;
    return (((original - precioCentavos) / original) * 100).round();
  }

  Duration get tiempoRestante => validoHasta.difference(DateTime.now());

  factory Rescate.desdeJson(Map<String, dynamic> j) => Rescate(
        id: j['id'] as String,
        titulo: j['titulo'] as String,
        tipo: _tipoDesde(j['tipo'] as String?),
        descripcion: j['descripcion'] as String?,
        categoria: j['categoria'] as String?,
        precioCentavos: j['precioCentavos'] as int,
        precioOriginalCentavos: j['precioOriginalCentavos'] as int?,
        moneda: (j['moneda'] as String?) ?? monedaPorDefecto,
        cantidadDisponible: j['cantidadDisponible'] as int,
        cantidadTotal:
            (j['cantidadTotal'] as int?) ?? (j['cantidadDisponible'] as int),
        estado: _estadoRescateDesde(j['status'] as String?),
        validoDesde: j['validoDesde'] == null
            ? DateTime.now()
            : DateTime.parse(j['validoDesde'] as String).toLocal(),
        validoHasta: DateTime.parse(j['validoHasta'] as String).toLocal(),
        distanciaKm: _aDouble(j['distanciaKm']),
      );
}

enum EstadoOrden { creada, confirmada, cumplida, cancelada, desconocido }

EstadoOrden _estadoDesde(String v) => switch (v) {
      'creada' => EstadoOrden.creada,
      'confirmada' => EstadoOrden.confirmada,
      'cumplida' => EstadoOrden.cumplida,
      'cancelada' => EstadoOrden.cancelada,
      _ => EstadoOrden.desconocido,
    };

/// Una línea de la orden. Todos sus campos son copia tomada en el momento de
/// la compra: la publicación puede cambiar de precio o agotarse después, y la
/// orden debe seguir reflejando lo que se acordó.
class LineaOrden {
  LineaOrden({
    required this.rescateId,
    required this.titulo,
    required this.precioUnitarioCentavos,
    required this.cantidad,
    required this.totalLineaCentavos,
  });

  final String rescateId;
  final String titulo;
  final int precioUnitarioCentavos;
  final int cantidad;
  final int totalLineaCentavos;

  factory LineaOrden.desdeJson(Map<String, dynamic> j) => LineaOrden(
        rescateId: j['rescateId'] as String,
        titulo: j['tituloSnapshot'] as String,
        precioUnitarioCentavos: j['precioUnitarioCentavos'] as int,
        cantidad: j['cantidad'] as int,
        totalLineaCentavos: j['totalLineaCentavos'] as int,
      );
}

/// La calificación que ya dejó el comprador sobre una orden.
class ResenaPropia {
  ResenaPropia({required this.calificacion, required this.comentario});

  final int calificacion;
  final String? comentario;

  factory ResenaPropia.desdeJson(Map<String, dynamic> j) => ResenaPropia(
        calificacion: j['calificacion'] as int,
        comentario: j['comentario'] as String?,
      );
}

class Orden {
  Orden({
    required this.id,
    required this.numero,
    required this.estado,
    required this.lineas,
    required this.resena,
    required this.subtotalCentavos,
    required this.descuentoCentavos,
    required this.totalCentavos,
    required this.moneda,
    required this.creadaEn,
    required this.expiraEn,
    this.qrToken,
  });

  final String id;
  final String numero;
  final EstadoOrden estado;
  final List<LineaOrden> lineas;

  /// Nula mientras el comprador no haya calificado. La API solo admite una
  /// reseña por orden, así que esto es lo que decide si se ofrece calificar.
  final ResenaPropia? resena;
  final int subtotalCentavos;
  final int descuentoCentavos;
  final int totalCentavos;
  final String moneda;
  final DateTime creadaEn;
  final DateTime expiraEn;

  /// Solo llega en la respuesta de creación y nunca más: el servidor guarda
  /// únicamente su hash. Si se pierde, el retiro se hace por número de orden.
  final String? qrToken;

  /// Lo pedido, en una línea legible: «2 × Pan artesanal».
  /// La v1 admite un solo rescate por orden, pero el modelo ya soporta varios.
  String get resumen => lineas.isEmpty
      ? 'Sin detalle'
      : lineas.map((l) => '${l.cantidad} × ${l.titulo}').join(', ');

  factory Orden.desdeJson(Map<String, dynamic> j) => Orden(
        id: j['id'] as String,
        numero: j['numero'] as String,
        estado: _estadoDesde(j['status'] as String),
        // Ausente en la respuesta de creación, presente en los listados.
        lineas: ((j['items'] as List<dynamic>?) ?? const [])
            .map((e) => LineaOrden.desdeJson(e as Map<String, dynamic>))
            .toList(),
        // Solo viaja en el listado del comprador: al comercio no le compete.
        resena: j['resena'] == null
            ? null
            : ResenaPropia.desdeJson(j['resena'] as Map<String, dynamic>),
        subtotalCentavos: j['subtotalCentavos'] as int,
        descuentoCentavos: (j['descuentoCentavos'] as int?) ?? 0,
        totalCentavos: j['totalCentavos'] as int,
        moneda: (j['moneda'] as String?) ?? monedaPorDefecto,
        creadaEn: DateTime.parse(j['createdAt'] as String).toLocal(),
        expiraEn: DateTime.parse(j['expiraAt'] as String).toLocal(),
        qrToken: j['qrToken'] as String?,
      );
}

/// Perfil comercial de quien tiene la sesión abierta.
///
/// Su `id` no es el del usuario: es la clave con la que la API indexa las
/// órdenes y la reputación.
class Comercio {
  Comercio({
    required this.id,
    required this.nombreLegal,
    required this.verificado,
    required this.direccion,
    required this.latitud,
    required this.longitud,
  });

  final String id;
  final String nombreLegal;
  final bool verificado;
  final String? direccion;
  final double? latitud;
  final double? longitud;

  /// Sin coordenadas el comercio vende igual, pero no sale en las búsquedas
  /// por cercanía. Conviene decírselo.
  bool get apareceEnBusquedasCercanas => latitud != null && longitud != null;

  factory Comercio.desdeJson(Map<String, dynamic> j) => Comercio(
        id: j['id'] as String,
        nombreLegal: j['legalName'] as String,
        verificado: (j['isVerified'] as bool?) ?? false,
        direccion: j['direccion'] as String?,
        // La API las manda como numeric, que viaja en JSON como número o como
        // cadena según el driver; se acepta cualquiera de las dos formas.
        latitud: _aDouble(j['latitud']),
        longitud: _aDouble(j['longitud']),
      );
}

double? _aDouble(dynamic v) => switch (v) {
      null => null,
      num n => n.toDouble(),
      String s => double.tryParse(s),
      _ => null,
    };

/// Reputación acumulada de un comercio o de un comprador.
class Reputacion {
  Reputacion({
    required this.promedio,
    required this.totalResenas,
    required this.ordenesCumplidas,
    required this.noShows,
  });

  /// Nulo mientras no haya ninguna reseña: distinto de cero, que sería la peor
  /// nota posible. Un comercio nuevo no arranca con mala fama.
  final double? promedio;
  final int totalResenas;
  final int ordenesCumplidas;
  final int noShows;

  factory Reputacion.desdeJson(Map<String, dynamic> j) => Reputacion(
        promedio: (j['promedio'] as num?)?.toDouble(),
        totalResenas: (j['totalResenas'] as int?) ?? 0,
        ordenesCumplidas: (j['ordenesCumplidas'] as int?) ?? 0,
        noShows: (j['noShows'] as int?) ?? 0,
      );
}

class Pagina<T> {
  Pagina({required this.items, required this.total});

  final List<T> items;
  final int total;

  factory Pagina.desdeJson(
    Map<String, dynamic> j,
    T Function(Map<String, dynamic>) mapear,
  ) =>
      Pagina(
        items: (j['items'] as List<dynamic>)
            .map((e) => mapear(e as Map<String, dynamic>))
            .toList(),
        total: j['total'] as int,
      );
}
