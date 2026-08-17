import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../datos/api.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';

/// Detalle del rescate y confirmación de compra.
class PantallaDetalle extends StatefulWidget {
  const PantallaDetalle({
    super.key,
    required this.repo,
    required this.rescateId,
  });

  final Repositorio repo;
  final String rescateId;

  @override
  State<PantallaDetalle> createState() => _PantallaDetalleState();
}

class _PantallaDetalleState extends State<PantallaDetalle> {
  late Future<Rescate> _futuro;
  final _cupon = TextEditingController();
  int _cantidad = 1;
  bool _comprando = false;

  @override
  void initState() {
    super.initState();
    _futuro = widget.repo.verRescate(widget.rescateId);
  }

  @override
  void dispose() {
    _cupon.dispose();
    super.dispose();
  }

  Future<void> _comprar(Rescate r) async {
    setState(() => _comprando = true);
    try {
      final orden = await widget.repo.crearOrden(
        rescateId: r.id,
        cantidad: _cantidad,
        cuponCodigo: _cupon.text.trim(),
      );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => _DialogoConfirmacion(orden: orden),
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiExcepcion catch (e) {
      if (!mounted) return;
      setState(() => _comprando = false);
      // 409 significa que otro comprador se llevó las unidades mientras esta
      // pantalla estaba abierta. Merece un mensaje propio: no es un error del
      // usuario ni un fallo del sistema.
      final mensaje = e.statusCode == 409
          ? 'Alguien se adelantó y ya no quedan unidades suficientes.'
          : e.mensaje;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(mensaje), backgroundColor: RTokens.danger),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _comprando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo completar la compra.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalle')),
      body: FutureBuilder<Rescate>(
        future: _futuro,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return const EstadoVacio(
              icono: Icons.link_off,
              titulo: 'Oferta no disponible',
              detalle: 'Puede haberse agotado o vencido.',
            );
          }

          final r = snap.data!;
          final total = r.precioCentavos * _cantidad;
          final maximo = r.cantidadDisponible.clamp(1, 20);

          return Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(RTokens.s4),
                  children: [
                    Center(
                      child: ImagenRescate(semilla: r.id, tamano: 160),
                    ),
                    const SizedBox(height: RTokens.s5),
                    Text(r.titulo, style: RTokens.displayL),
                    const SizedBox(height: RTokens.s2),
                    Precio(
                      centavos: r.precioCentavos,
                      originalCentavos: r.precioOriginalCentavos,
                      moneda: r.moneda,
                    ),
                    const SizedBox(height: RTokens.s3),
                    Wrap(
                      spacing: RTokens.s2,
                      runSpacing: RTokens.s2,
                      children: [
                        Etiqueta(
                          tiempoRestanteTexto(r.tiempoRestante),
                          fondo: RTokens.warningSoft,
                          color: RTokens.warning,
                        ),
                        Etiqueta(
                          disponiblesTexto(r.cantidadDisponible),
                          fondo: RTokens.successSoft,
                          color: RTokens.success,
                        ),
                        Etiqueta(r.tipo.etiqueta,
                            fondo: RTokens.primarySoft,
                            color: RTokens.primary),
                        if (r.categoria != null) Etiqueta(r.categoria!),
                      ],
                    ),
                    // Una caja sorpresa no se compra igual que una unidad: lo que
                    // cambia se dice antes de reservar, no en la letra chica.
                    if (r.tipo != TipoOferta.unitario) ...[
                      const SizedBox(height: RTokens.s4),
                      Container(
                        padding: const EdgeInsets.all(RTokens.s3),
                        decoration: BoxDecoration(
                          color: RTokens.primarySoft,
                          borderRadius: BorderRadius.circular(RTokens.radiusMd),
                        ),
                        child: Text(r.tipo.explicacion, style: RTokens.bodySm),
                      ),
                    ],
                    if (r.descripcion != null) ...[
                      const SizedBox(height: RTokens.s5),
                      const Text('Descripción', style: RTokens.titleM),
                      const SizedBox(height: RTokens.s2),
                      Text(r.descripcion!, style: RTokens.body),
                    ],
                    const SizedBox(height: RTokens.s6),
                    const Text('Cantidad', style: RTokens.titleM),
                    const SizedBox(height: RTokens.s2),
                    Row(
                      children: [
                        IconButton.outlined(
                          onPressed: _cantidad > 1
                              ? () => setState(() => _cantidad--)
                              : null,
                          icon: const Icon(Icons.remove),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: RTokens.s4),
                          child: Text('$_cantidad', style: RTokens.titleL),
                        ),
                        IconButton.outlined(
                          onPressed: _cantidad < maximo
                              ? () => setState(() => _cantidad++)
                              : null,
                          icon: const Icon(Icons.add),
                        ),
                      ],
                    ),
                    const SizedBox(height: RTokens.s5),
                    const Text('Cupón de descuento', style: RTokens.titleM),
                    const SizedBox(height: RTokens.s2),
                    TextField(
                      controller: _cupon,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        hintText: 'Escribe tu código (opcional)',
                        prefixIcon: Icon(Icons.local_offer_outlined),
                      ),
                    ),
                  ],
                ),
              ),
              _BarraCompra(
                total: total,
                moneda: r.moneda,
                cargando: _comprando,
                alComprar: () => _comprar(r),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _BarraCompra extends StatelessWidget {
  const _BarraCompra({
    required this.total,
    required this.moneda,
    required this.cargando,
    required this.alComprar,
  });

  final int total;
  final String moneda;
  final bool cargando;
  final VoidCallback alComprar;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(RTokens.s4),
        decoration: const BoxDecoration(
          color: RTokens.surface,
          border: Border(top: BorderSide(color: RTokens.border)),
        ),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Total', style: RTokens.bodySm),
                  Text(formatearPrecio(total, moneda: moneda),
                      style: RTokens.price),
                ],
              ),
              const SizedBox(width: RTokens.s5),
              Expanded(
                child: ElevatedButton(
                  onPressed: cargando ? null : alComprar,
                  child: cargando
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Reservar'),
                ),
              ),
            ],
          ),
        ),
      );
}

