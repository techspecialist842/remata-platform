import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';

/// Mis pedidos, con el estado de cada orden.
class PantallaPedidos extends StatefulWidget {
  const PantallaPedidos({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<PantallaPedidos> createState() => _PantallaPedidosState();
}

class _PantallaPedidosState extends State<PantallaPedidos> {
  late Future<Pagina<Orden>> _futuro;

  @override
  void initState() {
    super.initState();
    _recargar();
  }

  void _recargar() {
    // Cuerpo de bloque, no `=>`: una lambda de flecha devuelve el valor de la
    // asignación —el propio Future— y Flutter rechaza un callback de setState
    // que devuelva algo asíncrono.
    setState(() {
      _futuro = widget.repo.misOrdenes();
    });
  }

  Future<void> _cancelar(Orden orden) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RTokens.radiusLg),
        ),
        title: const Text('¿Cancelar la reserva?'),
        content: Text(
          'La orden ${orden.numero} se cancelará y las unidades volverán a '
          'estar disponibles para otros compradores.',
          style: RTokens.body,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('No, volver'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sí, cancelar',
                style: TextStyle(color: RTokens.danger)),
          ),
        ],
      ),
    );
    if (confirmado != true) return;

    try {
      await widget.repo.cancelarOrden(orden.id);
      if (mounted) _recargar();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudo cancelar: $e')),
      );
    }
  }

  Future<void> _calificar(Orden orden) async {
    final resena = await showDialog<({int calificacion, String comentario})>(
      context: context,
      builder: (_) => _DialogoCalificar(numero: orden.numero),
    );
    if (resena == null) return;

    try {
      await widget.repo.resenarOrden(
        orden.id,
        calificacion: resena.calificacion,
        comentario: resena.comentario,
      );
      if (!mounted) return;
      _recargar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('¡Gracias por calificar!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No se pudo calificar: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis pedidos')),
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
                titulo: 'No pudimos cargar tus pedidos',
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
                icono: Icons.receipt_long_outlined,
                titulo: 'Todavía no tienes pedidos',
                detalle: 'Cuando reserves una oferta, vas a verla acá.',
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(RTokens.s4),
              itemCount: pagina.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: RTokens.s3),
              itemBuilder: (_, i) => _TarjetaOrden(
                orden: pagina.items[i],
                alCancelar: () => _cancelar(pagina.items[i]),
                alCalificar: () => _calificar(pagina.items[i]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _TarjetaOrden extends StatelessWidget {
  const _TarjetaOrden({
    required this.orden,
    required this.alCancelar,
    required this.alCalificar,
  });

  final Orden orden;
  final VoidCallback alCancelar;
  final VoidCallback alCalificar;

  /// Colour supports the label, never replaces it — the state is always spelled out.
  ({String texto, Color fondo, Color color}) get _estado => switch (orden.estado) {
        EstadoOrden.creada => (
            texto: 'Esperando al comercio',
            fondo: RTokens.warningSoft,
            color: RTokens.warning
          ),
        EstadoOrden.confirmada => (
            texto: 'Confirmada — pasá a retirarla',
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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(orden.numero,
                      style: RTokens.titleM, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: RTokens.s2),
                Etiqueta(e.texto, fondo: e.fondo, color: e.color),
              ],
            ),
            const SizedBox(height: RTokens.s2),
            // Un número de orden no le dice nada a nadie: hay que poder
            // reconocer la propia reserva de un vistazo.
            Text(orden.resumen, style: RTokens.body),
            const SizedBox(height: RTokens.s3),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  formatearPrecio(orden.totalCentavos, moneda: orden.moneda),
                  style: RTokens.price,
                ),
                if (orden.descuentoCentavos > 0)
                  Etiqueta(
                    'Ahorraste '
                    '${formatearPrecio(orden.descuentoCentavos, moneda: orden.moneda)}',
                    fondo: RTokens.successSoft,
                    color: RTokens.success,
                  ),
              ],
            ),
            if (orden.estado == EstadoOrden.creada) ...[
              const SizedBox(height: RTokens.s3),
              OutlinedButton(
                onPressed: alCancelar,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: RTokens.danger,
                ),
                child: const Text('Cancelar reserva'),
              ),
            ],

            // Calificar solo tiene sentido sobre lo ya entregado, y una sola
            // vez: la API responde 409 al segundo intento, así que en cuanto
            // hay reseña se muestra la nota en lugar del botón.
            if (orden.estado == EstadoOrden.cumplida) ...[
              const SizedBox(height: RTokens.s3),
              if (orden.resena == null)
                ElevatedButton.icon(
                  onPressed: alCalificar,
                  icon: const Icon(Icons.star_outline, size: 18),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                  label: const Text('Calificar'),
                )
              else
                _NotaDada(resena: orden.resena!),
            ],
          ],
        ),
      ),
    );
  }
}

/// La nota que ya dejó el comprador, en lugar del botón de calificar.
class _NotaDada extends StatelessWidget {
  const _NotaDada({required this.resena});

  final ResenaPropia resena;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Cinco estrellas siempre, rellenas hasta la nota: así se lee
              // cuánto se calificó sobre cuánto, sin tener que contar.
              for (var i = 1; i <= 5; i++)
                Icon(
                  i <= resena.calificacion ? Icons.star : Icons.star_border,
                  size: 20,
                  color: RTokens.accent,
                ),
              const SizedBox(width: RTokens.s2),
              Text('Ya calificaste', style: RTokens.bodySm),
            ],
          ),
          if (resena.comentario != null) ...[
            const SizedBox(height: RTokens.s2),
            Text('«${resena.comentario!}»', style: RTokens.bodySm),
          ],
        ],
      );
}

/// Diálogo de calificación: estrellas obligatorias, comentario opcional.
class _DialogoCalificar extends StatefulWidget {
  const _DialogoCalificar({required this.numero});

  final String numero;

  @override
  State<_DialogoCalificar> createState() => _DialogoCalificarState();
}

class _DialogoCalificarState extends State<_DialogoCalificar> {
  int _calificacion = 0;
  final _comentario = TextEditingController();

  @override
  void dispose() {
    _comentario.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusLg),
      ),
      title: const Text('¿Cómo te fue?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Orden ${widget.numero}', style: RTokens.bodySm),
          const SizedBox(height: RTokens.s3),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  onPressed: () => setState(() => _calificacion = i),
                  // Área táctil cómoda: es el control principal del diálogo.
                  iconSize: 34,
                  tooltip: '$i de 5',
                  icon: Icon(
                    i <= _calificacion ? Icons.star : Icons.star_border,
                    color: RTokens.accent,
                  ),
                ),
            ],
          ),
          const SizedBox(height: RTokens.s2),
          TextField(
            controller: _comentario,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(
              hintText: 'Cuenta cómo fue (opcional)',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Ahora no'),
        ),
        TextButton(
          // Deshabilitado hasta elegir estrellas: la API exige de 1 a 5, y un
          // botón que solo puede fallar es peor que uno apagado.
          onPressed: _calificacion == 0
              ? null
              : () => Navigator.of(context).pop((
                    calificacion: _calificacion,
                    comentario: _comentario.text,
                  )),
          child: const Text('Enviar'),
        ),
      ],
    );
  }
}
