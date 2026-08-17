import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';

/// Qué pasa cuando el token de acceso vence con la app abierta.
///
/// El token dura quince minutos. Dejar la app en reposo un rato y volver a
/// usarla no es un caso raro: es lo que hace cualquiera que abre la app,
/// atiende el mostrador y vuelve. Estas pruebas existen porque ese caso estuvo
/// roto —la primera acción fallaba, la segunda también, y el comercio se
/// quedaba sin poder publicar viendo la palabra «Unauthorized»— y el fallo solo
/// apareció esperando los quince minutos de verdad.

http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

final noAutorizado = respuesta(jsonEncode({'message': 'Unauthorized'}), 401);

String parRenovado(String sufijo) => jsonEncode({
      'accessToken': 'nuevo-acceso-$sufijo',
      'refreshToken': 'nuevo-refresco-$sufijo',
    });

/// Cliente que responde 401 mientras el token sea el viejo, y bien en cuanto
/// llega uno nuevo. Registra cada petición para poder contarlas.
class Servidor {
  Servidor({this.renovacionFalla = false});

  final bool renovacionFalla;
  final List<String> peticiones = [];
  int renovaciones = 0;

  MockClient get cliente => MockClient((p) async {
        final ruta = p.url.path;
        peticiones.add('${p.method} $ruta');

        if (ruta.endsWith('/auth/refresh')) {
          renovaciones++;
          if (renovacionFalla) {
            return respuesta(jsonEncode({'message': 'Refresh token revoked'}), 401);
          }
          return respuesta(parRenovado('$renovaciones'));
        }

        // Solo vale un token renovado. El viejo —y la ausencia de token—
        // dan 401, que es lo que haría el servidor de verdad.
        final token = p.headers['Authorization'];
        if (token == null || !token.startsWith('Bearer nuevo-acceso-')) {
          return noAutorizado;
        }
        return respuesta(jsonEncode({'ok': true}));
      });
}

ApiCliente clienteCon(Servidor s) {
  final api = ApiCliente(baseUrl: 'https://t.test', cliente: s.cliente);
  api.establecerSesion('viejo', 'refresco-valido');
  return api;
}

void main() {
  group('token vencido', () {
    test('una lectura se renueva sola y el usuario no se entera', () async {
      final s = Servidor();
      final api = clienteCon(s);

      final r = await api.get('/api/v1/ordenes/mias');

      expect((r as Map)['ok'], true);
      expect(s.renovaciones, 1);
      // La original, la renovación y la repetida.
      expect(s.peticiones.length, 3);
    });

    // El caso que estaba roto: publicar tras un rato de inactividad.
    //
    // Publicar y reservar llevan Idempotency-Key. Antes eso impedía renovar la
    // sesión, y el comercio se quedaba atascado sin poder publicar.
    test('publicar tras un rato de inactividad funciona a la primera',
        () async {
      final s = Servidor();
      final api = clienteCon(s);

      final r = await api.post(
        '/api/v1/catalogo/rescates',
        cuerpo: {'titulo': 'Pan'},
        idempotencyKey: 'k1',
      );

      expect((r as Map)['ok'], true);
      expect(s.renovaciones, 1);
    });

    // Repetir con la MISMA clave es lo que hace que repetir sea inofensivo: si
    // el primer intento hubiera llegado a aplicarse —que no puede, el 401 sale
    // del guardia antes de nada—, el servidor devolvería lo guardado en vez de
    // duplicar la orden.
    test('la repetición reutiliza la misma clave de idempotencia', () async {
      final claves = <String?>[];
      final api = ApiCliente(
        baseUrl: 'https://t.test',
        cliente: MockClient((p) async {
          if (p.url.path.endsWith('/auth/refresh')) {
            return respuesta(parRenovado('1'));
          }
          claves.add(p.headers['Idempotency-Key']);
          final token = p.headers['Authorization'];
          if (token == null || !token.startsWith('Bearer nuevo-acceso-')) {
            return noAutorizado;
          }
          return respuesta(jsonEncode({'ok': true}));
        }),
      )..establecerSesion('viejo', 'refresco-valido');

      await api.post('/api/v1/ordenes', cuerpo: {}, idempotencyKey: 'la-misma');

      expect(claves, ['la-misma', 'la-misma']);
    });
  });

  group('sesión terminada de verdad', () {
    test('si el refresco tampoco vale, se cierra y se dice en español',
        () async {
      final s = Servidor(renovacionFalla: true);
      final api = clienteCon(s);

      try {
        await api.get('/api/v1/ordenes/mias');
        fail('debería haber lanzado');
      } on ApiExcepcion catch (e) {
        expect(e.statusCode, 401);
        expect(e.mensaje.toLowerCase(), isNot(contains('unauthorized')));
        expect(e.mensaje, contains('volver a entrar'));
      }
      expect(api.autenticado, isFalse,
          reason: 'la sesión debe quedar cerrada, no a medias');
    });

    // Sin refresco no hay nada que renovar: el 401 es del servidor y se pasa
    // tal cual, sin inventar una renovación que no puede ocurrir.
    test('sin refresco no se intenta renovar', () async {
      final s = Servidor();
      final api = ApiCliente(baseUrl: 'https://t.test', cliente: s.cliente);

      await expectLater(
        api.get('/api/v1/catalogo/rescates'),
        throwsA(isA<ApiExcepcion>()),
      );
      expect(s.renovaciones, 0);
    });
  });
}
