import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/modelos.dart';
import 'package:remata_movil/design/tokens.dart';

void main() {
  group('formato de precio', () {
    // Amounts travel as integer minor units end to end. These pin the display
    // rule so a refactor cannot silently start rendering cents as whole units.
    test('muestra balboas con dos decimales', () {
      expect(formatearPrecio(250), 'B/. 2.50');
      expect(formatearPrecio(1), 'B/. 0.01');
      expect(formatearPrecio(100000), 'B/. 1000.00');
    });

    test('usa el símbolo de dólar para USD', () {
      expect(formatearPrecio(250, moneda: 'USD'), r'$ 2.50');
    });
  });

  group('Rescate', () {
    Map<String, dynamic> base() => {
          'id': 'r1',
          'titulo': 'Pan',
          'descripcion': null,
          'categoria': null,
          'precioCentavos': 250,
          'precioOriginalCentavos': 1000,
          'moneda': 'PAB',
          'cantidadDisponible': 3,
          'validoHasta':
              DateTime.now().add(const Duration(hours: 2)).toIso8601String(),
        };

    test('calcula el porcentaje de descuento', () {
      expect(Rescate.desdeJson(base()).descuentoPorcentaje, 75);
    });

    test('no informa descuento sin precio de referencia', () {
      final j = base()..['precioOriginalCentavos'] = null;
      expect(Rescate.desdeJson(j).descuentoPorcentaje, isNull);
    });

    test('no informa descuento si el precio de referencia no es mayor', () {
      final j = base()..['precioOriginalCentavos'] = 200;
      expect(Rescate.desdeJson(j).descuentoPorcentaje, isNull);
    });
  });

  group('ApiCliente', () {
    test('conserva el correlationId del error para poder rastrearlo', () async {
      final cliente = ApiCliente(
        baseUrl: 'https://ejemplo.test',
        cliente: MockClient((_) async => http.Response(
              jsonEncode({
                'statusCode': 409,
                'message': 'No hay unidades suficientes disponibles',
                'correlationId': 'abc-123',
              }),
              409,
            )),
      );

      await expectLater(
        cliente.post('/api/v1/ordenes', idempotencyKey: 'k'),
        throwsA(
          isA<ApiExcepcion>()
              .having((e) => e.statusCode, 'statusCode', 409)
              .having((e) => e.correlationId, 'correlationId', 'abc-123'),
        ),
      );
    });

    // Regression guard for the retry rule: a 401 renews the session and replays
    // the request, but never one that carries an Idempotency-Key — the server
    // may already have applied it, and replaying would risk a second order.
    test('renueva la sesión y reintenta una lectura tras un 401', () async {
      var llamadas = <String>[];
      final cliente = ApiCliente(
        baseUrl: 'https://ejemplo.test',
        cliente: MockClient((req) async {
          llamadas.add(req.url.path);
          if (req.url.path.endsWith('/auth/refresh')) {
            return http.Response(
              jsonEncode({'accessToken': 'nuevo', 'refreshToken': 'nuevoR'}),
              201,
            );
          }
          // Primera lectura: token vencido. Segunda: ya renovado.
          final esPrimera =
              llamadas.where((p) => p.endsWith('/mias')).length == 1;
          return esPrimera
              ? http.Response(jsonEncode({'message': 'expirado'}), 401)
              : http.Response(jsonEncode({'items': [], 'total': 0}), 200);
        }),
      )..establecerSesion('viejo', 'viejoR');

      final r = await cliente.get('/api/v1/ordenes/mias');
      expect((r as Map)['total'], 0);
      expect(llamadas.where((p) => p.endsWith('/auth/refresh')).length, 1);
    });

    test('no reintenta una operación con Idempotency-Key', () async {
      var intentos = 0;
      final cliente = ApiCliente(
        baseUrl: 'https://ejemplo.test',
        cliente: MockClient((_) async {
          intentos++;
          return http.Response(jsonEncode({'message': 'expirado'}), 401);
        }),
      )..establecerSesion('viejo', 'viejoR');

      await expectLater(
        cliente.post('/api/v1/ordenes', idempotencyKey: 'k'),
        throwsA(isA<ApiExcepcion>()),
      );
      expect(intentos, 1, reason: 'no debe replayear una operación de estado');
    });
  });
}
