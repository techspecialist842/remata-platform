import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';

/// Órdenes que llegaron al comercio, con las acciones que le tocan a él.
///
/// Cada orden dice qué se pidió, no solo su número: confirmar a ciegas algo
/// identificado por «R-260811-8EC2326F» no le sirve a nadie detrás de un
/// mostrador.
class PantallaOrdenesRecibidas extends StatefulWidget {
  const PantallaOrdenesRecibidas({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<PantallaOrdenesRecibidas> createState() =>
      _PantallaOrdenesRecibidasState();
}

class _PantallaOrdenesRecibidasState extends State<PantallaOrdenesRecibidas> {
  late Future<Pagina<Orden>> _futuro;

  @override
  void initState() {
    super.initState();
    _recargar();
  }

  void _recargar() {
    setState(() {
      _futuro = widget.repo.ordenesRecibidas();
    });
  }

  Future<void> _accion(Future<void> Function() ejecutar, String exito) async {
    try {
      await ejecutar();
      if (!mounted) return;
      _recargar();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(exito)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo: $e')));
    }
  }

  /// El no-show queda en la reputación del comprador, así que se confirma
  /// antes: es una acción con consecuencias sobre otra persona.
  Future<void> _marcarNoShow(Orden orden) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RTokens.radiusLg),
        ),
        title: const Text('¿El comprador no se presentó?'),
        content: Text(
          'La orden ${orden.numero} se cancelará, las unidades volverán al '
          'catálogo y quedará registrado en la reputación del comprador.',
          style: RTokens.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('No, volver'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sí, no se presentó',
                style: TextStyle(color: RTokens.danger)),
          ),
        ],
      ),
    );
    if (confirmado != true) return;

    await _accion(
      () => widget.repo.cancelarOrden(orden.id, motivo: 'no_show'),
      'Se registró que ${orden.numero} no se retiró',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Órdenes recibidas')),
      body: RefreshIndicator(
        onRefresh: () async => _recargar(),
        child: FutureBuilder<Pagina<Orden>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return EstadoVacio(
                icono: Icons.cloud_off,
                titulo: 'No pudimos cargar las órdenes',
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
                icono: Icons.inbox_outlined,
                titulo: 'Todavía no recibiste órdenes',
                detalle:
                    'Cuando alguien reserve una de tus ofertas, aparecerá acá.',
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(RTokens.s4),
              itemCount: pagina.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: RTokens.s3),
              itemBuilder: (_, i) {
                final orden = pagina.items[i];
                return _TarjetaOrdenComercio(
                  orden: orden,
                  alConfirmar: () => _accion(
                    () => widget.repo.confirmarOrden(orden.id),
                    'Confirmaste ${orden.numero}',
                  ),
                  alCumplir: () => _accion(
                    () => widget.repo.cumplirOrden(orden.id),
                    'Marcaste ${orden.numero} como entregada',
                  ),
                  alRechazar: () => _accion(
                    () => widget.repo
                        .cancelarOrden(orden.id, motivo: 'comercio'),
                    'Cancelaste ${orden.numero}',
                  ),
                  alNoShow: () => _marcarNoShow(orden),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _TarjetaOrdenComercio extends StatelessWidget {
  const _TarjetaOrdenComercio({
    required this.orden,
    required this.alConfirmar,
    required this.alCumplir,
    required this.alRechazar,
    required this.alNoShow,
  });

  final Orden orden;
  final VoidCallback alConfirmar;
  final VoidCallback alCumplir;
  final VoidCallback alRechazar;
  final VoidCallback alNoShow;

  ({String texto, Color fondo, Color color}) get _estado =>
      switch (orden.estado) {
        EstadoOrden.creada => (
            texto: 'Esperando tu confirmación',
            fondo: RTokens.warningSoft,
            color: RTokens.warning
          ),
        EstadoOrden.confirmada => (
            texto: 'Confirmada — pendiente de retiro',
            fondo: RTokens.primarySoft,
            color: RTokens.primary
          ),
        EstadoOrden.cumplida => (
            texto: 'Entregada',
            fondo: RTokens.successSoft,
            color: RTokens.success
          ),
        EstadoOrden.cancelada => (
            texto: 'Cancelada',
            fondo: RTokens.dangerSoft,
            color: RTokens.danger
          ),
        EstadoOrden.desconocido => (
            texto: 'Estado desconocido',
            fondo: RTokens.primarySoft,
            color: RTokens.textMuted
          ),
      };

  @override
  Widget build(BuildContext context) {
    final e = _estado;
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
                  child: Text(orden.numero,
                      style: RTokens.titleM, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: RTokens.s2),
                Etiqueta(e.texto, fondo: e.fondo, color: e.color),
              ],
            ),
            const SizedBox(height: RTokens.s2),
            Text(orden.resumen, style: RTokens.body),
            const SizedBox(height: RTokens.s3),
            Text(
              formatearPrecio(orden.totalCentavos, moneda: orden.moneda),
              style: RTokens.price,
            ),

            if (orden.estado == EstadoOrden.creada) ...[
              const SizedBox(height: RTokens.s3),
              ElevatedButton(
                onPressed: alConfirmar,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                ),
                child: const Text('Confirmar'),
              ),
              const SizedBox(height: RTokens.s2),
              OutlinedButton(
                onPressed: alRechazar,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: RTokens.danger,
                ),
                child: const Text('No puedo prepararla'),
              ),
            ],

            if (orden.estado == EstadoOrden.confirmada) ...[
              const SizedBox(height: RTokens.s3),
              ElevatedButton(
                onPressed: alCumplir,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                ),
                child: const Text('Entregada'),
              ),
              const SizedBox(height: RTokens.s2),
              OutlinedButton(
                onPressed: alNoShow,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: RTokens.danger,
                ),
                child: const Text('No se presentó'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
