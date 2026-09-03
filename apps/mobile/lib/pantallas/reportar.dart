import 'package:flutter/material.dart';
import '../datos/api.dart';
import '../datos/modelos.dart';
import '../datos/repositorio.dart';
import '../design/tokens.dart';

/// Reportar una publicación.
///
/// Reportar **abre un expediente, no ejecuta la pena**. La oferta sigue en el
/// catálogo hasta que una persona la revise. Si una denuncia bastara para
/// tumbarla, hundir a la competencia costaría un clic, y por eso la pantalla
/// lo dice en voz alta: quien reporta debe saber que no está borrando nada.
///
/// Se pide un motivo de una lista corta en vez de solo texto libre. Un motivo
/// se puede contar y agrupar —diez reportes por «precio incorrecto» sobre la
/// misma oferta son una señal—, mientras que diez párrafos distintos hay que
/// leerlos uno a uno.
Future<bool> mostrarDialogoReporte(
  BuildContext context, {
  required Repositorio repo,
  required String rescateId,
}) async {
  final enviado = await showDialog<bool>(
    context: context,
    builder: (_) => _DialogoReporte(repo: repo, rescateId: rescateId),
  );
  return enviado ?? false;
}

class _DialogoReporte extends StatefulWidget {
  const _DialogoReporte({required this.repo, required this.rescateId});

  final Repositorio repo;
  final String rescateId;

  @override
  State<_DialogoReporte> createState() => _DialogoReporteState();
}

class _DialogoReporteState extends State<_DialogoReporte> {
  MotivoReporte? _motivo;
  final _nota = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  /// «Otro» sin explicación no le sirve a quien modera: no dice nada que no
  /// dijera ya el hecho de haber reportado.
  bool get _notaObligatoria => _motivo == MotivoReporte.otro;

  bool get _puedeEnviar =>
      _motivo != null &&
      !_enviando &&
      (!_notaObligatoria || _nota.text.trim().length >= 3);

  Future<void> _enviar() async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await widget.repo.reportarRescate(
        widget.rescateId,
        motivo: _motivo!,
        nota: _nota.text,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiExcepcion catch (e) {
      if (!mounted) return;
      setState(() {
        // 409 es «ya reportaste esta publicación». No es un fallo: es que ya
        // está hecho, y merece decirse como tal.
        _error = e.statusCode == 409
            ? 'Ya reportaste esta publicación. Está en revisión.'
            : e.mensaje;
        _enviando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Reportar publicación'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Un reporte no borra la oferta: la pone en manos de una '
                'persona que la revisa.',
                style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
              ),
              const SizedBox(height: RTokens.s3),
              // El grupo gobierna la selección; cada opción solo dice cuál
              // es su valor. Es la forma vigente en Flutter: pasar el valor y
              // el cambio en cada opción quedó obsoleto.
              // Mientras se envía no se cambia de opción. El grupo exige
              // siempre un manejador, así que se ignora dentro en vez de
              // pasar null.
              RadioGroup<MotivoReporte>(
                groupValue: _motivo,
                onChanged: (v) {
                  if (_enviando) return;
                  setState(() => _motivo = v);
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final m in MotivoReporte.values)
                      RadioListTile<MotivoReporte>(
                        value: m,
                        title: Text(m.etiqueta, style: RTokens.body),
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: RTokens.s2),
              TextField(
                controller: _nota,
                enabled: !_enviando,
                maxLines: 3,
                maxLength: 500,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: _notaObligatoria
                      ? 'Cuenta qué pasa'
                      : 'Detalle (opcional)',
                  border: const OutlineInputBorder(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: RTokens.s2),
                Text(_error!, style: RTokens.bodySm.copyWith(color: RTokens.danger)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: _enviando ? null : () => Navigator.of(context).pop(false),
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
                : const Text('Enviar'),
          ),
        ],
      );
}
