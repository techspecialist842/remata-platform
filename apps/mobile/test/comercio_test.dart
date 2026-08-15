import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/modelos.dart';
import 'package:remata_movil/datos/repositorio.dart';
import 'package:remata_movil/design/tema.dart';
import 'package:remata_movil/pantallas/cuenta_comercio.dart';
import 'package:remata_movil/pantallas/nueva_publicacion.dart';
import 'package:remata_movil/pantallas/ordenes_recibidas.dart';
import 'package:remata_movil/pantallas/publicaciones.dart';

/// Panel del comercio.
///
/// Las acciones de aquí mueven inventario y dinero ajeno, así que lo que se
/// comprueba no es que las pantallas pinten, sino que solo ofrezcan la acción
/// que corresponde al estado —un botón que solo puede devolver 400 es peor que
/// ningún botón— y que los importes crucen la frontera sin perder un céntimo.

http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Repositorio repoCon(MockClient cliente) =>
    Repositorio(ApiCliente(baseUrl: 'https://t.test', cliente: cliente));

Widget envolver(Widget hijo) =>
    MaterialApp(theme: construirTema(), home: hijo);

String pagina(List<Map<String, dynamic>> items) => jsonEncode({
      'items': items,
      'total': items.length,
      'page': 1,
      'pageSize': 20,
    });

Map<String, dynamic> publicacion({
  String id = 'r1',
  String titulo = 'Caja sorpresa',
  String estado = 'borrador',
  int total = 5,
  int disponible = 5,
}) =>
    {
      'id': id,
      'titulo': titulo,
      'descripcion': null,
      'categoria': 'Panadería',
      'precioCentavos': 450,
      'precioOriginalCentavos': 900,
      'moneda': 'PAB',
      'cantidadTotal': total,
      'cantidadDisponible': disponible,
      'status': estado,
      'validoDesde':
          DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
      'validoHasta':
          DateTime.now().add(const Duration(hours: 6)).toIso8601String(),
    };

Map<String, dynamic> ordenRecibida({
  String estado = 'creada',
  String titulo = 'Caja sorpresa',
  int cantidad = 2,
}) =>
    {
      'id': 'o1',
      'numero': 'R-260811-ABCD1234',
      'status': estado,
      'items': [
        {
          'rescateId': 'r1',
          'tituloSnapshot': titulo,
          'precioUnitarioCentavos': 450,
          'cantidad': cantidad,
          'totalLineaCentavos': 450 * cantidad,
        }
      ],
      'subtotalCentavos': 450 * cantidad,
      'descuentoCentavos': 0,
      'totalCentavos': 450 * cantidad,
      'moneda': 'PAB',
      'createdAt': DateTime.now().toIso8601String(),
      'expiraAt':
          DateTime.now().add(const Duration(minutes: 30)).toIso8601String(),
    };

