import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/ubicacion.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';
import 'detalle.dart';

/// Catálogo: buscador y listado de ofertas vigentes.
/// Corresponde al capítulo 2 de los mockups (exploración y búsqueda).
class PantallaCatalogo extends StatefulWidget {
  const PantallaCatalogo({
    super.key,
    required this.repo,
    // Inyectable para poder probar la pantalla: pedir el GPS de verdad dentro
    // de una prueba de widget no es viable.
    this.ubicacion = const ServicioUbicacion(),
  });

  final Repositorio repo;
  final ServicioUbicacion ubicacion;

  @override
  State<PantallaCatalogo> createState() => _PantallaCatalogoState();
}

class _PantallaCatalogoState extends State<PantallaCatalogo> {
  final _busqueda = TextEditingController();
  late Future<Pagina<Rescate>> _futuro;

  Coordenada? _cerca;
  bool _ubicando = false;

  @override
  void initState() {
    super.initState();
    _futuro = widget.repo.buscarRescates();
  }

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  void _buscar() {
    setState(() {
      _futuro = widget.repo.buscarRescates(
        q: _busqueda.text.trim(),
        cerca: _cerca,
      );
    });
  }

  /// Enciende o apaga el filtro por cercanía.
  ///
  /// Apagarlo no necesita permisos ni espera; encenderlo sí, y si la persona lo
  /// niega el filtro se queda apagado en vez de dejar la pantalla a medias.
  Future<void> _alternarCercania() async {
    if (_cerca != null) {
      setState(() => _cerca = null);
      _buscar();
      return;
    }

    setState(() => _ubicando = true);
    try {
      final punto = await widget.ubicacion.actual();
      if (!mounted) return;
      setState(() {
        _cerca = punto;
        _ubicando = false;
      });
      _buscar();
    } on UbicacionExcepcion catch (e) {
      if (!mounted) return;
      setState(() => _ubicando = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  RTokens.s4, RTokens.s4, RTokens.s4, RTokens.s3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('¿Qué ofertas buscas hoy?',
                      style: RTokens.titleL),
                  const SizedBox(height: RTokens.s3),
                  TextField(
                    controller: _busqueda,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _buscar(),
                    decoration: InputDecoration(
                      hintText: 'Buscar productos, comercios...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _busqueda.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () {
                                _busqueda.clear();
                                _buscar();
                              },
                            ),
                    ),
                  ),
                  const SizedBox(height: RTokens.s3),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilterChip(
                      selected: _cerca != null,
                      onSelected:
                          _ubicando ? null : (_) => _alternarCercania(),
                      avatar: _ubicando
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              _cerca != null
                                  ? Icons.my_location
                                  : Icons.location_searching,
                              size: 18,
                            ),
                      label: Text(
                        _cerca != null ? 'Cerca de ti (5 km)' : 'Cerca de ti',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => _buscar(),
                child: FutureBuilder<Pagina<Rescate>>(
                  future: _futuro,
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snap.hasError) {
                      return EstadoVacio(
                        icono: Icons.cloud_off,
                        titulo: 'No pudimos cargar las ofertas',
                        detalle: '${snap.error}',
                        accion: OutlinedButton(
                          onPressed: _buscar,
                          child: const Text('Reintentar'),
                        ),
                      );
                    }

                    final pagina = snap.data!;
                    if (pagina.items.isEmpty) {
                      // Vacío por cercanía y vacío a secas no son lo mismo: en
                      // el primero la salida es ampliar el radio, y decir «no
                      // hay ofertas» a secas sería falso.
                      return EstadoVacio(
                        icono: _cerca != null
                            ? Icons.location_off
                            : Icons.search_off,
                        titulo: _cerca != null
                            ? 'Nada cerca de ti ahora'
                            : 'Sin ofertas por ahora',
                        detalle: _cerca != null
                            ? 'No hay rescates a menos de 5 km. Prueba quitando '
                                'el filtro de cercanía.'
                            : 'No encontramos rescates disponibles con esa '
                                'búsqueda.',
                        accion: _cerca == null
                            ? null
                            : OutlinedButton(
                                onPressed: _alternarCercania,
                                child: const Text('Buscar en toda la ciudad'),
                              ),
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                          RTokens.s4, 0, RTokens.s4, RTokens.s6),
                      itemCount: pagina.items.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: RTokens.s3),
                      itemBuilder: (_, i) => _TarjetaRescate(
                        rescate: pagina.items[i],
                        alTocar: () async {
                          final compro = await Navigator.of(context).push<bool>(
                            MaterialPageRoute(
                              builder: (_) => PantallaDetalle(
                                repo: widget.repo,
                                rescateId: pagina.items[i].id,
                              ),
                            ),
                          );
                          // Tras una compra el stock cambió: recargar evita
                          // mostrar disponibilidad ya obsoleta.
                          if (compro == true) _buscar();
                        },
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TarjetaRescate extends StatelessWidget {
  const _TarjetaRescate({required this.rescate, required this.alTocar});

  final Rescate rescate;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final descuento = rescate.descuentoPorcentaje;
    return Card(
      child: InkWell(
        onTap: alTocar,
        borderRadius: BorderRadius.circular(RTokens.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(RTokens.s3),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ImagenRescate(semilla: rescate.id),
                  if (descuento != null)
                    Positioned(
                      top: 4,
                      left: 4,
                      child: InsigniaDescuento(descuento),
                    ),
                ],
              ),
              const SizedBox(width: RTokens.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rescate.titulo,
                      style: RTokens.titleM,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (rescate.descripcion != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        rescate.descripcion!,
                        style: RTokens.bodySm,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: RTokens.s2),
                    Precio(
                      centavos: rescate.precioCentavos,
                      originalCentavos: rescate.precioOriginalCentavos,
                      moneda: rescate.moneda,
                    ),
                    const SizedBox(height: RTokens.s2),
                    Wrap(
                      spacing: RTokens.s2,
                      runSpacing: RTokens.s1,
                      children: [
                        Etiqueta(
                          tiempoRestanteTexto(rescate.tiempoRestante),
                          fondo: RTokens.warningSoft,
                          color: RTokens.warning,
                        ),
                        Etiqueta(
                          disponiblesTexto(rescate.cantidadDisponible),
                          fondo: RTokens.successSoft,
                          color: RTokens.success,
                        ),
                        // Solo cuando se buscó por cercanía: en el resto de
                        // búsquedas el servidor no manda distancia, y
                        // inventarla sería mentir sobre dónde está el local.
                        // El tipo va en la tarjeta: una caja sorpresa no se
                        // compra con las mismas expectativas que una unidad.
                        if (rescate.tipo != TipoOferta.unitario)
                          Etiqueta(rescate.tipo.etiqueta,
                              fondo: RTokens.primarySoft,
                              color: RTokens.primary),
                        if (rescate.distanciaKm != null)
                          Etiqueta(
                            distanciaTexto(rescate.distanciaKm!),
                            fondo: RTokens.primarySoft,
                            color: RTokens.primary,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
