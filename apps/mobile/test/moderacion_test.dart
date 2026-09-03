import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/repositorio.dart';
import 'package:remata_movil/design/tema.dart';
import 'package:remata_movil/pantallas/reportar.dart';
import 'package:remata_movil/pantallas/resenas_comercio.dart';

/// Reportar una publicación y responder a una reseña.
///
/// Las dos funciones existían en el servidor desde hacía tiempo, probadas, pero
/// sin pantalla: en la práctica no existían. Lo que se comprueba aquí no es que
/// pinten, sino que digan lo que tienen que decir —reportar no borra nada,
/// responder no cambia la nota— y que no dejen mandar algo inútil.

http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Repositorio repoCon(MockClient c) =>
    Repositorio(ApiCliente(baseUrl: 'https://t.test', cliente: c));

Widget envolver(Widget hijo) =>
    MaterialApp(theme: construirTema(), home: hijo);

String paginaResenas(List<Map<String, dynamic>> items) => jsonEncode({
      'items': items,
      'total': items.length,
      'page': 1,
      'pageSize': 20,
    });

Map<String, dynamic> resena({
  String id = 'r1',
  int calificacion = 4,
  String? comentario = 'Todo bien',
  String? respuesta,
}) =>
    {
      'id': id,
      'calificacion': calificacion,
      'comentario': comentario,
      'respuesta': respuesta,
      'createdAt': '2026-08-17T10:00:00.000Z',
    };

void main() {
  group('Reportar una publicación', () {
    /// Abre el diálogo sobre una pantalla mínima y devuelve lo que se envió.
    Future<void> abrir(WidgetTester tester, Repositorio repo) async {
      await tester.pumpWidget(envolver(
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => mostrarDialogoReporte(
                  context,
                  repo: repo,
                  rescateId: 'resc-1',
                ),
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
    }

    // Lo que más importa del diseño: quien reporta tiene que entender que no
    // está borrando la oferta. Si creyera que sí, reportaría por cualquier
    // cosa, y la cola de moderación dejaría de servir.
    testWidgets('dice que el reporte no tumba la oferta', (tester) async {
      await abrir(tester, repoCon(MockClient((_) async => respuesta('{}'))));

      expect(find.textContaining('no borra la oferta'), findsOneWidget);
    });

    testWidgets('sin motivo no se puede enviar', (tester) async {
      await abrir(tester, repoCon(MockClient((_) async => respuesta('{}'))));

      final enviar = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Enviar'),
      );
      expect(enviar.onPressed, isNull);
    });

    testWidgets('con un motivo elegido ya se puede enviar', (tester) async {
      var enviado = <String, dynamic>{};
      await abrir(
        tester,
        repoCon(MockClient((req) async {
          enviado = jsonDecode(req.body) as Map<String, dynamic>;
          return respuesta('{}', 201);
        })),
      );

      await tester.tap(find.text('El precio no coincide'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Enviar'));
      await tester.pumpAndSettle();

      expect(enviado['motivo'], 'precio_incorrecto');
    });

    // «Otro» sin explicación no le dice nada a quien modera.
    testWidgets('el motivo «otro» exige escribir algo', (tester) async {
      await abrir(tester, repoCon(MockClient((_) async => respuesta('{}', 201))));

      await tester.tap(find.text('Otro motivo'));
      await tester.pumpAndSettle();

      var enviar = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Enviar'),
      );
      expect(enviar.onPressed, isNull, reason: 'sin nota no debería dejar');

      await tester.enterText(find.byType(TextField), 'La foto es de otro local');
      await tester.pumpAndSettle();

      enviar = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Enviar'),
      );
      expect(enviar.onPressed, isNotNull);
    });

    // Reportar dos veces lo mismo no es un error del usuario: ya está hecho.
    testWidgets('reportar dos veces se explica sin parecer un fallo',
        (tester) async {
      await abrir(
        tester,
        repoCon(MockClient((_) async => respuesta(
              jsonEncode({'message': 'Ya reportaste esta publicación'}),
              409,
            ))),
      );

      await tester.tap(find.text('No es lo que dice ser'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Enviar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Ya reportaste'), findsOneWidget);
      expect(find.textContaining('en revisión'), findsOneWidget);
    });
  });

  group('Reseñas del comercio', () {
    testWidgets('sin reseñas orienta en vez de dejar un hueco', (tester) async {
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient((_) async => respuesta(paginaResenas([])))),
        ),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no tienes reseñas'), findsOneWidget);
    });

    testWidgets('muestra la nota y el comentario', (tester) async {
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient((_) async => respuesta(
                paginaResenas([resena(calificacion: 4, comentario: 'Pan fresco')]),
              ))),
        ),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Pan fresco'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsNWidgets(4));
      expect(find.byIcon(Icons.star_border), findsNWidgets(1));
    });

    // Se responde una sola vez: una reseña ya respondida no vuelve a ofrecerlo.
    // Un botón que solo puede devolver 409 es peor que ningún botón.
    testWidgets('una reseña ya respondida no ofrece responder de nuevo',
        (tester) async {
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient((_) async => respuesta(
                paginaResenas([resena(respuesta: 'Gracias por avisar')]),
              ))),
        ),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Gracias por avisar'), findsOneWidget);
      expect(find.text('Tu respuesta'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Responder'), findsNothing);
    });

    testWidgets('responder avisa de que no cambia la nota', (tester) async {
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient(
              (_) async => respuesta(paginaResenas([resena()])))),
        ),
      )));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(TextButton, 'Responder'));
      await tester.pumpAndSettle();

      expect(find.textContaining('No cambia la nota'), findsOneWidget);
      expect(find.textContaining('una vez'), findsOneWidget);
    });

    testWidgets('una respuesta vacía no se puede publicar', (tester) async {
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient(
              (_) async => respuesta(paginaResenas([resena()])))),
        ),
      )));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Responder'));
      await tester.pumpAndSettle();

      var publicar = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Publicar'),
      );
      expect(publicar.onPressed, isNull);

      await tester.enterText(find.byType(TextField), 'Gracias por tu compra');
      await tester.pumpAndSettle();

      publicar = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Publicar'),
      );
      expect(publicar.onPressed, isNotNull);
    });

    testWidgets('al publicar manda el texto a la reseña correcta',
        (tester) async {
      String? ruta;
      Map<String, dynamic>? cuerpo;
      await tester.pumpWidget(envolver(Scaffold(
        body: SeccionResenas(
          repo: repoCon(MockClient((req) async {
            if (req.method == 'POST') {
              ruta = req.url.path;
              cuerpo = jsonDecode(req.body) as Map<String, dynamic>;
              return respuesta('{}', 201);
            }
            return respuesta(paginaResenas([resena(id: 'la-buena')]));
          })),
        ),
      )));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Responder'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Lo tendremos en cuenta');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Publicar'));
      await tester.pumpAndSettle();

      expect(ruta, '/api/v1/ordenes/resenas/la-buena/responder');
      expect(cuerpo?['texto'], 'Lo tendremos en cuenta');
    });
  });
}
