import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';
import 'detalle.dart';

/// Catálogo: buscador y listado de ofertas vigentes.
/// Corresponde al capítulo 2 de los mockups (exploración y búsqueda).
class PantallaCatalogo extends StatefulWidget {
  const PantallaCatalogo({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<PantallaCatalogo> createState() => _PantallaCatalogoState();
}

class _PantallaCatalogoState extends State<PantallaCatalogo> {
  final _busqueda = TextEditingController();
  late Future<Pagina<Rescate>> _futuro;

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
      _futuro = widget.repo.buscarRescates(q: _busqueda.text.trim());
    });
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
                  const Text('¿Qué ofertas buscás hoy?',
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
                      return const EstadoVacio(
                        icono: Icons.search_off,
                        titulo: 'Sin ofertas por ahora',
                        detalle:
                            'No encontramos rescates disponibles con esa búsqueda.',
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
