import 'dart:math';
import 'api.dart';
import 'modelos.dart';
import 'ubicacion.dart';

/// Screens talk to this, never to ApiCliente directly, so route strings and
/// JSON shapes stay in one layer.
class Repositorio {
  Repositorio(this.api);

  final ApiCliente api;
  final _rnd = Random();

  /// Fresh key per attempt. Its purpose is that a retry after a network drop
  /// does not create a second order — not to deduplicate distinct requests.
  String _clave(String prefijo) =>
      '$prefijo-${DateTime.now().microsecondsSinceEpoch}-${_rnd.nextInt(9999)}';

  // --- Autenticación ---

  Future<void> registrar({
    required String email,
    required String password,
    String? nombre,
    bool comercio = false,
  }) async {
    final r = await api.post(
      '/api/v1/auth/register',
      idempotencyKey: _clave('reg'),
      cuerpo: {
        'email': email,
        'password': password,
        if (nombre != null && nombre.isNotEmpty) 'displayName': nombre,
        // Registrarse como comercio da de alta también su ficha comercial.
        if (comercio) 'role': 'comercio',
      },
    ) as Map<String, dynamic>;
    api.establecerSesion(
      r['accessToken'] as String,
      r['refreshToken'] as String,
    );
  }

  /// Returns false when the account requires a second factor, so the caller can
  /// ask for the code instead of treating it as a failure.
  Future<bool> iniciarSesion({
    required String email,
    required String password,
    String? codigoMfa,
  }) async {
    final r = await api.post('/api/v1/auth/login', cuerpo: {
      'email': email,
      'password': password,
      if (codigoMfa != null && codigoMfa.isNotEmpty) 'mfaToken': codigoMfa,
    }) as Map<String, dynamic>;

    if (r['mfaRequired'] == true) return false;

    api.establecerSesion(
      r['accessToken'] as String,
      r['refreshToken'] as String,
    );
    return true;
  }

  void cerrarSesion() => api.cerrarSesion();

  bool get esComercio => api.rol == 'comercio';

  // --- Catálogo ---

  /// [cerca] activa la búsqueda por cercanía: los resultados llegan con su
  /// distancia y ordenados por ella, en vez de por vencimiento.
  Future<Pagina<Rescate>> buscarRescates({
    String? q,
    String? categoria,
    Coordenada? cerca,
    double radioKm = 5,
    int pagina = 1,
  }) async {
    final r = await api.get('/api/v1/catalogo/rescates', query: {
      'page': '$pagina',
      'pageSize': '20',
      if (q != null && q.isNotEmpty) 'q': q,
      if (categoria != null && categoria.isNotEmpty) 'categoria': categoria,
      if (cerca != null) ...{
        'lat': '${cerca.lat}',
        'lng': '${cerca.lng}',
        'radioKm': '$radioKm',
      },
    }) as Map<String, dynamic>;
    return Pagina.desdeJson(r, Rescate.desdeJson);
  }

  Future<Rescate> verRescate(String id) async {
    final r = await api.get('/api/v1/catalogo/rescates/$id')
        as Map<String, dynamic>;
    return Rescate.desdeJson(r);
  }

  // --- Órdenes ---

  Future<Orden> crearOrden({
    required String rescateId,
    required int cantidad,
    String? cuponCodigo,
  }) async {
    final r = await api.post(
      '/api/v1/ordenes',
      idempotencyKey: _clave('ord'),
      cuerpo: {
        'rescateId': rescateId,
        'cantidad': cantidad,
        if (cuponCodigo != null && cuponCodigo.isNotEmpty)
          'cuponCodigo': cuponCodigo,
      },
    ) as Map<String, dynamic>;
    return Orden.desdeJson(r);
  }

  Future<Pagina<Orden>> misOrdenes({int pagina = 1}) async {
    final r = await api.get('/api/v1/ordenes/mias', query: {
      'page': '$pagina',
      'pageSize': '20',
    }) as Map<String, dynamic>;
    return Pagina.desdeJson(r, Orden.desdeJson);
  }

  /// Solo el comprador de una orden cumplida, y una sola vez: el servidor
  /// responde 409 al segundo intento.
  Future<void> resenarOrden(
    String ordenId, {
    required int calificacion,
    String? comentario,
  }) async {
    await api.post(
      '/api/v1/ordenes/$ordenId/resena',
      idempotencyKey: _clave('res'),
      cuerpo: {
        'calificacion': calificacion,
        if (comentario != null && comentario.trim().isNotEmpty)
          'comentario': comentario.trim(),
      },
    );
  }

