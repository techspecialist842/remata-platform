import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';

/// Cuenta del comercio: quién es y cómo lo están calificando.
///
/// La reputación se pide con el merchantId, que no viaja en la sesión, así que
/// primero hay que consultar el perfil. El repositorio encadena ambas llamadas.
class PantallaCuentaComercio extends StatefulWidget {
  const PantallaCuentaComercio({
    super.key,
    required this.repo,
    required this.alSalir,
  });

  final Repositorio repo;
  final VoidCallback alSalir;

  @override
  State<PantallaCuentaComercio> createState() => _PantallaCuentaComercioState();
}

class _PantallaCuentaComercioState extends State<PantallaCuentaComercio> {
  late Future<({Comercio comercio, Reputacion reputacion})> _futuro;

  @override
  void initState() {
    super.initState();
    _recargar();
  }

  void _recargar() {
    setState(() {
      _futuro = widget.repo.miComercioConReputacion();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi comercio')),
      body: RefreshIndicator(
        onRefresh: () async => _recargar(),
        child: FutureBuilder<({Comercio comercio, Reputacion reputacion})>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return EstadoVacio(
                icono: Icons.cloud_off,
                titulo: 'No pudimos cargar tu comercio',
                detalle: '${snap.error}',
                accion: OutlinedButton(
                  onPressed: _recargar,
                  child: const Text('Reintentar'),
                ),
              );
            }

            final datos = snap.data!;
            return ListView(
              padding: const EdgeInsets.all(RTokens.s4),
              children: [
                _Cabecera(comercio: datos.comercio),
                const SizedBox(height: RTokens.s5),
                const Text('Tu reputación', style: RTokens.titleM),
                const SizedBox(height: RTokens.s3),
                _Reputacion(reputacion: datos.reputacion),
                const SizedBox(height: RTokens.s5),
                Container(
                  padding: const EdgeInsets.all(RTokens.s4),
                  decoration: BoxDecoration(
                    color: RTokens.primarySoft,
                    borderRadius: BorderRadius.circular(RTokens.radiusLg),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, color: RTokens.primary),
                      SizedBox(width: RTokens.s3),
                      Expanded(
                        child: Text(
                          'Facturación, horarios de retiro y estadísticas del '
                          'comercio llegan en fases siguientes.',
                          style: RTokens.bodySm,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: RTokens.s5),
                OutlinedButton(
                  onPressed: widget.alSalir,
                  style:
                      OutlinedButton.styleFrom(foregroundColor: RTokens.danger),
                  child: const Text('Cerrar sesión'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.comercio});

  final Comercio comercio;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: RTokens.primary,
              borderRadius: BorderRadius.circular(RTokens.radiusLg),
            ),
            child: const Icon(Icons.storefront, color: Colors.white, size: 30),
          ),
          const SizedBox(width: RTokens.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(comercio.nombreLegal,
                    style: RTokens.titleL, maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: RTokens.s1),
                // Se dice también cuando NO está verificado: callarlo dejaría
                // creer que la verificación no existe.
                Etiqueta(
                  comercio.verificado
                      ? 'Comercio verificado'
                      : 'Verificación pendiente',
                  fondo: comercio.verificado
                      ? RTokens.successSoft
                      : RTokens.warningSoft,
                  color:
                      comercio.verificado ? RTokens.success : RTokens.warning,
                ),
              ],
            ),
          ),
        ],
      );
}

class _Reputacion extends StatelessWidget {
  const _Reputacion({required this.reputacion});

  final Reputacion reputacion;

  @override
  Widget build(BuildContext context) {
    final promedio = reputacion.promedio;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(RTokens.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (promedio == null)
              // Sin reseñas no hay nota. Mostrar un 0 sería acusar a un
              // comercio nuevo de algo que nadie ha dicho.
              Text(
                'Todavía no te calificaron',
                style: RTokens.body.copyWith(color: RTokens.textMuted),
              )
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Icon(Icons.star, color: RTokens.accent, size: 28),
                  const SizedBox(width: RTokens.s2),
                  Text(promedio.toStringAsFixed(1), style: RTokens.price),
                  const SizedBox(width: RTokens.s2),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(
                      reputacion.totalResenas == 1
                          ? 'de 1 reseña'
                          : 'de ${reputacion.totalResenas} reseñas',
                      style: RTokens.bodySm,
                    ),
                  ),
                ],
              ),
            // No se muestran los no-shows: la API los apunta contra el
            // comprador que no retiró, no contra el comercio, así que este
            // contador siempre vale cero acá. Enseñarlo sería inventar una
            // cifra que el backend nunca alimenta.
            if (reputacion.ordenesCumplidas > 0) ...[
              const SizedBox(height: RTokens.s3),
              // En cero tampoco se muestra: un «0 órdenes entregadas» sobre
              // verde de logro atribuye un mérito a quien no ha vendido nada.
              Etiqueta(
                reputacion.ordenesCumplidas == 1
                    ? '1 orden entregada'
                    : '${reputacion.ordenesCumplidas} órdenes entregadas',
                fondo: RTokens.successSoft,
                color: RTokens.success,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
