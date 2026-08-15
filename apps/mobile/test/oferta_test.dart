import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/modelos.dart';
import 'package:remata_movil/datos/repositorio.dart';
import 'package:remata_movil/design/tema.dart';
import 'package:remata_movil/pantallas/catalogo.dart';
import 'package:remata_movil/pantallas/detalle.dart';
import 'package:remata_movil/pantallas/nueva_publicacion.dart';

/// Tipos de oferta y código de retiro.
///
/// El tipo cambia lo que quien compra puede esperar, así que lo que se prueba
/// es que se diga —y que se explique cuando no es evidente—, no que la etiqueta
/// exista. Del QR se comprueba lo mismo que en el backend desde el otro lado:
/// que aparece cuando el servidor lo manda y no se inventa cuando no.

http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Repositorio repoCon(MockClient cliente) =>
    Repositorio(ApiCliente(baseUrl: 'https://t.test', cliente: cliente));

Widget envolver(Widget hijo) =>
    MaterialApp(theme: construirTema(), home: hijo);

Map<String, dynamic> rescate({String? tipo, String titulo = 'Sobrante'}) => {
      'id': 'r1',
      'titulo': titulo,
      'tipo': tipo,
      'descripcion': null,
      'categoria': null,
      'precioCentavos': 500,
      'precioOriginalCentavos': null,
      'moneda': 'USD',
      'cantidadDisponible': 3,
      'cantidadTotal': 3,
      'status': 'publicado',
      'validoHasta':
          DateTime.now().add(const Duration(hours: 4)).toIso8601String(),
    };

Map<String, dynamic> orden({String? qrToken}) => {
      'id': 'o1',
      'numero': 'R-260815-AAAA1111',
      'status': 'creada',
      'items': const [],
      'subtotalCentavos': 500,
      'descuentoCentavos': 0,
      'totalCentavos': 500,
      'moneda': 'USD',
      'qrToken': qrToken,
      'createdAt': DateTime.now().toIso8601String(),
      'expiraAt':
          DateTime.now().add(const Duration(minutes: 15)).toIso8601String(),
    };

String pagina(List<Map<String, dynamic>> items) => jsonEncode({
      'items': items,
      'total': items.length,
      'page': 1,
      'pageSize': 20,
    });