  /// [motivo] lo decide quien cancela: el comprador solo puede alegar
  /// 'comprador'; el comercio, 'comercio' o 'no_show'. El servidor lo verifica.
  Future<void> cancelarOrden(String id, {String motivo = 'comprador'}) async {
    await api.patch('/api/v1/ordenes/$id/cancelar', cuerpo: {'motivo': motivo});
  }

  // --- Comercio ---

  Future<Pagina<Rescate>> misRescates({int pagina = 1}) async {
    final r = await api.get('/api/v1/catalogo/mis-rescates', query: {
      'page': '$pagina',
      'pageSize': '20',
    }) as Map<String, dynamic>;
    return Pagina.desdeJson(r, Rescate.desdeJson);
  }

  /// Nace en borrador: publicarlo es una acción aparte y deliberada, para que
  /// nada salga a la vitrina por el mero hecho de haberlo escrito.
  Future<Rescate> crearRescate({
    required String titulo,
    String? descripcion,
    String? categoria,
    required int precioCentavos,
    int? precioOriginalCentavos,
    required int cantidadTotal,
    required DateTime validoDesde,
    required DateTime validoHasta,
  }) async {
    final r = await api.post(
      '/api/v1/catalogo/rescates',
      idempotencyKey: _clave('resc'),
      cuerpo: {
        'titulo': titulo,
        if (descripcion != null && descripcion.isNotEmpty)
          'descripcion': descripcion,
        if (categoria != null && categoria.isNotEmpty) 'categoria': categoria,
        'precioCentavos': precioCentavos,
        // Omitido si no hay precio de referencia: enviar null sería afirmar
        // que no lo tiene, y el campo es opcional.
        'precioOriginalCentavos': ?precioOriginalCentavos,
        'cantidadTotal': cantidadTotal,
        'validoDesde': validoDesde.toUtc().toIso8601String(),
        'validoHasta': validoHasta.toUtc().toIso8601String(),
      },
    ) as Map<String, dynamic>;
    return Rescate.desdeJson(r);
  }

  Future<void> publicarRescate(String id) =>
      api.patch('/api/v1/catalogo/rescates/$id/publicar');

  Future<void> pausarRescate(String id) =>
      api.patch('/api/v1/catalogo/rescates/$id/pausar');

  Future<Pagina<Orden>> ordenesRecibidas({int pagina = 1}) async {
    final r = await api.get('/api/v1/ordenes/recibidas', query: {
      'page': '$pagina',
      'pageSize': '20',
    }) as Map<String, dynamic>;
    return Pagina.desdeJson(r, Orden.desdeJson);
  }

  Future<void> confirmarOrden(String id) =>
      api.patch('/api/v1/ordenes/$id/confirmar');

  Future<void> cumplirOrden(String id) =>
      api.patch('/api/v1/ordenes/$id/cumplir');

  Future<Comercio> miComercio() async {
    final r = await api.get('/api/v1/catalogo/mi-comercio')
        as Map<String, dynamic>;
    return Comercio.desdeJson(r);
  }

  /// La dirección y las coordenadas se pueden guardar por separado: es mejor
  /// tener la dirección escrita que nada mientras se consiguen las coordenadas.
  Future<Comercio> fijarUbicacion({
    String? direccion,
    Coordenada? punto,
  }) async {
    final r = await api.patch('/api/v1/catalogo/mi-comercio/ubicacion', cuerpo: {
      if (direccion != null && direccion.trim().isNotEmpty)
        'direccion': direccion.trim(),
      if (punto != null) ...{
        'latitud': punto.lat,
        'longitud': punto.lng,
      },
    }) as Map<String, dynamic>;
    return Comercio.desdeJson(r);
  }

  Future<Reputacion> reputacionDe(String sujetoId) async {
    final r = await api.get('/api/v1/ordenes/reputacion/$sujetoId')
        as Map<String, dynamic>;
    return Reputacion.desdeJson(r);
  }

  /// Perfil y reputación en una sola espera.
  ///
  /// Van juntos porque la reputación se pide con el merchantId, que solo se
  /// conoce tras la primera llamada: encadenarlas aquí evita que cada pantalla
  /// repita esa dependencia.
  Future<({Comercio comercio, Reputacion reputacion})> miComercioConReputacion() async {
    final comercio = await miComercio();
    return (comercio: comercio, reputacion: await reputacionDe(comercio.id));
  }
}
