import 'package:flutter_test/flutter_test.dart';
import 'package:remata_movil/datos/modelos.dart';
import 'package:remata_movil/datos/ubicacion.dart';
import 'package:remata_movil/pantallas/mapa.dart';

/// El mapa de ofertas cercanas.
///
/// El mapa en sí no se puede dibujar en una prueba: necesita el SDK nativo de
/// Google, que no existe fuera de un teléfono. Por eso las decisiones que
/// pueden equivocarse —qué se marca, dónde se centra, cuánto se acerca— viven
/// en funciones sueltas, y es lo que se comprueba aquí.
///
/// Lo que queda sin cubrir, y conviene decirlo: que el mapa se pinte, que los
/// marcadores se vean y que el toque abra la ficha. Eso solo se comprueba en un
/// dispositivo.

Rescate oferta({
  String id = 'r1',
  String titulo = 'Pan del día',
  int precio = 450,
  double? lat,
  double? lng,
}) =>
    Rescate(
      id: id,
      titulo: titulo,
      tipo: TipoOferta.unitario,
      descripcion: null,
      categoria: null,
      precioCentavos: precio,
      precioOriginalCentavos: null,
      moneda: 'USD',
      cantidadDisponible: 3,
      cantidadTotal: 3,
      estado: EstadoRescate.publicado,
      validoDesde: DateTime.now().subtract(const Duration(hours: 1)),
      validoHasta: DateTime.now().add(const Duration(hours: 4)),
      puntoLat: lat,
      puntoLng: lng,
    );

void main() {
  group('marcadores', () {
    test('uno por oferta con punto de retiro', () {
      final m = marcadoresDe([
        oferta(id: 'a', lat: 8.98, lng: -79.52),
        oferta(id: 'b', lat: 8.95, lng: -79.53),
      ]);

      expect(m, hasLength(2));
      expect(
        m.map((x) => x.markerId.value).toSet(),
        {'a', 'b'},
      );
    });

    // Un comercio sin punto de retiro no se puede dibujar. Colocarlo en 0,0
    // —frente a la costa de África— sería peor que omitirlo.
    test('una oferta sin coordenadas no se dibuja', () {
      final m = marcadoresDe([
        oferta(id: 'con', lat: 8.98, lng: -79.52),
        oferta(id: 'sin'),
      ]);

      expect(m.map((x) => x.markerId.value), ['con']);
    });

    test('media coordenada tampoco vale', () {
      expect(marcadoresDe([oferta(lat: 8.98)]), isEmpty);
      expect(marcadoresDe([oferta(lng: -79.52)]), isEmpty);
    });

    test('el marcador lleva título y precio legible', () {
      final m = marcadoresDe([
        oferta(titulo: 'Bollos', precio: 450, lat: 8.98, lng: -79.52),
      ]).single;

      expect(m.infoWindow.title, 'Bollos');
      expect(m.infoWindow.snippet, contains('4.50'));
    });

    test('el marcador se coloca donde dice la oferta', () {
      final m = marcadoresDe([oferta(lat: 8.9824, lng: -79.5199)]).single;

      expect(m.position.latitude, 8.9824);
      expect(m.position.longitude, -79.5199);
    });
  });

  group('encuadre', () {
    const centro = Coordenada(8.98, -79.52);

    // Se centra en quien busca, no en las ofertas: con el promedio de los
    // comercios, una sola oferta lejana arrastraría el mapa y la persona
    // dejaría de verse en él.
    test('se centra en quien busca', () {
      final c = encuadreDe(centro);
      expect(c.target.latitude, 8.98);
      expect(c.target.longitude, -79.52);
    });

    test('un radio más grande se ve más lejos', () {
      expect(encuadreDe(centro, radioKm: 20).zoom,
          lessThan(encuadreDe(centro, radioKm: 5).zoom));
    });

    test('un radio más pequeño se ve más de cerca', () {
      expect(encuadreDe(centro, radioKm: 1).zoom,
          greaterThan(encuadreDe(centro, radioKm: 5).zoom));
    });

    // Sin tope, un radio absurdo dejaría ver el continente o metería la cámara
    // dentro de una manzana. Ninguna de las dos responde «qué hay cerca».
    test('el acercamiento queda acotado en los extremos', () {
      for (final r in [0.01, 0.5, 5.0, 50.0, 5000.0]) {
        final z = encuadreDe(centro, radioKm: r).zoom;
        expect(z, greaterThanOrEqualTo(10));
        expect(z, lessThanOrEqualTo(16));
      }
    });
  });
}
