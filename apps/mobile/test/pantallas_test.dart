import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/repositorio.dart';
import 'package:remata_movil/design/tema.dart';
import 'package:remata_movil/pantallas/catalogo.dart';
import 'package:remata_movil/pantallas/pedidos.dart';

/// Verificación de la interfaz con datos controlados.
///
/// Las capturas de pantalla muestran que la app *se ve* bien; esto comprueba
/// que *se comporta* bien: que los datos de la API llegan a la pantalla, que un
/// listado vacío no parece un error, y que un fallo de red se comunica en vez
/// de dejar la pantalla en blanco. Corre en CI, sin navegador ni servidor.

Repositorio repoCon(MockClient cliente) =>
    Repositorio(ApiCliente(baseUrl: 'https://t.test', cliente: cliente));

/// Respuesta simulada con el mismo `content-type` que envía la API.
///
/// El charset no es un detalle decorativo: sin él, `http.Response` codifica el
/// cuerpo en latin-1 y cualquier acento llegaría corrupto al decodificar UTF-8.
http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Widget envolver(Widget hijo) =>
    MaterialApp(theme: construirTema(), home: hijo);

String catalogoJson(List<Map<String, dynamic>> items) => jsonEncode({
      'items': items,
      'total': items.length,
      'page': 1,
      'pageSize': 20,
    });

Map<String, dynamic> rescate({
  String id = 'r1',
  String titulo = 'Pan artesanal',
  int precio = 360,
  int? original = 600,
  int disponible = 8,
}) =>
    {
      'id': id,
      'titulo': titulo,
      'descripcion': 'Recién horneado',
      'categoria': 'Panadería',
      'precioCentavos': precio,
      'precioOriginalCentavos': original,
      'moneda': 'PAB',
      'cantidadDisponible': disponible,
      'validoHasta':
          DateTime.now().add(const Duration(hours: 5)).toIso8601String(),
    };

