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

/// No se pudo llegar al servidor: sin datos, sin wifi, o el servidor caído.
///
/// Existe como tipo aparte porque no es lo mismo que el servidor conteste que
/// algo salió mal. Antes cada pantalla lo adivinaba por su cuenta y el
/// resultado era desparejo: al reservar decía «No se pudo completar la compra»
/// —que suena a que el problema es la compra— mientras al entrar sí hablaba de
/// la conexión.
///
/// Al ser una `ApiExcepcion`, las pantallas que ya muestran `e.mensaje` dan el
/// mensaje correcto sin tocar nada.
class SinConexionExcepcion extends ApiExcepcion {
  SinConexionExcepcion()
      : super(0, 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
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
  String? _rol;

  bool get autenticado => _accessToken != null;

  /// Rol de la sesión, leído del propio token.
  ///
  /// Sirve para decidir qué pantalla mostrar, nada más. No es una frontera de
  /// seguridad: el servidor vuelve a comprobar el rol en cada petición, así que
  /// un cliente que se mintiera a sí mismo solo cosecharía 403.
  String? get rol => _rol;

  void establecerSesion(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _rol = _rolDe(accessToken);
  }

  void cerrarSesion() {
    _accessToken = null;
    _refreshToken = null;
    _rol = null;
  }

  static String? _rolDe(String accessToken) {
    try {
      final partes = accessToken.split('.');
      if (partes.length != 3) return null;
      final carga = utf8.decode(base64Url.decode(base64Url.normalize(partes[1])));
      return (jsonDecode(carga) as Map<String, dynamic>)['role'] as String?;
    } catch (_) {
      // Un token con forma inesperada no debe impedir usar la app: sin rol
      // conocido se muestra la experiencia de comprador, que es la común.
      return null;
    }
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
  /// pair, so the old one is deliberately discarded.
  ///
  /// Se distingue «el servidor dice que no» de «no llegué al servidor». Lo
  /// primero significa que la sesión terminó y hay que cerrarla. Lo segundo es
  /// un problema de red: cerrar la sesión ahí obligaría a volver a escribir la
  /// contraseña por haber pasado por un túnel, y el refresco todavía sirve.
  Future<bool> _renovarSesion() async {
    final refresh = _refreshToken;
    if (refresh == null) return false;
    late final http.Response r;
    try {
      r = await _http.post(
        Uri.parse('$baseUrl/api/v1/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );
    } catch (_) {
      throw SinConexionExcepcion();
    }
    try {
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
      // Contestó, pero con algo que no se entiende. Eso sí es sesión perdida.
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

  /// Ejecuta [enviar] y, ante un 401, renueva la sesión y repite una vez.
  ///
  /// El token de acceso dura quince minutos. Dejar la app abierta, atender el
  /// mostrador y volver es lo normal, así que sin esto la sesión se moriría en
  /// la mano del usuario.
  ///
  /// ## Por qué se repite también lo que lleva `Idempotency-Key`
  ///
  /// Antes no se repetía, por miedo a que el servidor ya hubiera aplicado el
  /// primer intento. El miedo era infundado, y salía caro: como publicar y
  /// reservar llevan clave de idempotencia, la sesión tampoco se renovaba con
  /// ellas, y tras un cuarto de hora en reposo el comercio se quedaba sin
  /// poder publicar —fallaba el primer intento, el segundo y el siguiente—
  /// viendo solo la palabra «Unauthorized».
  ///
  /// Repetir es seguro por dos motivos independientes:
  ///
  /// 1. El 401 lo emite el guardia de autenticación, **antes** de que corra
  ///    nada. Comprobado contra la API: un 401 no consume la clave de
  ///    idempotencia, y esa misma clave con un token válido crea el recurso.
  ///    O sea, un 401 es prueba de que la operación no se aplicó.
  /// 2. La repetición lleva **la misma** clave de idempotencia. Aunque el
  ///    primer intento hubiera llegado a aplicarse, el servidor devolvería el
  ///    resultado guardado en vez de duplicar nada. Para eso existe la clave.
  ///
  /// [reintentable] queda para cortar la repetición donde no convenga; hoy no
  /// la usa nadie.
  ///
  /// El refresco es de un solo uso: cada renovación devuelve un par nuevo. Se
  /// intenta una vez —si la propia renovación falla, la sesión terminó—.
  Future<dynamic> _conReintento(
    Future<http.Response> Function() enviar, {
    bool reintentable = true,
  }) async {
    // No llegar al servidor se distingue aquí, una sola vez, en vez de que
    // cada pantalla lo adivine. Así «no hay internet» dice siempre lo mismo,
    // venga de reservar, de publicar o de entrar.
    Future<http.Response> intentar() async {
      try {
        return await enviar();
      } catch (_) {
        throw SinConexionExcepcion();
      }
    }

    var r = await intentar();
    if (r.statusCode != 401 || _refreshToken == null) return _procesar(r);

    if (!await _renovarSesion()) {
      // El refresco tampoco valía: la sesión terminó de verdad. Se dice así,
      // en vez de dejar salir el «Unauthorized» del servidor.
      throw ApiExcepcion(401, 'Tu sesión se cerró. Hay que volver a entrar.');
    }
    if (!reintentable) {
      throw ApiExcepcion(
        401,
        'Tu sesión venció y se acaba de renovar. La acción no se completó: '
        'hay que repetirla.',
      );
    }
    return _procesar(await intentar());
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
