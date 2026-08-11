import 'package:flutter/material.dart';

/// Design tokens — the single place where the visual language is defined.
///
/// Everything visual in this app resolves through here: no screen declares a
/// raw colour, radius or spacing of its own. That is deliberate. The mockups
/// are a *functional* reference, not the final look (see DEC-007); the client's
/// designer is producing the definitive visual identity. When it arrives, the
/// redesign should be a change to this file, not a rewrite of every screen.
///
/// Values below are read off the UX Vision Book mockups.
class RTokens {
  RTokens._();

  // --- Colour ---------------------------------------------------------------

  /// REMATA's brand purple, used for primary actions and emphasis.
  static const Color primary = Color(0xFF5B21D6);
  static const Color primaryDark = Color(0xFF4715AD);
  static const Color primarySoft = Color(0xFFEDE7FD);

  /// Orange, reserved for discount badges and savings emphasis.
  static const Color accent = Color(0xFFF97316);

  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFDCFCE7);
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerSoft = Color(0xFFFEE2E2);
  static const Color warning = Color(0xFFD97706);
  static const Color warningSoft = Color(0xFFFEF3C7);

  static const Color surface = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF8F7FC);
  static const Color border = Color(0xFFE5E3EF);

  static const Color textStrong = Color(0xFF15132B);
  static const Color textBody = Color(0xFF4A4763);
  static const Color textMuted = Color(0xFF8B87A3);
  static const Color onPrimary = Color(0xFFFFFFFF);

  // --- Spacing --------------------------------------------------------------
  // A 4pt scale. Screens compose from these rather than inventing gaps.

  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s8 = 32;
  static const double s10 = 40;

  // --- Shape ----------------------------------------------------------------

  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusXl = 24;
  static const double radiusPill = 999;

  // --- Type -----------------------------------------------------------------

  static const TextStyle displayL = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w800,
    height: 1.2,
    color: textStrong,
  );
  static const TextStyle titleL = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    height: 1.25,
    color: textStrong,
  );
  static const TextStyle titleM = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: textStrong,
  );
  static const TextStyle body = TextStyle(
    fontSize: 15,
    height: 1.45,
    color: textBody,
  );
  static const TextStyle bodySm = TextStyle(
    fontSize: 13,
    height: 1.4,
    color: textMuted,
  );
  static const TextStyle label = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: textBody,
  );
  static const TextStyle price = TextStyle(
    fontSize: 19,
    fontWeight: FontWeight.w800,
    color: primary,
  );
}

/// Money formatting, centralised so no screen invents its own.
///
/// Amounts travel as integer minor units end to end — never as decimals — so
/// rounding cannot drift between client and server. Panama's currency is the
/// balboa, displayed `B/.` and pegged 1:1 to the US dollar.
String formatearPrecio(int centavos, {String moneda = 'PAB'}) {
  final simbolo = moneda == 'PAB' ? 'B/.' : '\$';
  return '$simbolo ${(centavos / 100).toStringAsFixed(2)}';
}
