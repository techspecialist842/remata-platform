import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';
import 'nueva_publicacion.dart';

/// Panel del comercio: sus publicaciones en cualquier estado.
///
/// A diferencia del catálogo público —que solo muestra lo comprable ahora—
/// aquí aparecen también borradores, pausados, agotados y vencidos, porque son
/// justamente los que piden una decisión.
class PantallaPublicaciones extends StatefulWidget {
  const PantallaPublicaciones({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<PantallaPublicaciones> createState() => _PantallaPublicacionesState();
}

class _PantallaPublicacionesState extends State<PantallaPublicaciones> {
  late Future<Pagina<Rescate>> _futuro;

  @override
  void initState() {
    super.initState();
    _recargar();
  }

  void _recargar() {
    setState(() {
      _futuro = widget.repo.misRescates();
    });
  }

  Future<void> _cambiarEstado(Rescate r, bool publicar) async {
    try {
      if (publicar) {
        await widget.repo.publicarRescate(r.id);
      } else {
        await widget.repo.pausarRescate(r.id);
      }
      if (!mounted) return;
      _recargar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(publicar
              ? '«${r.titulo}» ya está en el catálogo'
              : '«${r.titulo}» quedó fuera del catálogo'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo: $e')));
    }
  }

  Future<void> _crear() async {
    final creado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PantallaNuevaPublicacion(repo: widget.repo),
      ),
    );
    if (creado == true) _recargar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis publicaciones')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _crear,
        icon: const Icon(Icons.add),
        label: const Text('Nueva'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _recargar(),
        child: FutureBuilder<Pagina<Rescate>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return EstadoVacio(
                icono: Icons.cloud_off,
                titulo: 'No pudimos cargar tus publicaciones',
                detalle: '${snap.error}',
                accion: OutlinedButton(
                  onPressed: _recargar,
                  child: const Text('Reintentar'),
                ),
              );
            }

            final pagina = snap.data!;
            if (pagina.items.isEmpty) {
              return const EstadoVacio(
                icono: Icons.storefront_outlined,
                titulo: 'Todavía no publicaste nada',
                detalle: 'Creá tu primer rescate con el botón «Nueva».',
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                  RTokens.s4, RTokens.s4, RTokens.s4, 88),
              itemCount: pagina.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: RTokens.s3),
              itemBuilder: (_, i) => _TarjetaPublicacion(
                rescate: pagina.items[i],
                alCambiarEstado: (publicar) =>
                    _cambiarEstado(pagina.items[i], publicar),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _TarjetaPublicacion extends StatelessWidget {
  const _TarjetaPublicacion({
    required this.rescate,
    required this.alCambiarEstado,
  });

  final Rescate rescate;
  final void Function(bool publicar) alCambiarEstado;

  /// El color acompaña al estado, nunca lo sustituye: siempre va escrito.
  ({String texto, Color fondo, Color color}) get _estado =>
      switch (rescate.estado) {
        EstadoRescate.borrador => (
            texto: 'Borrador',
            fondo: RTokens.primarySoft,
            color: RTokens.textMuted
          ),
        EstadoRescate.publicado => (
            texto: 'En el catálogo',
            fondo: RTokens.successSoft,
            color: RTokens.success
          ),
        EstadoRescate.pausado => (
            texto: 'Pausado',
            fondo: RTokens.warningSoft,
            color: RTokens.warning
          ),
        EstadoRescate.agotado => (
            texto: 'Agotado',
            fondo: RTokens.primarySoft,
            color: RTokens.primary
          ),
        EstadoRescate.vencido => (
            texto: 'Vencido',
            fondo: RTokens.dangerSoft,
            color: RTokens.danger
          ),
        EstadoRescate.retirado => (
            texto: 'Retirado por moderación',
            fondo: RTokens.dangerSoft,
            color: RTokens.danger
          ),
        EstadoRescate.desconocido => (
            texto: 'Estado desconocido',
            fondo: RTokens.primarySoft,
            color: RTokens.textMuted
          ),
      };

  @override
  Widget build(BuildContext context) {
    final e = _estado;
    // Publicar y pausar son las dos únicas transiciones que la API acepta desde
    // aquí; el resto de estados los decide el sistema o la moderación, así que
    // no se ofrece un botón que solo podría fallar.
    final puedePublicar = rescate.estado == EstadoRescate.borrador ||
        rescate.estado == EstadoRescate.pausado;
    final puedePausar = rescate.estado == EstadoRescate.publicado;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(RTokens.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    rescate.titulo,
                    style: RTokens.titleM,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: RTokens.s2),
                Etiqueta(e.texto, fondo: e.fondo, color: e.color),
              ],
            ),
            const SizedBox(height: RTokens.s3),
            Precio(
              centavos: rescate.precioCentavos,
              originalCentavos: rescate.precioOriginalCentavos,
              moneda: rescate.moneda,
            ),
            const SizedBox(height: RTokens.s3),
            Wrap(
              spacing: RTokens.s2,
              runSpacing: RTokens.s1,
              children: [
                Etiqueta(
                  disponiblesTexto(rescate.cantidadDisponible),
                  fondo: RTokens.successSoft,
                  color: RTokens.success,
                ),
                if (rescate.cantidadVendida > 0)
                  Etiqueta(
                    '${rescate.cantidadVendida} vendidas',
                    fondo: RTokens.primarySoft,
                    color: RTokens.primary,
                  ),
                Etiqueta(
                  tiempoRestanteTexto(
                      rescate.validoHasta.difference(DateTime.now())),
                  fondo: RTokens.warningSoft,
                  color: RTokens.warning,
                ),
              ],
            ),
            if (puedePublicar || puedePausar) ...[
              const SizedBox(height: RTokens.s3),
              if (puedePublicar)
                ElevatedButton.icon(
                  onPressed: () => alCambiarEstado(true),
                  icon: const Icon(Icons.publish_outlined, size: 18),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                  label: const Text('Publicar'),
                )
              else
                OutlinedButton.icon(
                  onPressed: () => alCambiarEstado(false),
                  icon: const Icon(Icons.pause_outlined, size: 18),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    foregroundColor: RTokens.warning,
                  ),
                  label: const Text('Pausar'),
                ),
            ],
            if (puedePausar && rescate.cantidadVendida > 0) ...[
              const SizedBox(height: RTokens.s2),
              Text(
                'Pausar lo saca del catálogo, pero las reservas ya hechas '
                'siguen en pie.',
                style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
