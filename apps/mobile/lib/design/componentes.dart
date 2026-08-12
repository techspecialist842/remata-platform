import 'package:flutter/material.dart';
import 'tokens.dart';
import '../datos/modelos.dart' show monedaPorDefecto;

/// Reusable pieces assembled from tokens. Screens compose these instead of
/// styling widgets inline, so the pending visual redesign lands here and in
/// tokens.dart rather than across every screen (DEC-007).

/// Percentage-off badge, as on the offer cards in the mockups.
class InsigniaDescuento extends StatelessWidget {
  const InsigniaDescuento(this.porcentaje, {super.key});

  final int porcentaje;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
          horizontal: RTokens.s2,
          vertical: RTokens.s1,
        ),
        decoration: BoxDecoration(
          color: RTokens.accent,
          borderRadius: BorderRadius.circular(RTokens.radiusSm),
        ),
        child: Text(
          '-$porcentaje%',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
}

/// Small status pill. Colour carries meaning, but the label always states it in
/// words too — colour alone would exclude anyone who cannot distinguish it.
class Etiqueta extends StatelessWidget {
  const Etiqueta(this.texto, {super.key, this.fondo, this.color});

  final String texto;
  final Color? fondo;
  final Color? color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
          horizontal: RTokens.s3,
          vertical: RTokens.s1 + 2,
        ),
        decoration: BoxDecoration(
          color: fondo ?? RTokens.primarySoft,
          borderRadius: BorderRadius.circular(RTokens.radiusPill),
        ),
        child: Text(
          texto,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color ?? RTokens.primary,
          ),
        ),
      );
}

/// Price with its struck-through reference, matching the mockups' offer cards.
class Precio extends StatelessWidget {
  const Precio({
    super.key,
    required this.centavos,
    this.originalCentavos,
    this.moneda = monedaPorDefecto,
  });

  final int centavos;
  final int? originalCentavos;
  final String moneda;

  @override
  Widget build(BuildContext context) {
    final original = originalCentavos;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(formatearPrecio(centavos, moneda: moneda), style: RTokens.price),
        if (original != null && original > centavos) ...[
          const SizedBox(width: RTokens.s2),
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              formatearPrecio(original, moneda: moneda),
              style: RTokens.bodySm.copyWith(
                decoration: TextDecoration.lineThrough,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Empty / error / no-results state. One component so these never look
/// improvised or inconsistent between screens.
class EstadoVacio extends StatelessWidget {
  const EstadoVacio({
    super.key,
    required this.icono,
    required this.titulo,
    this.detalle,
    this.accion,
  });

  final IconData icono;
  final String titulo;
  final String? detalle;
  final Widget? accion;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(RTokens.s8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(RTokens.s5),
                decoration: const BoxDecoration(
                  color: RTokens.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(icono, size: 32, color: RTokens.primary),
              ),
              const SizedBox(height: RTokens.s4),
              Text(titulo, style: RTokens.titleM, textAlign: TextAlign.center),
              if (detalle != null) ...[
                const SizedBox(height: RTokens.s2),
                Text(detalle!,
                    style: RTokens.bodySm, textAlign: TextAlign.center),
              ],
              if (accion != null) ...[
                const SizedBox(height: RTokens.s5),
                accion!,
              ],
            ],
          ),
        ),
      );
}

/// Placeholder for product imagery. The catalogue has no image field yet, so
/// this stands in — deliberately visible as a placeholder rather than pretending
/// to be a photo.
class ImagenRescate extends StatelessWidget {
  const ImagenRescate({super.key, required this.semilla, this.tamano = 88});

  final String semilla;
  final double tamano;

  static const _paleta = [
    Color(0xFFDCFCE7),
    Color(0xFFFEF3C7),
    Color(0xFFE0F2FE),
    Color(0xFFFCE7F3),
    Color(0xFFEDE7FD),
    Color(0xFFFFEDD5),
  ];

  @override
  Widget build(BuildContext context) {
    final color = _paleta[semilla.hashCode.abs() % _paleta.length];
    return Container(
      width: tamano,
      height: tamano,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(RTokens.radiusMd),
      ),
      child: const Icon(
        Icons.shopping_bag_outlined,
        color: RTokens.textMuted,
        size: 28,
      ),
    );
  }
}

/// Formats a remaining-time span the way a person would say it.
String tiempoRestanteTexto(Duration d) {
  String frase(int n, String unidad) =>
      n == 1 ? 'Queda $n $unidad' : 'Quedan $n $unidad';

  if (d.isNegative) return 'Vencido';
  if (d.inDays >= 1) return frase(d.inDays, 'd');
  if (d.inHours >= 1) return frase(d.inHours, 'h');
  if (d.inMinutes >= 1) return frase(d.inMinutes, 'min');
  return 'Por vencer';
}

/// Stock label. Concordancia en singular: "1 disponible", no "1 disponibles".
String disponiblesTexto(int n) => n == 1 ? '1 disponible' : '$n disponibles';
