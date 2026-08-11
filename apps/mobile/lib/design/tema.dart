import 'package:flutter/material.dart';
import 'tokens.dart';

/// Maps the design tokens onto Flutter's ThemeData, so stock widgets already
/// look right and screens rarely need to style anything themselves.
ThemeData construirTema() {
  final base = ThemeData.light(useMaterial3: true);

  return base.copyWith(
    scaffoldBackgroundColor: RTokens.background,
    colorScheme: base.colorScheme.copyWith(
      primary: RTokens.primary,
      onPrimary: RTokens.onPrimary,
      surface: RTokens.surface,
      error: RTokens.danger,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: RTokens.surface,
      foregroundColor: RTokens.textStrong,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: RTokens.titleM,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: RTokens.primary,
        foregroundColor: RTokens.onPrimary,
        minimumSize: const Size.fromHeight(52),
        elevation: 0,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RTokens.radiusMd),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: RTokens.textStrong,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: RTokens.border),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RTokens.radiusMd),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: RTokens.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: RTokens.s4,
        vertical: RTokens.s4,
      ),
      hintStyle: RTokens.bodySm,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusMd),
        borderSide: const BorderSide(color: RTokens.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusMd),
        borderSide: const BorderSide(color: RTokens.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusMd),
        borderSide: const BorderSide(color: RTokens.primary, width: 1.6),
      ),
    ),
    cardTheme: CardThemeData(
      color: RTokens.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusLg),
        side: const BorderSide(color: RTokens.border),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: RTokens.surface,
      indicatorColor: RTokens.primarySoft,
      elevation: 0,
      labelTextStyle: WidgetStateProperty.all(RTokens.bodySm),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(RTokens.radiusMd),
      ),
    ),
  );
}
