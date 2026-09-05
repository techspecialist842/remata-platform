import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../datos/ubicacion.dart';
import '../design/tokens.dart';
import 'detalle.dart';

/// El mapa de ofertas cercanas.
///
/// Complementa a la lista, no la sustituye: la lista responde «qué hay» y el
/// mapa responde «dónde queda». Quien busca comida para hoy quiere lo primero;
/// quien no conoce el barrio, lo segundo.
///
/// El mapa **no vuelve a buscar**. Recibe lo que la lista ya encontró y lo
/// dibuja. Consultar de nuevo al mover el mapa parece natural y sale caro: cada
/// arrastre serían varias peticiones, y el resultado cambiaría bajo el dedo de
/// quien está mirando.

/// Un marcador por oferta que tenga punto de retiro.
///
/// Función aparte y sin widgets a propósito: el mapa en sí no se puede dibujar
/// en una prueba —necesita el SDK nativo— pero esto sí, y es donde están las
/// decisiones que pueden equivocarse.
Set<Marker> marcadoresDe(
  List<Rescate> ofertas, {
  void Function(Rescate)? alTocar,
}) =>
    ofertas
        .where((o) => o.tienePunto)
        .map(
          (o) => Marker(
            markerId: MarkerId(o.id),
            position: LatLng(o.puntoLat!, o.puntoLng!),
            infoWindow: InfoWindow(
              title: o.titulo,
              snippet: formatearPrecio(o.precioCentavos, moneda: o.moneda),
              onTap: alTocar == null ? null : () => alTocar(o),
            ),
          ),
        )
        .toSet();

/// Dónde centrar la cámara y cuánto acercar.
///
/// Se centra en quien busca, no en las ofertas: si el centro fuera el promedio
/// de los comercios, una sola oferta lejana arrastraría el mapa y la persona
/// no se vería en él.
///
/// El acercamiento sale del radio de búsqueda. Cada nivel de zoom duplica la
/// escala, así que doblar el radio baja un nivel.
CameraPosition encuadreDe(Coordenada centro, {double radioKm = 5}) {
  // 13 encuadra unos 5 km de ancho en un teléfono. Se acota entre 10 y 16 para
  // que ni un radio enorme deje ver el continente ni uno diminuto meta la
  // cámara dentro de una manzana.
  var zoom = 13.0;
  var r = radioKm;
  while (r > 5 && zoom > 10) {
    r /= 2;
    zoom -= 1;
  }
  while (r < 2.5 && zoom < 16) {
    r *= 2;
    zoom += 1;
  }
  return CameraPosition(
    target: LatLng(centro.lat, centro.lng),
    zoom: zoom,
  );
}

class PantallaMapa extends StatelessWidget {
  const PantallaMapa({
    super.key,
    required this.ofertas,
    required this.centro,
    required this.repo,
    this.radioKm = 5,
  });

  final List<Rescate> ofertas;
  final Coordenada centro;
  final Repositorio repo;
  final double radioKm;

  @override
  Widget build(BuildContext context) {
    final conPunto = ofertas.where((o) => o.tienePunto).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Ofertas cerca de ti')),
      body: conPunto.isEmpty
          ? const _SinPuntos()
          : Stack(
              children: [
                GoogleMap(
                  initialCameraPosition: encuadreDe(centro, radioKm: radioKm),
                  markers: marcadoresDe(
                    conPunto,
                    alTocar: (o) => _abrir(context, o),
                  ),
                  // Quien busca necesita verse a sí mismo para que las
                  // distancias signifiquen algo.
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                  // El mapa cabe en media pantalla de un teléfono: los
                  // controles de rotación e inclinación estorban más de lo que
                  // aportan.
                  rotateGesturesEnabled: false,
                  tiltGesturesEnabled: false,
                  mapToolbarEnabled: false,
                ),
                Positioned(
                  left: RTokens.s4,
                  right: RTokens.s4,
                  bottom: RTokens.s4,
                  child: _Contador(cuantas: conPunto.length),
                ),
              ],
            ),
    );
  }

  void _abrir(BuildContext context, Rescate o) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PantallaDetalle(
          repo: repo,
          rescateId: o.id,
        ),
      ),
    );
  }
}

/// Puede haber ofertas cerca y ninguna en el mapa: un comercio sin punto de
/// retiro no se puede dibujar. Decirlo evita que parezca que el mapa falló.
class _SinPuntos extends StatelessWidget {
  const _SinPuntos();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(RTokens.s5),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 48, color: RTokens.textMuted),
              const SizedBox(height: RTokens.s3),
              Text(
                'Ninguna de estas ofertas tiene punto de retiro en el mapa',
                style: RTokens.titleM,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: RTokens.s2),
              Text(
                'Siguen disponibles en la lista.',
                style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
}

class _Contador extends StatelessWidget {
  const _Contador({required this.cuantas});

  final int cuantas;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
          horizontal: RTokens.s4,
          vertical: RTokens.s3,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(RTokens.radiusLg),
          boxShadow: const [
            BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        child: Text(
          cuantas == 1
              ? '1 oferta en el mapa'
              : '$cuantas ofertas en el mapa',
          style: RTokens.body,
          textAlign: TextAlign.center,
        ),
      );
}
