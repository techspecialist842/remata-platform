import 'package:flutter/material.dart';
import '../datos/api.dart';
import '../datos/repositorio.dart';
import '../design/tokens.dart';
import '../datos/modelos.dart';

/// Alta de un rescate.
///
/// Nace en borrador a propósito: publicarlo es un segundo paso deliberado, de
/// modo que nada llega a la vitrina por el simple hecho de haberlo escrito.
class PantallaNuevaPublicacion extends StatefulWidget {
  const PantallaNuevaPublicacion({super.key, required this.repo});

  final Repositorio repo;

  @override
  State<PantallaNuevaPublicacion> createState() =>
      _PantallaNuevaPublicacionState();
}

/// Convierte lo que escribe una persona («12,50», «12.50», «12») a centavos.
///
/// Devuelve null si no es un importe válido. Nunca usa coma flotante para el
/// resultado: se parte en unidades y céntimos y se compone con enteros, porque
/// `(12.10 * 100).round()` es la clase de redondeo que acaba perdiendo un
/// céntimo por operación.
int? aCentavos(String texto) {
  final limpio = texto.trim().replaceAll(',', '.');
  if (limpio.isEmpty) return null;
  if (!RegExp(r'^\d+(\.\d{0,2})?$').hasMatch(limpio)) return null;

  final partes = limpio.split('.');
  final unidades = int.parse(partes[0]);
  final decimales = partes.length > 1 ? partes[1].padRight(2, '0') : '00';
  return unidades * 100 + int.parse(decimales);
}

class _PantallaNuevaPublicacionState extends State<PantallaNuevaPublicacion> {
  final _formKey = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _descripcion = TextEditingController();
  final _categoria = TextEditingController();
  final _precio = TextEditingController();
  final _precioOriginal = TextEditingController();
  final _cantidad = TextEditingController(text: '1');

  TipoOferta _tipo = TipoOferta.unitario;
  DateTime _validoHasta = DateTime.now().add(const Duration(hours: 6));
  bool _guardando = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _titulo,
      _descripcion,
      _categoria,
      _precio,
      _precioOriginal,
      _cantidad,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _elegirVencimiento() async {
    final ahora = DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: _validoHasta,
      firstDate: ahora,
      lastDate: ahora.add(const Duration(days: 30)),
    );
    if (dia == null || !mounted) return;

