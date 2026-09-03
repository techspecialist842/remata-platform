import 'package:flutter/material.dart';
import '../datos/api.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/componentes.dart';
import '../design/tokens.dart';

/// Las reseñas que recibió el comercio, con su derecho de réplica.
///
/// Poder contestar cambia el carácter del sistema: una crítica sin derecho a
/// réplica es una sentencia, y quien lee la ficha merece las dos versiones.
///
/// Se responde **una sola vez**. La conversación pública no es un hilo, y
/// permitir editar dejaría respuestas que ya nadie sabe a qué contestaban.
///
/// Responder **no cambia la nota**. La calificación es de quien compró, y la
/// pantalla lo dice para que nadie espere otra cosa.
class SeccionResenas extends StatefulWidget {
  const SeccionResenas({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<SeccionResenas> createState() => _SeccionResenasState();
}

class _SeccionResenasState extends State<SeccionResenas> {
  late Future<Pagina<ResenaRecibida>> _futuro;

  @override
  void initState() {
    super.initState();
    _recargar();
  }

  void _recargar() {
    // Cuerpo con llaves, no flecha: una lambda de flecha devuelve el valor de
    // la asignación —un Future—, y setState lo rechaza. Es un error que ya se
    // coló una vez en este proyecto y no avisa hasta que la pantalla se monta.
    setState(() {
      _futuro = widget.repo.misResenas();
    });
  }

  Future<void> _responder(ResenaRecibida r) async {
    final enviada = await showDialog<bool>(
      context: context,
      builder: (_) => _DialogoRespuesta(repo: widget.repo, resena: r),
    );
    if (enviada == true && mounted) {
      _recargar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Respuesta publicada')),
      );
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Pagina<ResenaRecibida>>(
        future: _futuro,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Padding(
              padding: EdgeInsets.all(RTokens.s4),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          if (snap.hasError) {
            return const EstadoVacio(
              icono: Icons.error_outline,
              titulo: 'No pudimos cargar tus reseñas',
              detalle: 'Vuelve a intentarlo en un momento.',
            );
          }
          final items = snap.data?.items ?? const <ResenaRecibida>[];
          if (items.isEmpty) {
            return const EstadoVacio(
              icono: Icons.rate_review_outlined,
              titulo: 'Todavía no tienes reseñas',
              detalle: 'Aparecen cuando alguien califica un pedido entregado.',
            );
          }
          return Column(
            children: [
              for (final r in items)
                _TarjetaResena(resena: r, alResponder: () => _responder(r)),
            ],
          );
        },
      );
}

class _TarjetaResena extends StatelessWidget {
  const _TarjetaResena({required this.resena, required this.alResponder});

  final ResenaRecibida resena;
  final VoidCallback alResponder;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: RTokens.s3),
        child: Padding(
          padding: const EdgeInsets.all(RTokens.s4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  for (var i = 1; i <= 5; i++)
                    Icon(
                      i <= resena.calificacion ? Icons.star : Icons.star_border,
                      size: 18,
                      color: RTokens.warning,
                    ),
                  const Spacer(),
                  Text(
                    _fecha(resena.createdAt),
                    style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
                  ),
                ],
              ),
              if (resena.comentario != null) ...[
                const SizedBox(height: RTokens.s2),
                Text(resena.comentario!, style: RTokens.body),
              ],
              if (resena.respuesta != null) ...[
                const SizedBox(height: RTokens.s3),
                Container(
                  padding: const EdgeInsets.all(RTokens.s3),
                  decoration: BoxDecoration(
                    color: RTokens.primarySoft,
                    borderRadius: BorderRadius.circular(RTokens.radiusMd),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tu respuesta',
                        style: RTokens.bodySm.copyWith(
                          color: RTokens.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: RTokens.s1),
                      Text(resena.respuesta!, style: RTokens.bodySm),
                    ],
                  ),
                ),
              ] else ...[
                const SizedBox(height: RTokens.s2),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: alResponder,
                    icon: const Icon(Icons.reply, size: 18),
                    label: const Text('Responder'),
                  ),
                ),
              ],
            ],
          ),
        ),
      );

  static String _fecha(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year}';
  }
}

class _DialogoRespuesta extends StatefulWidget {
  const _DialogoRespuesta({required this.repo, required this.resena});

  final Repositorio repo;
  final ResenaRecibida resena;

  @override
  State<_DialogoRespuesta> createState() => _DialogoRespuestaState();
}

class _DialogoRespuestaState extends State<_DialogoRespuesta> {
  final _texto = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // El botón se enciende solo cuando hay algo que decir. Sin este oyente el
    // widget no se redibuja al escribir y el botón se queda gris.
    _texto.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  bool get _puedeEnviar => !_enviando && _texto.text.trim().length >= 2;

  Future<void> _enviar() async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await widget.repo.responderResena(widget.resena.id, _texto.text);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiExcepcion catch (e) {
      if (!mounted) return;
      setState(() {
        // 409 es «ya tiene respuesta». Pasa si se respondió desde otro sitio
        // mientras este diálogo estaba abierto.
        _error =
            e.statusCode == 409 ? 'Esa reseña ya tiene respuesta.' : e.mensaje;
        _enviando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Responder'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Se publica junto a la reseña y solo se puede responder una '
                'vez. No cambia la nota: la calificación es de quien compró.',
                style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
              ),
              const SizedBox(height: RTokens.s3),
              TextField(
                controller: _texto,
                enabled: !_enviando,
                autofocus: true,
                maxLines: 4,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'Tu respuesta',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_error != null)
                Text(
                  _error!,
                  style: RTokens.bodySm.copyWith(color: RTokens.danger),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed:
                _enviando ? null : () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: _puedeEnviar ? _enviar : null,
            child: _enviando
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Publicar'),
          ),
        ],
      );
}
