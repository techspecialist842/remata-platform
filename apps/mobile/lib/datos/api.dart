import 'dart:convert';
import 'package:http/http.dart' as http;

/// Thrown for any non-2xx response. Carries the server's `correlationId` so a
/// user-reported problem can be traced straight to the backend logs and the
/// audit trail — the API stamps one on every response, including errors.
class ApiExcepcion implements Exception {
  ApiExcepcion(this.statusCode, this.mensaje, {this.correlationId});

  final int statusCode;
  final String mensaje;
  final String? correlationId;

  @override
  String toString() => mensaje;
}

/// Thin HTTP client over the REMATA API.
///
/// Deliberately hand-written rather than generated: the surface is small, and
/// this keeps the request/response contract visible in one readable file.
class ApiCliente {
  ApiCliente({String? baseUrl, http.Client? cliente})
      : baseUrl = baseUrl ?? _baseUrlPorDefecto,
        _http = cliente ?? http.Client();

  /// Overridable at build time so the same binary can target any environment:
  ///   flutter run --dart-define=REMATA_API=https://dev.remata.app
  static const String _baseUrlPorDefecto = String.fromEnvironment(
    'REMATA_API',
    defaultValue: 'https://staging.remata.app',
  );

  final String baseUrl;
  final http.Client _http;

  String? _accessToken;
  String? _refreshToken;

  bool get autenticado => _accessToken != null;

  void establecerSesion(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  void cerrarSesion() {
    _accessToken = null;
    _refreshToken = null;
  }

  Map<String, String> _cabeceras({String? idempotencyKey}) {
    final h = <String, String>{'Content-Type': 'application/json'};
    final token = _accessToken;
    if (token != null) h['Authorization'] = 'Bearer $token';
    if (idempotencyKey != null) h['Idempotency-Key'] = idempotencyKey;
    return h;
  }

  /// Access tokens live 15 minutes. Without this the session would simply die
  /// mid-use; with it, one 401 triggers a silent renewal and the original
  /// request is retried once.
  ///
  /// Refresh tokens are single-use on the server: each renewal returns a new
  /// pair, so the old one is deliberately discarded. Retried only once — if the
  /// renewal itself fails, the session is genuinely over.
  Future<bool> _renovarSesion() async {
    final refresh = _refreshToken;
    if (refresh == null) return false;
    try {
      final r = await _http.post(
        Uri.parse('$baseUrl/api/v1/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );
      if (r.statusCode < 200 || r.statusCode >= 300) {
        cerrarSesion();
        return false;
      }
      final j = jsonDecode(r.body) as Map<String, dynamic>;
      establecerSesion(
        j['accessToken'] as String,
        j['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      cerrarSesion();
      return false;
    }
  }

  Future<dynamic> _procesar(http.Response r) async {
    final cuerpo = r.body.isEmpty
        ? null
        : jsonDecode(utf8.decode(r.bodyBytes)) as dynamic;

    if (r.statusCode >= 200 && r.statusCode < 300) return cuerpo;

    // El backend responde siempre con el mismo sobre de error.
    String mensaje = 'Error inesperado';
    String? correlationId;
    if (cuerpo is Map<String, dynamic>) {
      final m = cuerpo['message'];
      mensaje = m is List ? m.join('\n') : (m?.toString() ?? mensaje);
      correlationId = cuerpo['correlationId'] as String?;
    }
    throw ApiExcepcion(r.statusCode, mensaje, correlationId: correlationId);
  }

  /// Runs [enviar], and on a 401 renews the session once and retries.
  ///
  /// The retry is skipped for requests carrying an Idempotency-Key: those are
  /// state-changing, the server may already have applied the first attempt, and
  /// replaying it under a new token would be reasoning about a request whose
  /// outcome we do not know. Better to surface the failure.
  Future<dynamic> _conReintento(
    Future<http.Response> Function() enviar, {
    bool reintentable = true,
  }) async {
    var r = await enviar();
    if (r.statusCode == 401 && reintentable && _refreshToken != null) {
      if (await _renovarSesion()) r = await enviar();
    }
    return _procesar(r);
  }

  Future<dynamic> get(String ruta, {Map<String, String>? query}) {
    final uri = Uri.parse('$baseUrl$ruta').replace(queryParameters: query);
    return _conReintento(() => _http.get(uri, headers: _cabeceras()));
  }

  Future<dynamic> post(
    String ruta, {
    Object? cuerpo,
    String? idempotencyKey,
  }) {
    return _conReintento(
      () => _http.post(
        Uri.parse('$baseUrl$ruta'),
        headers: _cabeceras(idempotencyKey: idempotencyKey),
        body: cuerpo == null ? null : jsonEncode(cuerpo),
      ),
      reintentable: idempotencyKey == null,
    );
  }

  Future<dynamic> patch(String ruta, {Object? cuerpo}) {
    return _conReintento(
      () => _http.patch(
        Uri.parse('$baseUrl$ruta'),
        headers: _cabeceras(),
        body: cuerpo == null ? null : jsonEncode(cuerpo),
      ),
    );
  }
}