void main() {
  group('Tipo de oferta', () {
    // Lo que no declara tipo es un artículo suelto, igual que decide el
    // servidor. Nada de un estado «desconocido» que luego haya que interpretar.
    test('sin tipo declarado se interpreta como unidad', () {
      expect(Rescate.desdeJson(rescate()).tipo, TipoOferta.unitario);
      expect(Rescate.desdeJson(rescate(tipo: 'unitario')).tipo,
          TipoOferta.unitario);
    });

    test('reconoce los tres tipos del catálogo', () {
      expect(Rescate.desdeJson(rescate(tipo: 'caja_sorpresa')).tipo,
          TipoOferta.cajaSorpresa);
      expect(Rescate.desdeJson(rescate(tipo: 'lote')).tipo, TipoOferta.lote);
    });

    // Un tipo que la app no conoce no debe romperla ni inventar una categoría:
    // cae a unidad, que es lo más conservador que se puede mostrar.
    test('un tipo desconocido no rompe la pantalla', () {
      expect(Rescate.desdeJson(rescate(tipo: 'combo_familiar')).tipo,
          TipoOferta.unitario);
    });

    test('los nombres que viajan a la API son los que espera el servidor', () {
      expect(tipoOfertaApi(TipoOferta.unitario), 'unitario');
      expect(tipoOfertaApi(TipoOferta.cajaSorpresa), 'caja_sorpresa');
      expect(tipoOfertaApi(TipoOferta.lote), 'lote');
    });

    testWidgets('el catálogo distingue una caja sorpresa de una unidad',
        (tester) async {
      final repo = repoCon(MockClient((_) async => respuesta(pagina([
            rescate(tipo: 'caja_sorpresa', titulo: 'Sorpresa de panadería'),
            rescate(tipo: 'unitario', titulo: 'Pan suelto'),
          ]))));

      await tester.pumpWidget(envolver(PantallaCatalogo(repo: repo)));
      await tester.pumpAndSettle();

      // Solo se etiqueta lo que no es evidente: marcar cada unidad como
      // «Unidad» sería ruido en todas las tarjetas.
      expect(find.text('Caja sorpresa'), findsOneWidget);
      expect(find.text('Unidad'), findsNothing);
    });

    testWidgets('el detalle explica qué implica una caja sorpresa',
        (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(jsonEncode(rescate(tipo: 'caja_sorpresa')))));

      await tester.pumpWidget(
          envolver(PantallaDetalle(repo: repo, rescateId: 'r1')));
      await tester.pumpAndSettle();

      expect(find.textContaining('El contenido es sorpresa'), findsOneWidget);
    });

    testWidgets('el detalle de una unidad no añade explicación innecesaria',
        (tester) async {
      final repo = repoCon(
          MockClient((_) async => respuesta(jsonEncode(rescate()))));

      await tester.pumpWidget(
          envolver(PantallaDetalle(repo: repo, rescateId: 'r1')));
      await tester.pumpAndSettle();

      expect(find.text('Se vende por unidad.'), findsNothing);
    });

    testWidgets('el comercio elige el tipo y la app lo manda tal cual',
        (tester) async {
      Map<String, dynamic>? enviado;
      final repo = repoCon(MockClient((req) async {
        enviado = jsonDecode(req.body) as Map<String, dynamic>;
        return respuesta(jsonEncode(rescate(tipo: 'lote')), 201);
      }));

      await tester.pumpWidget(
          envolver(PantallaNuevaPublicacion(repo: repo)));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'Qué ofrecés'), 'Lote de fruta');
      await tester.tap(find.text('Lote'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Se lleva completo'), findsOneWidget);

      await tester.enterText(
          find.widgetWithText(TextFormField, 'Precio de venta'), '12,00');

      // El formulario es más alto que la ventana de prueba: hay que llegar al
      // botón como llegaría un dedo, desplazándose.
      await tester.scrollUntilVisible(
        find.text('Guardar como borrador'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Guardar como borrador'));
      await tester.pumpAndSettle();

      expect(enviado!['tipo'], 'lote');
      expect(enviado!['precioCentavos'], 1200);
    });
  });

  group('Código de retiro', () {
    test('solo existe cuando el servidor lo manda', () {
      expect(Orden.desdeJson(orden()).qrToken, isNull);
      expect(Orden.desdeJson(orden(qrToken: 'abc123')).qrToken, 'abc123');
    });

    testWidgets('la confirmación muestra el QR con el token recibido',
        (tester) async {
      final repo = repoCon(MockClient((req) async {
        if (req.method == 'POST') {
          return respuesta(jsonEncode(orden(qrToken: 'token-de-retiro')), 201);
        }
        return respuesta(jsonEncode(rescate()));
      }));

      await tester.pumpWidget(
          envolver(PantallaDetalle(repo: repo, rescateId: 'r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reservar'));
      // pumpAndSettle no sirve acá: la barra de compra deja girando un
      // indicador mientras el diálogo está abierto, y una animación indefinida
      // nunca se asienta.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('¡Reserva confirmada!'), findsOneWidget);
      // El dato del QR es privado en el paquete; la clave lo hace verificable.
      expect(
        find.byKey(const ValueKey('token-de-retiro')),
        findsOneWidget,
      );
      expect(find.byType(QrImageView), findsOneWidget);
      // El número de orden es el respaldo si el código no está a mano.
      expect(find.textContaining('alcanza'), findsOneWidget);
    });

    // Las órdenes anteriores al token no lo tienen. No se dibuja un QR vacío
    // ni se promete un código que no existe.
    testWidgets('sin token no dibuja ningún código', (tester) async {
      final repo = repoCon(MockClient((req) async {
        if (req.method == 'POST') {
          return respuesta(jsonEncode(orden()), 201);
        }
        return respuesta(jsonEncode(rescate()));
      }));

      await tester.pumpWidget(
          envolver(PantallaDetalle(repo: repo, rescateId: 'r1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reservar'));
      // pumpAndSettle no sirve acá: la barra de compra deja girando un
      // indicador mientras el diálogo está abierto, y una animación indefinida
      // nunca se asienta.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('¡Reserva confirmada!'), findsOneWidget);
      expect(find.byType(QrImageView), findsNothing);
      expect(find.textContaining('Mostrá este código'), findsNothing);
    });
  });
}