void main() {
  group('Importes escritos a mano', () {
    test('acepta las formas en que se escribe un precio', () {
      expect(aCentavos('4.50'), 450);
      expect(aCentavos('4,50'), 450); // coma decimal, como se usa acá
      expect(aCentavos('12'), 1200);
      expect(aCentavos('12.5'), 1250); // un solo decimal
      expect(aCentavos('0.05'), 5);
      expect(aCentavos(' 7.25 '), 725);
    });

    test('rechaza lo que no es un importe', () {
      for (final malo in ['', 'abc', '4.567', '-3', '4.5.6', '1e3', '.5']) {
        expect(aCentavos(malo), isNull, reason: 'debería rechazar "$malo"');
      }
    });

    // 12.10 * 100 da 1209.9999... en coma flotante. Redondear a mano es la
    // clase de atajo que pierde un céntimo por operación.
    test('no pierde céntimos en los casos que rompen la coma flotante', () {
      expect(aCentavos('12.10'), 1210);
      expect(aCentavos('1.15'), 115);
      expect(aCentavos('8.20'), 820);
      expect(aCentavos('35.35'), 3535);
    });
  });

  group('Mis publicaciones', () {
    testWidgets('un borrador se puede publicar, no pausar', (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(pagina([publicacion(estado: 'borrador')]))));

      await tester.pumpWidget(envolver(PantallaPublicaciones(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Borrador'), findsOneWidget);
      expect(find.text('Publicar'), findsOneWidget);
      expect(find.text('Pausar'), findsNothing);
    });

    testWidgets('lo publicado se puede pausar, no publicar de nuevo',
        (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(pagina([publicacion(estado: 'publicado')]))));

      await tester.pumpWidget(envolver(PantallaPublicaciones(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('En el catálogo'), findsOneWidget);
      expect(find.text('Pausar'), findsOneWidget);
      expect(find.text('Publicar'), findsNothing);
    });

    // Vencido, agotado y retirado no admiten transición desde el panel: son
    // decisiones del sistema o de moderación.
    testWidgets('no ofrece acciones sobre estados que la API no acepta',
        (tester) async {
      for (final estado in ['vencido', 'agotado', 'retirado']) {
        final repo = repoCon(MockClient(
            (_) async => respuesta(pagina([publicacion(estado: estado)]))));

        await tester.pumpWidget(envolver(PantallaPublicaciones(repo: repo)));
        await tester.pumpAndSettle();

        expect(find.text('Publicar'), findsNothing, reason: estado);
        expect(find.text('Pausar'), findsNothing, reason: estado);
      }
    });

    testWidgets('avisa que pausar no cancela las reservas ya hechas',
        (tester) async {
      final repo = repoCon(MockClient((_) async => respuesta(pagina([
            publicacion(estado: 'publicado', total: 5, disponible: 2),
          ]))));

      await tester.pumpWidget(envolver(PantallaPublicaciones(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('3 vendidas'), findsOneWidget);
      expect(
        find.textContaining('las reservas ya hechas'),
        findsOneWidget,
      );
    });

    testWidgets('sin publicaciones, orienta en vez de dejar la pantalla vacía',
        (tester) async {
      final repo =
          repoCon(MockClient((_) async => respuesta(pagina([]))));

      await tester.pumpWidget(envolver(PantallaPublicaciones(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no publicaste nada'), findsOneWidget);
    });
  });

  group('Órdenes recibidas', () {
    testWidgets('dice qué se pidió, no solo el número de orden',
        (tester) async {
      final repo = repoCon(MockClient((_) async =>
          respuesta(pagina([ordenRecibida(titulo: 'Pan del día', cantidad: 3)]))));

      await tester.pumpWidget(envolver(PantallaOrdenesRecibidas(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('R-260811-ABCD1234'), findsOneWidget);
      expect(find.text('3 × Pan del día'), findsOneWidget);
    });

    testWidgets('una orden nueva se confirma o se rechaza', (tester) async {
      final repo = repoCon(
          MockClient((_) async => respuesta(pagina([ordenRecibida()]))));

      await tester.pumpWidget(envolver(PantallaOrdenesRecibidas(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Esperando tu confirmación'), findsOneWidget);
      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.text('No puedo prepararla'), findsOneWidget);
      // Todavía no se puede entregar: hay que confirmar antes.
      expect(find.text('Entregada'), findsNothing);
      expect(find.text('No se presentó'), findsNothing);
    });

    testWidgets('una orden confirmada se entrega o se marca no-show',
        (tester) async {
      final repo = repoCon(MockClient((_) async =>
          respuesta(pagina([ordenRecibida(estado: 'confirmada')]))));

      await tester.pumpWidget(envolver(PantallaOrdenesRecibidas(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Entregada'), findsOneWidget);
      expect(find.text('No se presentó'), findsOneWidget);
      expect(find.text('Confirmar'), findsNothing);
    });

    testWidgets('una orden cerrada no ofrece ninguna acción', (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(pagina([ordenRecibida(estado: 'cumplida')]))));

      await tester.pumpWidget(envolver(PantallaOrdenesRecibidas(repo: repo)));
      await tester.pumpAndSettle();

      expect(find.text('Confirmar'), findsNothing);
      expect(find.text('No se presentó'), findsNothing);
      expect(find.text('No puedo prepararla'), findsNothing);
    });

    // El no-show queda en la reputación de otra persona: no puede dispararse
    // de un toque accidental.
    testWidgets('marcar no-show pide confirmación antes de llamar a la API',
        (tester) async {
      var llamadas = 0;
      final repo = repoCon(MockClient((req) async {
        if (req.method == 'PATCH') llamadas++;
        return respuesta(pagina([ordenRecibida(estado: 'confirmada')]));
      }));

      await tester.pumpWidget(envolver(PantallaOrdenesRecibidas(repo: repo)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('No se presentó'));
      await tester.pumpAndSettle();

      expect(find.text('¿El comprador no se presentó?'), findsOneWidget);
      expect(llamadas, 0);

      await tester.tap(find.text('No, volver'));
      await tester.pumpAndSettle();
      expect(llamadas, 0);
    });
  });

  group('Mi comercio', () {
    /// La pantalla encadena dos llamadas: perfil y, con su id, reputación.
    MockClient clienteCon({
      double? promedio,
      int resenas = 0,
      int cumplidas = 0,
      int noShows = 0,
      bool verificado = false,
    }) =>
        MockClient((req) async {
          if (req.url.path.endsWith('/mi-comercio')) {
            return respuesta(jsonEncode({
              'id': 'm1',
              'legalName': 'Panadería La Espiga',
              'isVerified': verificado,
            }));
          }
          // Solo responde si preguntan por el id que devolvió el perfil: así la
          // prueba falla si la pantalla usa el userId por descuido.
          if (req.url.path.endsWith('/reputacion/m1')) {
            return respuesta(jsonEncode({
              'promedio': promedio,
              'totalResenas': resenas,
              'ordenesCumplidas': cumplidas,
              'noShows': noShows,
            }));
          }
          return respuesta(jsonEncode({'message': 'ruta inesperada'}), 404);
        });

    Widget pantalla(MockClient c) => envolver(
          PantallaCuentaComercio(repo: repoCon(c), alSalir: () {}),
        );

    testWidgets('muestra el nombre y la calificación media', (tester) async {
      await tester.pumpWidget(
          pantalla(clienteCon(promedio: 4.7, resenas: 12, cumplidas: 30)));
      await tester.pumpAndSettle();

      expect(find.text('Panadería La Espiga'), findsOneWidget);
      expect(find.text('4.7'), findsOneWidget);
      expect(find.text('de 12 reseñas'), findsOneWidget);
      expect(find.text('30 órdenes entregadas'), findsOneWidget);
    });

    // Un comercio nuevo no debe aparecer con un 0: sería acusarlo de algo que
    // nadie dijo. Sin reseñas no hay nota.
    testWidgets('sin reseñas no inventa una nota de cero', (tester) async {
      await tester.pumpWidget(pantalla(clienteCon(cumplidas: 3)));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no te calificaron'), findsOneWidget);
      expect(find.text('0.0'), findsNothing);
      // Las entregas sí se cuentan aunque nadie haya calificado.
      expect(find.text('3 órdenes entregadas'), findsOneWidget);
    });

    // El verde de la etiqueta afirma un logro; en cero no hay ninguno.
    testWidgets('un comercio recién creado no exhibe contadores en cero',
        (tester) async {
      await tester.pumpWidget(pantalla(clienteCon()));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no te calificaron'), findsOneWidget);
      expect(find.textContaining('0 órdenes'), findsNothing);
      expect(find.textContaining('no retir'), findsNothing);
    });

    // La API apunta el no-show contra el comprador que no retiró, nunca contra
    // el comercio: este contador siempre vale cero en su propia ficha. Se
    // ignora aunque venga con valor, para no exhibir una cifra inventada.
    testWidgets('no muestra los no-shows aunque la API los devuelva',
        (tester) async {
      await tester.pumpWidget(pantalla(
          clienteCon(promedio: 5, resenas: 2, cumplidas: 2, noShows: 3)));
      await tester.pumpAndSettle();

      expect(find.textContaining('no retir'), findsNothing);
      expect(find.textContaining('3'), findsNothing);
    });

    testWidgets('concuerda en singular con un solo caso', (tester) async {
      await tester.pumpWidget(
          pantalla(clienteCon(promedio: 4, resenas: 1, cumplidas: 1)));
      await tester.pumpAndSettle();

      expect(find.text('de 1 reseña'), findsOneWidget);
      expect(find.text('1 orden entregada'), findsOneWidget);
    });

    // Se dice también cuando NO está verificado: callarlo dejaría creer que la
    // verificación no existe.
    testWidgets('dice cuando la verificación está pendiente', (tester) async {
      await tester.pumpWidget(pantalla(clienteCon()));
      await tester.pumpAndSettle();

      expect(find.text('Verificación pendiente'), findsOneWidget);
      expect(find.text('Comercio verificado'), findsNothing);
    });

    testWidgets('dice cuando el comercio está verificado', (tester) async {
      await tester.pumpWidget(pantalla(clienteCon(verificado: true)));
      await tester.pumpAndSettle();

      expect(find.text('Comercio verificado'), findsOneWidget);
      expect(find.text('Verificación pendiente'), findsNothing);
    });

    testWidgets('un fallo se comunica y permite reintentar', (tester) async {
      final repo = repoCon(MockClient(
          (_) async => respuesta(jsonEncode({'message': 'caído'}), 500)));

      await tester.pumpWidget(
          envolver(PantallaCuentaComercio(repo: repo, alSalir: () {})));
      await tester.pumpAndSettle();

      expect(find.text('No pudimos cargar tu comercio'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  group('Rol de la sesión', () {
    // El rol se lee del propio token. No es una frontera de seguridad —el
    // servidor lo revalida— pero decide qué app ve la persona.
    String tokenCon(String rol) {
      String seg(Map<String, dynamic> m) =>
          base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
      return '${seg({'alg': 'HS256'})}.${seg({'sub': 'u1', 'role': rol})}.firma';
    }

    test('reconoce a un comercio', () {
      final api = ApiCliente(baseUrl: 'https://t.test');
      api.establecerSesion(tokenCon('comercio'), 'refresh');
      expect(Repositorio(api).esComercio, isTrue);
    });

    test('un usuario común no entra al panel del comercio', () {
      final api = ApiCliente(baseUrl: 'https://t.test');
      api.establecerSesion(tokenCon('usuario'), 'refresh');
      expect(Repositorio(api).esComercio, isFalse);
    });

    test('un token ilegible no rompe la app: cae a comprador', () {
      final api = ApiCliente(baseUrl: 'https://t.test');
      api.establecerSesion('esto-no-es-un-jwt', 'refresh');
      expect(Repositorio(api).esComercio, isFalse);
    });

    test('cerrar sesión olvida el rol', () {
      final api = ApiCliente(baseUrl: 'https://t.test');
      api.establecerSesion(tokenCon('comercio'), 'refresh');
      api.cerrarSesion();
      expect(api.rol, isNull);
      expect(api.autenticado, isFalse);
    });
  });

  group('Órdenes con líneas', () {
    test('resume lo pedido de forma legible', () {
      final orden = Orden.desdeJson(ordenRecibida(titulo: 'Croissants'));
      expect(orden.resumen, '2 × Croissants');
    });

    test('una orden sin líneas no finge tener detalle', () {
      final j = ordenRecibida()..remove('items');
      expect(Orden.desdeJson(j).resumen, 'Sin detalle');
    });
  });
}