class _DialogoConfirmacion extends StatelessWidget {
  const _DialogoConfirmacion({required this.orden});

  final Orden orden;

  @override
  Widget build(BuildContext context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RTokens.radiusLg),
        ),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: RTokens.success),
            SizedBox(width: RTokens.s2),
            Text('¡Reserva confirmada!'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Orden ${orden.numero}', style: RTokens.titleM),
            const SizedBox(height: RTokens.s2),
            Text(
              'Total: ${formatearPrecio(orden.totalCentavos, moneda: orden.moneda)}',
              style: RTokens.body,
            ),

            // El código de retiro solo existe en esta respuesta: el servidor
            // guarda su hash y no puede volver a dárnoslo. Por eso se muestra
            // acá y se avisa de que el número de orden es el respaldo.
            if (orden.qrToken != null) ...[
              const SizedBox(height: RTokens.s4),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(RTokens.s3),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(RTokens.radiusMd),
                    border: Border.all(color: RTokens.border),
                  ),
                  // SizedBox con medidas explícitas, no solo `size:`.
                  // QrImageView usa un LayoutBuilder por dentro y AlertDialog
                  // mide dimensiones intrínsecas de su contenido: sin
                  // restricciones fijas, el diálogo revienta al renderizar y la
                  // compra se cae en la última pantalla.
                  child: SizedBox(
                    width: 148,
                    height: 148,
                    child: QrImageView(
                      // La clave lleva el token: si cambiara, Flutter redibuja
                      // en vez de reutilizar el código anterior.
                      key: ValueKey<String>(orden.qrToken!),
                      data: orden.qrToken!,
                      // Nivel de corrección alto: este código se escanea desde
                      // la pantalla de un teléfono, a veces rayada o con
                      // brillo, en un mostrador. Conviene que aguante
                      // suciedad.
                      errorCorrectionLevel: QrErrorCorrectLevel.H,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: RTokens.s2),
              Text(
                'Muestra este código al retirar. Si no lo tienes a mano, alcanza '
                'con el número de orden.',
                style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
                textAlign: TextAlign.center,
              ),
            ],

            const SizedBox(height: RTokens.s3),
            Container(
              padding: const EdgeInsets.all(RTokens.s3),
              decoration: BoxDecoration(
                color: RTokens.warningSoft,
                borderRadius: BorderRadius.circular(RTokens.radiusMd),
              ),
              child: Text(
                'El comercio debe confirmarla. Si no lo hace antes de las '
                '${TimeOfDay.fromDateTime(orden.expiraEn).format(context)}, '
                'la reserva se libera automáticamente.',
                style: RTokens.bodySm.copyWith(color: RTokens.warning),
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Entendido'),
          ),
        ],
      );
}
