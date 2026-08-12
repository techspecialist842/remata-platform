// Modelos del dominio. Mapean uno a uno lo que devuelve la API.

/// Moneda que se asume cuando una respuesta no la trae.
///
/// El servidor guarda la moneda en cada registro y la envía siempre; esto solo
/// cubre el hueco. Es USD por la decisión del modelo canónico de datos
/// —«multi-moneda desde el diseño, aunque el MVP sea solo USD»—: adivinar PAB
/// aquí haría que la pantalla contradijera lo que la base de datos guardó.
const String monedaPorDefecto = 'USD';

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
  });

  final String id;
  final String titulo;
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

class Orden {
  Orden({
    required this.id,
    required this.numero,
    required this.estado,
    required this.lineas,
    required this.subtotalCentavos,
    required this.descuentoCentavos,
    required this.totalCentavos,
    required this.moneda,
    required this.creadaEn,
    required this.expiraEn,
  });

  final String id;
  final String numero;
  final EstadoOrden estado;
  final List<LineaOrden> lineas;
  final int subtotalCentavos;
  final int descuentoCentavos;
  final int totalCentavos;
  final String moneda;
  final DateTime creadaEn;
  final DateTime expiraEn;

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
        subtotalCentavos: j['subtotalCentavos'] as int,
        descuentoCentavos: (j['descuentoCentavos'] as int?) ?? 0,
        totalCentavos: j['totalCentavos'] as int,
        moneda: (j['moneda'] as String?) ?? monedaPorDefecto,
        creadaEn: DateTime.parse(j['createdAt'] as String).toLocal(),
        expiraEn: DateTime.parse(j['expiraAt'] as String).toLocal(),
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
