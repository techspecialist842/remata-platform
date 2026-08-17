import 'package:flutter/material.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../datos/ubicacion.dart';
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
    this.ubicacion = const ServicioUbicacion(),
  });

  final Repositorio repo;
  final VoidCallback alSalir;
  final ServicioUbicacion ubicacion;

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

  Future<void> _editarUbicacion(Comercio comercio) async {
    final guardado = await showDialog<bool>(
      context: context,
      builder: (_) => _DialogoUbicacion(
        repo: widget.repo,
        ubicacion: widget.ubicacion,
        comercio: comercio,
      ),
    );
    if (guardado == true && mounted) {
      _recargar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Punto de retiro actualizado')),
      );
    }
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
                const Text('Punto de retiro', style: RTokens.titleM),
                const SizedBox(height: RTokens.s3),
                _Ubicacion(
                  comercio: datos.comercio,
                  alEditar: () => _editarUbicacion(datos.comercio),
                ),
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

/// Estado actual del punto de retiro.
///
/// Se dice explícitamente cuando falta: un comercio sin coordenadas desaparece
/// de las búsquedas por cercanía sin que nada se lo advierta, y esa es
/// justamente la clase de silencio que hace perder ventas.
class _Ubicacion extends StatelessWidget {
  const _Ubicacion({required this.comercio, required this.alEditar});

  final Comercio comercio;
  final VoidCallback alEditar;

  @override
  Widget build(BuildContext context) {
    final ubicado = comercio.apareceEnBusquedasCercanas;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(RTokens.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  ubicado ? Icons.place : Icons.location_off_outlined,
                  color: ubicado ? RTokens.primary : RTokens.textMuted,
                ),
                const SizedBox(width: RTokens.s3),
                // Tres estados, no dos.
                //
                // «Usar mi ubicación actual» guarda coordenadas y deja la
                // dirección escrita vacía, que es un caso corriente. Mirando
                // solo la dirección, la ficha decía «Todavía no has puesto tu
                // dirección» junto a un botón que decía «Cambiar ubicación»:
                // dos frases que se contradicen, y el comercio sin saber si su
                // punto de retiro quedó guardado.
                Expanded(
                  child: Text(
                    comercio.direccion ??
                        (ubicado
                            ? 'Punto de retiro fijado en el mapa'
                            : 'Todavía no has puesto tu dirección'),
                    style: comercio.direccion == null && !ubicado
                        ? RTokens.body.copyWith(color: RTokens.textMuted)
                        : RTokens.body,
                  ),
                ),
              ],
            ),
            if (!ubicado) ...[
              const SizedBox(height: RTokens.s3),
              Container(
                padding: const EdgeInsets.all(RTokens.s3),
                decoration: BoxDecoration(
                  color: RTokens.warningSoft,
                  borderRadius: BorderRadius.circular(RTokens.radiusMd),
                ),
                child: Text(
                  'Sin ubicación no apareces cuando alguien busca ofertas cerca '
                  'de él. Tus publicaciones se siguen vendiendo igual.',
                  style: RTokens.bodySm.copyWith(color: RTokens.warning),
                ),
              ),
            ],
            const SizedBox(height: RTokens.s3),
            OutlinedButton.icon(
              onPressed: alEditar,
              icon: const Icon(Icons.edit_location_alt_outlined, size: 18),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
              ),
              label: Text(ubicado ? 'Cambiar ubicación' : 'Fijar ubicación'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Alta o cambio del punto de retiro.
///
/// La dirección se escribe; las coordenadas se toman del propio dispositivo,
/// que es lo correcto porque quien las fija está de pie en el local. No se
/// piden a mano: nadie sabe su latitud de memoria, y teclearla es una fuente de
/// errores que dejaría al comercio ubicado en el mar.
class _DialogoUbicacion extends StatefulWidget {
  const _DialogoUbicacion({
    required this.repo,
    required this.ubicacion,
    required this.comercio,
  });

  final Repositorio repo;
  final ServicioUbicacion ubicacion;
  final Comercio comercio;

  @override
  State<_DialogoUbicacion> createState() => _DialogoUbicacionState();
}

class _DialogoUbicacionState extends State<_DialogoUbicacion> {
  late final _direccion =
      TextEditingController(text: widget.comercio.direccion ?? '');
  Coordenada? _punto;
  bool _ubicando = false;
  bool _guardando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final lat = widget.comercio.latitud;
    final lng = widget.comercio.longitud;
    if (lat != null && lng != null) _punto = Coordenada(lat, lng);

    // Sin esto, «Guardar» decide si habilitarse leyendo el texto en el momento
    // de construir, y escribir no reconstruye nada: quien escribiera su
    // dirección vería el botón apagado y creería que la app está rota.
    _direccion.addListener(_alEscribir);
  }

  void _alEscribir() => setState(() {});

  @override
  void dispose() {
    _direccion.removeListener(_alEscribir);
    _direccion.dispose();
    super.dispose();
  }

  Future<void> _tomarUbicacion() async {
    setState(() {
      _ubicando = true;
      _error = null;
    });
    try {
      final p = await widget.ubicacion.actual();
      if (!mounted) return;
      setState(() {
        _punto = p;
        _ubicando = false;
      });
    } on UbicacionExcepcion catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.mensaje;
        _ubicando = false;
      });
    }
  }

  Future<void> _guardar() async {
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await widget.repo.fijarUbicacion(
        direccion: _direccion.text,
        punto: _punto,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _guardando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusLg),
      ),
      title: const Text('Punto de retiro'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _direccion,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Dirección',
              hintText: 'Calle, número, referencia',
            ),
          ),
          const SizedBox(height: RTokens.s3),
          if (_punto != null)
            Row(
              children: [
                const Icon(Icons.check_circle,
                    color: RTokens.success, size: 18),
                const SizedBox(width: RTokens.s2),
                Expanded(
                  child: Text(
                    'Ubicación tomada',
                    style: RTokens.bodySm.copyWith(color: RTokens.success),
                  ),
                ),
              ],
            ),
          const SizedBox(height: RTokens.s2),
          OutlinedButton.icon(
            onPressed: _ubicando ? null : _tomarUbicacion,
            icon: _ubicando
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location, size: 18),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
            ),
            label: Text(
              _punto == null
                  ? 'Usar mi ubicación actual'
                  : 'Volver a tomarla',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: RTokens.s3),
            Text(
              _error!,
              style: RTokens.bodySm.copyWith(color: RTokens.danger),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        TextButton(
          // Se puede guardar solo la dirección: tenerla escrita es mejor que
          // nada mientras se consigue la ubicación. Lo que no tiene sentido es
          // guardar el diálogo entero vacío.
          onPressed: _guardando ||
                  (_direccion.text.trim().isEmpty && _punto == null)
              ? null
              : _guardar,
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
