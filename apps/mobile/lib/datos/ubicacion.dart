import 'package:geolocator/geolocator.dart';

/// Por qué no hay ubicación, cuando no la hay.
///
/// Se distinguen porque cada una pide una respuesta distinta de la persona:
/// activar el GPS no es lo mismo que conceder un permiso, y un permiso negado
/// para siempre solo se arregla desde los ajustes del sistema.
enum FalloUbicacion {
  servicioApagado,
  permisoDenegado,
  permisoDenegadoParaSiempre,
  noDisponible,
}

class UbicacionExcepcion implements Exception {
  UbicacionExcepcion(this.motivo);

  final FalloUbicacion motivo;

  /// Mensaje accionable: dice qué hacer, no solo qué falló.
  String get mensaje => switch (motivo) {
        FalloUbicacion.servicioApagado =>
          'La ubicación está apagada. Activala para ver ofertas cerca tuyo.',
        FalloUbicacion.permisoDenegado =>
          'Necesitamos tu ubicación para mostrarte lo que hay cerca.',
        FalloUbicacion.permisoDenegadoParaSiempre =>
          'Bloqueaste el acceso a la ubicación. Podés habilitarlo desde los '
              'ajustes del sistema.',
        FalloUbicacion.noDisponible =>
          'No pudimos obtener tu ubicación. Intentá de nuevo.',
      };

  @override
  String toString() => mensaje;
}

class Coordenada {
  const Coordenada(this.lat, this.lng);
  final double lat;
  final double lng;
}

/// Acceso a la ubicación del dispositivo.
///
/// Envuelto en una clase propia para que las pantallas no dependan del paquete
/// y para poder sustituirlo en las pruebas: pedir el GPS de verdad dentro de
/// una prueba de widget no es viable.
class ServicioUbicacion {
  const ServicioUbicacion();

  Future<Coordenada> actual() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw UbicacionExcepcion(FalloUbicacion.servicioApagado);
    }

    var permiso = await Geolocator.checkPermission();
    if (permiso == LocationPermission.denied) {
      permiso = await Geolocator.requestPermission();
    }
    if (permiso == LocationPermission.deniedForever) {
      throw UbicacionExcepcion(FalloUbicacion.permisoDenegadoParaSiempre);
    }
    if (permiso == LocationPermission.denied) {
      throw UbicacionExcepcion(FalloUbicacion.permisoDenegado);
    }

    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          // Precisión media y con tope de tiempo: para decidir qué panadería
          // queda cerca sobran unos metros, y esperar a una lectura fina deja
          // la pantalla colgada en interiores.
          timeLimit: Duration(seconds: 12),
        ),
      );
      return Coordenada(p.latitude, p.longitude);
    } catch (_) {
      throw UbicacionExcepcion(FalloUbicacion.noDisponible);
    }
  }
}
