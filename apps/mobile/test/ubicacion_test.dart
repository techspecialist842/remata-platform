import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:remata_movil/datos/api.dart';
import 'package:remata_movil/datos/repositorio.dart';
import 'package:remata_movil/datos/ubicacion.dart';
import 'package:remata_movil/design/componentes.dart';
import 'package:remata_movil/design/tema.dart';
import 'package:remata_movil/pantallas/catalogo.dart';
import 'package:remata_movil/pantallas/cuenta_comercio.dart';

/// Búsqueda por cercanía y punto de retiro.
///
/// Lo que importa aquí no es que las pantallas pinten, sino qué hacen cuando la
/// ubicación falla: negar el permiso es el caso corriente, no el excepcional, y
/// la app no puede quedarse a medias ni fingir que sabe dónde está la persona.

http.Response respuesta(String cuerpo, [int codigo = 200]) => http.Response(
      cuerpo,
      codigo,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Repositorio repoCon(MockClient cliente) =>
    Repositorio(ApiCliente(baseUrl: 'https://t.test', cliente: cliente));

Widget envolver(Widget hijo) =>
    MaterialApp(theme: construirTema(), home: hijo);

/// Ubicación simulada: devuelve un punto fijo o el fallo que se le pida.
class UbicacionFalsa implements ServicioUbicacion {
  UbicacionFalsa.en(this.punto) : falla = null;
  UbicacionFalsa.falla(this.falla) : punto = null;

  final Coordenada? punto;
  final FalloUbicacion? falla;
  int llamadas = 0;

  @override
  Future<Coordenada> actual() async {
    llamadas++;
    if (falla != null) throw UbicacionExcepcion(falla!);
    return punto!;
  }
}

Map<String, dynamic> rescate({double? distanciaKm}) => {
      'id': 'r1',
      'titulo': 'Pan artesanal',
      'descripcion': null,
      'categoria': null,
      'precioCentavos': 360,
      'precioOriginalCentavos': null,
      'moneda': 'USD',
      'cantidadDisponible': 4,
      'cantidadTotal': 4,
      'status': 'publicado',
      'validoHasta':
          DateTime.now().add(const Duration(hours: 5)).toIso8601String(),
      'distanciaKm': ?distanciaKm,
    };

String pagina(List<Map<String, dynamic>> items) => jsonEncode({
      'items': items,
      'total': items.length,
      'page': 1,
      'pageSize': 20,
    });

void main() {
  group('Texto de distancia', () {
    // Por debajo del kilómetro, metros: «a 340 m» se entiende de un vistazo.
    test('usa metros por debajo del kilómetro', () {
      expect(distanciaTexto(0.34), 'a 340 m');
      expect(distanciaTexto(0.05), 'a 50 m');
      expect(distanciaTexto(0.999), 'a 1000 m');
    });

    test('usa kilómetros con un decimal a partir de uno', () {
      expect(distanciaTexto(1.0), 'a 1.0 km');
      expect(distanciaTexto(3.54), 'a 3.5 km');
      expect(distanciaTexto(18.13), 'a 18.1 km');
    });

    // Redondear a la decena evita fingir una precisión que el GPS no da.
    test('redondea los metros a la decena', () {
      expect(distanciaTexto(0.347), 'a 350 m');
      expect(distanciaTexto(0.341), 'a 340 m');
    });
  });

  group('Catálogo por cercanía', () {
    testWidgets('sin filtro no pide la ubicación ni manda coordenadas',
        (tester) async {
      Uri? pedida;
      final ubi = UbicacionFalsa.en(const Coordenada(8.98, -79.52));
      final repo = repoCon(MockClient((req) async {
        pedida = req.url;
        return respuesta(pagina([rescate()]));
      }));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();

      expect(ubi.llamadas, 0);
      expect(pedida!.queryParameters.containsKey('lat'), isFalse);
    });

    testWidgets('al activarlo manda las coordenadas y muestra la distancia',
        (tester) async {
      Uri? ultima;
      final ubi = UbicacionFalsa.en(const Coordenada(8.98, -79.52));
      final repo = repoCon(MockClient((req) async {
        ultima = req.url;
        return respuesta(pagina([
          rescate(distanciaKm: req.url.queryParameters.containsKey('lat')
              ? 3.54
              : null)
        ]));
      }));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Cerca de ti'));
      await tester.pumpAndSettle();

      expect(ubi.llamadas, 1);
      expect(ultima!.queryParameters['lat'], '8.98');
      expect(ultima!.queryParameters['lng'], '-79.52');
      expect(ultima!.queryParameters['radioKm'], '5.0');
      expect(find.text('a 3.5 km'), findsOneWidget);
    });

    // Negar el permiso es corriente. La app debe decirlo y quedarse como
    // estaba, no dejar la pantalla girando ni buscar con coordenadas falsas.
    testWidgets('un permiso denegado se explica y no cambia la búsqueda',
        (tester) async {
      var consultas = 0;
      final ubi = UbicacionFalsa.falla(FalloUbicacion.permisoDenegado);
      final repo = repoCon(MockClient((req) async {
        consultas++;
        expect(req.url.queryParameters.containsKey('lat'), isFalse);
        return respuesta(pagina([rescate()]));
      }));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();
      final antes = consultas;

      await tester.tap(find.text('Cerca de ti'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Necesitamos tu ubicación'), findsOneWidget);
      expect(consultas, antes, reason: 'no debe rebuscar sin ubicación');
      // El chip vuelve a su estado apagado, no se queda a medias.
      expect(find.text('Cerca de ti'), findsOneWidget);
    });

    testWidgets('el GPS apagado se distingue del permiso negado',
        (tester) async {
      final ubi = UbicacionFalsa.falla(FalloUbicacion.servicioApagado);
      final repo =
          repoCon(MockClient((_) async => respuesta(pagina([rescate()]))));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerca de ti'));
      await tester.pumpAndSettle();

      expect(find.textContaining('está apagada'), findsOneWidget);
    });

    testWidgets('apagar el filtro no vuelve a pedir la ubicación',
        (tester) async {
      final ubi = UbicacionFalsa.en(const Coordenada(8.98, -79.52));
      final repo =
          repoCon(MockClient((_) async => respuesta(pagina([rescate()]))));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Cerca de ti'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerca de ti (5 km)'));
      await tester.pumpAndSettle();

      expect(ubi.llamadas, 1);
      expect(find.text('Cerca de ti'), findsOneWidget);
    });

    // Vacío por cercanía y vacío a secas piden salidas distintas.
    testWidgets('sin resultados cerca ofrece ampliar la búsqueda',
        (tester) async {
      final ubi = UbicacionFalsa.en(const Coordenada(8.98, -79.52));
      final repo = repoCon(MockClient((req) async => respuesta(
            pagina(req.url.queryParameters.containsKey('lat') ? [] : [rescate()]),
          )));

      await tester.pumpWidget(
          envolver(PantallaCatalogo(repo: repo, ubicacion: ubi)));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerca de ti'));
      await tester.pumpAndSettle();

      expect(find.text('Nada cerca de ti ahora'), findsOneWidget);
      expect(find.text('Buscar en toda la ciudad'), findsOneWidget);
      expect(find.text('Sin ofertas por ahora'), findsNothing);
    });
  });

  group('Punto de retiro del comercio', () {
    MockClient clienteComercio({
      String? direccion,
      double? lat,
      double? lng,
      void Function(Map<String, dynamic>)? alGuardar,
    }) =>
        MockClient((req) async {
          if (req.method == 'PATCH') {
            alGuardar?.call(jsonDecode(req.body) as Map<String, dynamic>);
            return respuesta(jsonEncode({
              'id': 'm1',
              'legalName': 'Panadería La Espiga',
              'isVerified': false,
              'direccion': direccion,
              'latitud': lat,
              'longitud': lng,
            }));
          }
          if (req.url.path.endsWith('/mi-comercio')) {
            return respuesta(jsonEncode({
              'id': 'm1',
              'legalName': 'Panadería La Espiga',
              'isVerified': false,
              'direccion': direccion,
              'latitud': lat,
              'longitud': lng,
            }));
          }
          return respuesta(jsonEncode({
            'promedio': null,
            'totalResenas': 0,
            'ordenesCumplidas': 0,
            'noShows': 0,
          }));
        });

    Widget pantalla(MockClient c, ServicioUbicacion u) => envolver(
          PantallaCuentaComercio(
            repo: repoCon(c),
            alSalir: () {},
            ubicacion: u,
          ),
        );

    // El comercio no se entera solo de que es invisible: hay que decírselo.
    testWidgets('avisa cuando no aparece en las búsquedas por cercanía',
        (tester) async {
      await tester.pumpWidget(pantalla(
        clienteComercio(direccion: 'Av. Balboa 100'),
        UbicacionFalsa.en(const Coordenada(8.98, -79.52)),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Av. Balboa 100'), findsOneWidget);
      expect(find.textContaining('no apareces cuando alguien busca'),
          findsOneWidget);
      expect(find.text('Fijar ubicación'), findsOneWidget);
    });

    testWidgets('con coordenadas no muestra el aviso', (tester) async {
      await tester.pumpWidget(pantalla(
        clienteComercio(direccion: 'Av. Balboa 100', lat: 8.98, lng: -79.52),
        UbicacionFalsa.en(const Coordenada(8.98, -79.52)),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('no apareces cuando alguien busca'),
          findsNothing);
      expect(find.text('Cambiar ubicación'), findsOneWidget);
    });

    testWidgets('sin dirección lo dice en vez de dejarlo en blanco',
        (tester) async {
      await tester.pumpWidget(pantalla(
        clienteComercio(),
        UbicacionFalsa.en(const Coordenada(8.98, -79.52)),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Todavía no has puesto tu dirección'), findsOneWidget);
    });

    testWidgets('guarda la dirección junto con las coordenadas tomadas',
        (tester) async {
      Map<String, dynamic>? enviado;
      await tester.pumpWidget(pantalla(
        clienteComercio(alGuardar: (b) => enviado = b),
        UbicacionFalsa.en(const Coordenada(8.9801, -79.5202)),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Fijar ubicación'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'Calle 50, local 3');
      await tester.tap(find.text('Usar mi ubicación actual'));
      await tester.pumpAndSettle();

      expect(find.text('Ubicación tomada'), findsOneWidget);

      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      expect(enviado!['direccion'], 'Calle 50, local 3');
      expect(enviado!['latitud'], 8.9801);
      expect(enviado!['longitud'], -79.5202);
    });

    // Media coordenada dejaría al comercio invisible sin avisar; el servidor lo
    // rechaza y el cliente no debe llegar a construir ese cuerpo.
    testWidgets('guardar solo la dirección no manda coordenadas',
        (tester) async {
      Map<String, dynamic>? enviado;
      await tester.pumpWidget(pantalla(
        clienteComercio(alGuardar: (b) => enviado = b),
        UbicacionFalsa.falla(FalloUbicacion.permisoDenegado),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Fijar ubicación'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Solo la calle');
      await tester.pumpAndSettle();

      // Escribir tiene que habilitar «Guardar». Se comprueba aparte porque es
      // justo lo que fallaba: el botón leía el texto al construir y escribir no
      // reconstruía nada, así que se quedaba apagado para siempre.
      final guardar = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Guardar'),
      );
      expect(guardar.onPressed, isNotNull);

      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      expect(enviado!['direccion'], 'Solo la calle');
      expect(enviado!.containsKey('latitud'), isFalse);
      expect(enviado!.containsKey('longitud'), isFalse);
    });

    testWidgets('el fallo de ubicación se explica dentro del diálogo',
        (tester) async {
      await tester.pumpWidget(pantalla(
        clienteComercio(),
        UbicacionFalsa.falla(FalloUbicacion.permisoDenegadoParaSiempre),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Fijar ubicación'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Usar mi ubicación actual'));
      await tester.pumpAndSettle();

      expect(find.textContaining('ajustes del sistema'), findsOneWidget);
      // El diálogo sigue abierto: la dirección escrita no se pierde.
      expect(find.text('Punto de retiro'), findsWidgets);
    });
  });
}
