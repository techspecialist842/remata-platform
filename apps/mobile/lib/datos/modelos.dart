// Modelos del dominio. Mapean uno a uno lo que devuelve la API.

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
  final DateTime validoHasta;

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
        moneda: (j['moneda'] as String?) ?? 'PAB',
        cantidadDisponible: j['cantidadDisponible'] as int,
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

class Orden {
  Orden({
    required this.id,
    required this.numero,
    required this.estado,
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
  final int subtotalCentavos;
  final int descuentoCentavos;
  final int totalCentavos;
  final String moneda;
  final DateTime creadaEn;
  final DateTime expiraEn;

  factory Orden.desdeJson(Map<String, dynamic> j) => Orden(
        id: j['id'] as String,
        numero: j['numero'] as String,
        estado: _estadoDesde(j['status'] as String),
        subtotalCentavos: j['subtotalCentavos'] as int,
        descuentoCentavos: (j['descuentoCentavos'] as int?) ?? 0,
        totalCentavos: j['totalCentavos'] as int,
        moneda: (j['moneda'] as String?) ?? 'PAB',
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
