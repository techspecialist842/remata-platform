import 'dart:math';
import 'api.dart';
import 'modelos.dart';

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
  }) async {
    final r = await api.post(
      '/api/v1/auth/register',
      idempotencyKey: _clave('reg'),
      cuerpo: {
        'email': email,
        'password': password,
        if (nombre != null && nombre.isNotEmpty) 'displayName': nombre,
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

  // --- Catálogo ---

  Future<Pagina<Rescate>> buscarRescates({
    String? q,
    String? categoria,
    int pagina = 1,
  }) async {
    final r = await api.get('/api/v1/catalogo/rescates', query: {
      'page': '$pagina',
      'pageSize': '20',
      if (q != null && q.isNotEmpty) 'q': q,
      if (categoria != null && categoria.isNotEmpty) 'categoria': categoria,
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

  Future<void> cancelarOrden(String id) async {
    await api.patch('/api/v1/ordenes/$id/cancelar',
        cuerpo: {'motivo': 'comprador'});
  }
}