    final hora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_validoHasta),
    );
    if (hora == null) return;

    setState(() {
      _validoHasta =
          DateTime(dia.year, dia.month, dia.day, hora.hour, hora.minute);
    });
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_validoHasta.isAfter(DateTime.now())) {
      setState(() => _error = 'El vencimiento tiene que estar en el futuro.');
      return;
    }

    setState(() {
      _guardando = true;
      _error = null;
    });

    try {
      await widget.repo.crearRescate(
        titulo: _titulo.text.trim(),
        tipo: _tipo,
        descripcion: _descripcion.text.trim(),
        categoria: _categoria.text.trim(),
        precioCentavos: aCentavos(_precio.text)!,
        precioOriginalCentavos: aCentavos(_precioOriginal.text),
        cantidadTotal: int.parse(_cantidad.text.trim()),
        // Vigente desde ya: publicar es la decisión, no la fecha de inicio.
        validoDesde: DateTime.now(),
        validoHasta: _validoHasta,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiExcepcion catch (e) {
      setState(() {
        _error = e.mensaje;
        _guardando = false;
      });
    } catch (_) {
      setState(() {
        _error = 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.';
        _guardando = false;
      });
    }
  }

  String _fechaLegible(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final hh = d.hour.toString().padLeft(2, '0');
    final min = d.minute.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year} a las $hh:$min';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva publicación')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(RTokens.s4),
          children: [
            TextFormField(
              controller: _titulo,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Qué ofrecés',
                hintText: 'Ej.: Caja sorpresa de panadería',
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.length < 3) return 'Escribí al menos 3 caracteres';
                if (t.length > 160) return 'Máximo 160 caracteres';
                return null;
              },
            ),
            const SizedBox(height: RTokens.s4),
            const Text('Qué clase de oferta es', style: RTokens.titleM),
            const SizedBox(height: RTokens.s2),
            SegmentedButton<TipoOferta>(
              segments: [
                for (final t in TipoOferta.values)
                  ButtonSegment(value: t, label: Text(t.etiqueta)),
              ],
              selected: {_tipo},
              onSelectionChanged: (s) => setState(() => _tipo = s.first),
            ),
            const SizedBox(height: RTokens.s2),
            // Se explica al elegir, no después: el tipo cambia lo que quien
            // compra puede esperar, y el comercio debe saber qué está firmando.
            Text(
              _tipo.explicacion,
              style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
            ),

            const SizedBox(height: RTokens.s3),
            TextFormField(
              controller: _descripcion,
              maxLines: 3,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Qué incluye, cómo se retira...',
              ),
            ),
            const SizedBox(height: RTokens.s3),
            TextFormField(
              controller: _categoria,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Categoría (opcional)',
                hintText: 'Ej.: Panadería',
              ),
            ),

            const SizedBox(height: RTokens.s5),
            const Text('Precio', style: RTokens.titleM),
            const SizedBox(height: RTokens.s3),
            TextFormField(
              controller: _precio,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'Precio de venta',
                prefixText: '${simboloDe(monedaPorDefecto)} ',
              ),
              validator: (v) {
                final c = aCentavos(v ?? '');
                if (c == null) return 'Escribí un importe, por ejemplo 4.50';
                if (c < 1) return 'Tiene que ser mayor que cero';
                return null;
              },
            ),
            const SizedBox(height: RTokens.s3),
            TextFormField(
              controller: _precioOriginal,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'Precio habitual (opcional)',
                helperText: 'Se muestra tachado, para que se vea el ahorro.',
                prefixText: '${simboloDe(monedaPorDefecto)} ',
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.isEmpty) return null;
                final original = aCentavos(t);
                if (original == null) return 'Escribí un importe válido';
                final venta = aCentavos(_precio.text);
                if (venta != null && original <= venta) {
                  return 'Tiene que ser mayor que el precio de venta';
                }
                return null;
              },
            ),

            const SizedBox(height: RTokens.s5),
            const Text('Disponibilidad', style: RTokens.titleM),
            const SizedBox(height: RTokens.s3),
            TextFormField(
              controller: _cantidad,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Unidades'),
              validator: (v) {
                final n = int.tryParse((v ?? '').trim());
                if (n == null || n < 1) return 'Al menos una unidad';
                return null;
              },
            ),
            const SizedBox(height: RTokens.s3),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.schedule, color: RTokens.primary),
              title: const Text('Se puede retirar hasta'),
              subtitle: Text(_fechaLegible(_validoHasta)),
              trailing: TextButton(
                onPressed: _elegirVencimiento,
                child: const Text('Cambiar'),
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: RTokens.s4),
              Container(
                padding: const EdgeInsets.all(RTokens.s3),
                decoration: BoxDecoration(
                  color: RTokens.dangerSoft,
                  borderRadius: BorderRadius.circular(RTokens.radiusMd),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: RTokens.danger, size: 20),
                    const SizedBox(width: RTokens.s2),
                    Expanded(
                      child: Text(
                        _error!,
                        style:
                            RTokens.bodySm.copyWith(color: RTokens.danger),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: RTokens.s5),
            ElevatedButton(
              onPressed: _guardando ? null : _guardar,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              child: _guardando
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Guardar como borrador'),
            ),
            const SizedBox(height: RTokens.s2),
            Text(
              'Queda guardado sin salir al catálogo. Lo publicás cuando quieras '
              'desde «Mis publicaciones».',
              style: RTokens.bodySm.copyWith(color: RTokens.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: RTokens.s6),
          ],
        ),
      ),
    );
  }
}