void main() {
  group('Catálogo', () {
    testWidgets('muestra las ofertas con precio y descuento', (tester) async {
      final repo = repoCon(MockClient((_) async => respuesta(
            catalogoJson([
              rescate(),
              rescate(
                  id: 'r2',
                  titulo: 'Croissants',
                  precio: 225,
                  original: 300,
                  disponible: 4),
            ]),
            200,
          )));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Pan artesanal'), findsOneWidget);
      expect(find.text('Croissants'), findsOneWidget);

      // La moneda la manda el servidor (PAB en estos datos) y la pantalla la sigue.
      expect(find.text('B/. 3.60'), findsOneWidget);
      expect(find.text('B/. 2.25'), findsOneWidget);

      // 360 sobre 600 es 40% de descuento; 225 sobre 300 es 25%.
      expect(find.text('-40%'), findsOneWidget);
      expect(find.text('-25%'), findsOneWidget);

      expect(find.text('8 disponibles'), findsOneWidget);
    });

    testWidgets('concuerda en singular con una sola unidad', (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(catalogoJson([rescate(disponible: 1)]))));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('1 disponible'), findsOneWidget);
      expect(find.text('1 disponibles'), findsNothing);
    });

    testWidgets('un listado vacío se explica, no parece un error',
        (tester) async {
      final repo = repoCon(
          MockClient((_) async => respuesta(catalogoJson([]))));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Sin ofertas por ahora'), findsOneWidget);
      // Vacío y averiado no son lo mismo: el mensaje de fallo no debe aparecer.
      expect(find.text('No pudimos cargar las ofertas'), findsNothing);
    });

    testWidgets('un fallo de red se comunica y permite reintentar',
        (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(jsonEncode({'message': 'caído'}), 500)));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('No pudimos cargar las ofertas'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('no anuncia descuento cuando no hay precio de referencia',
        (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(catalogoJson([rescate(original: null)]))));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      // Comprobar primero que la oferta se pintó: sin esto, la aserción de
      // abajo también pasaría si la pantalla hubiera fallado por completo.
      expect(find.text('Pan artesanal'), findsOneWidget);
      expect(find.textContaining('%'), findsNothing);
    });
  });

  group('Mis pedidos', () {
    String ordenesJson(List<Map<String, dynamic>> items) => jsonEncode({
          'items': items,
          'total': items.length,
          'page': 1,
          'pageSize': 20,
        });

    Map<String, dynamic> orden({
      String estado = 'creada',
      int total = 720,
      int descuento = 0,
      Map<String, dynamic>? resena,
    }) =>
        {
          'id': 'o1',
          'numero': 'R-260811-ABCD1234',
          'status': estado,
          'subtotalCentavos': total + descuento,
          'descuentoCentavos': descuento,
          'totalCentavos': total,
          'moneda': 'PAB',
          'items': [
            {
              'rescateId': 'r1',
              'tituloSnapshot': 'Pan artesanal',
              'precioUnitarioCentavos': (total + descuento) ~/ 2,
              'cantidad': 2,
              'totalLineaCentavos': total + descuento,
            }
          ],
          'resena': resena,
          'createdAt': DateTime.now().toIso8601String(),
          'expiraAt': DateTime.now()
              .add(const Duration(minutes: 30))
              .toIso8601String(),
        };

    testWidgets('describe cada estado con palabras, no solo con color',
        (tester) async {
      final repo = repoCon(MockClient((_) async =>
          respuesta(ordenesJson([orden(estado: 'confirmada')]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('R-260811-ABCD1234'), findsOneWidget);
      expect(find.text('Confirmada — pasá a retirarla'), findsOneWidget);
      // Un número de orden no basta para reconocer la propia reserva.
      expect(find.text('2 × Pan artesanal'), findsOneWidget);
    });

    testWidgets('ofrece cancelar mientras la orden sigue pendiente',
        (tester) async {
      final repo =
          repoCon(MockClient((_) async => respuesta(ordenesJson([orden()]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Cancelar reserva'), findsOneWidget);
    });

    testWidgets('no ofrece cancelar una orden ya entregada', (tester) async {
      final repo = repoCon(MockClient((_) async =>
          respuesta(ordenesJson([orden(estado: 'cumplida')]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Entregada'), findsOneWidget);
      expect(find.text('Cancelar reserva'), findsNothing);
    });

    testWidgets('destaca el ahorro cuando se aplicó un cupón', (tester) async {
      final repo = repoCon(MockClient((_) async => respuesta(
            ordenesJson([orden(total: 600, descuento: 120)]),
            200,
          )));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Ahorraste B/. 1.20'), findsOneWidget);
    });

    // Calificar solo se ofrece sobre lo entregado y solo una vez: la API
    // responde 409 al segundo intento, y un botón que solo puede fallar es
    // peor que ningún botón.
    testWidgets('ofrece calificar una orden entregada sin reseñar',
        (tester) async {
      final repo = repoCon(MockClient((_) async =>
          respuesta(ordenesJson([orden(estado: 'cumplida')]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Calificar'), findsOneWidget);
    });

    testWidgets('no ofrece calificar lo que todavía no se entregó',
        (tester) async {
      for (final estado in ['creada', 'confirmada', 'cancelada']) {
        final repo = repoCon(MockClient(
            (_) async => respuesta(ordenesJson([orden(estado: estado)]))));

        await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
        await tester.pumpAndSettle();

        expect(find.text('Calificar'), findsNothing, reason: estado);
      }
    });

    testWidgets('una vez calificada muestra la nota, no el botón',
        (tester) async {
      final repo = repoCon(MockClient((_) async => respuesta(ordenesJson([
            orden(
              estado: 'cumplida',
              resena: {'calificacion': 4, 'comentario': 'Muy bien'},
            )
          ]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Calificar'), findsNothing);
      expect(find.text('Ya calificaste'), findsOneWidget);
      expect(find.text('«Muy bien»'), findsOneWidget);
      // Cinco estrellas siempre: cuatro llenas y una vacía.
      expect(find.byIcon(Icons.star), findsNWidgets(4));
      expect(find.byIcon(Icons.star_border), findsOneWidget);
    });

    testWidgets('el envío queda bloqueado hasta elegir estrellas',
        (tester) async {
      var envios = 0;
      final repo = repoCon(MockClient((req) async {
        if (req.method == 'POST') envios++;
        return respuesta(ordenesJson([orden(estado: 'cumplida')]));
      }));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Calificar'));
      await tester.pumpAndSettle();

      expect(find.text('¿Cómo te fue?'), findsOneWidget);

      // Sin estrellas la API rechazaría el envío, así que el botón está apagado.
      final enviar = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Enviar'),
      );
      expect(enviar.onPressed, isNull);

      await tester.tap(find.text('Enviar'));
      await tester.pumpAndSettle();
      expect(envios, 0);
      expect(find.text('¿Cómo te fue?'), findsOneWidget); // sigue abierto
    });

    testWidgets('sin pedidos, invita en vez de mostrar una pantalla vacía',
        (tester) async {
      final repo =
          repoCon(MockClient((_) async => respuesta(ordenesJson([]))));

      await tester.pumpWidget(envolver(PantallaPedidos(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no tenés pedidos'), findsOneWidget);
    });
  });
}
