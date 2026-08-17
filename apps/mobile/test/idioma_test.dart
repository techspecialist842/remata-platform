import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Los textos que pone Flutter por su cuenta.
///
/// El botón de volver, el contador de caracteres de un campo, los botones de un
/// calendario: no los escribe nadie de este repositorio, los pone el framework
/// según el idioma configurado. Sin configurar ninguno salen en inglés, y el
/// UAT los encontró así en medio de una app en español: «Back» en la ficha de
/// una oferta y «1000 characters remaining» al calificar.
///
/// Se prueban aquí porque no hay otro sitio donde aparezcan: no son literales
/// que se puedan buscar en el código.

/// La misma configuración de idioma que monta `main.dart`.
Widget conIdiomaDeLaApp(Widget hijo) => MaterialApp(
      locale: const Locale('es'),
      supportedLocales: const [Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: hijo,
    );

void main() {
  testWidgets('el botón de volver dice «Atrás», no «Back»', (tester) async {
    await tester.pumpWidget(conIdiomaDeLaApp(const Scaffold()));
    final ctx = tester.element(find.byType(Scaffold));
    expect(MaterialLocalizations.of(ctx).backButtonTooltip, 'Atrás');
  });

  // El contador que se ve es «0/1000». Lo que salía en inglés era su etiqueta
  // de accesibilidad, que es la que leyó el UAT: «1000 characters remaining».
  testWidgets('el contador de caracteres está en español', (tester) async {
    await tester.pumpWidget(
      conIdiomaDeLaApp(const Scaffold(body: TextField(maxLength: 1000))),
    );
    await tester.pump();

    final ctx = tester.element(find.byType(TextField));
    final etiqueta =
        MaterialLocalizations.of(ctx).remainingTextFieldCharacterCount(1000);
    expect(etiqueta, isNot(contains('characters remaining')));
    expect(etiqueta, contains('caracteres'));
  });

  // Las dos de arriba usan una copia de la configuración. Esta comprueba que
  // la copia sigue siendo fiel: sin ella, quitar la localización de main.dart
  // dejaría las pruebas en verde y la app en inglés.
  //
  // Va como `test` y no como `testWidgets` a propósito: `testWidgets` corre en
  // tiempo simulado y una lectura de disco real nunca termina ahí.
  test('main.dart declara el mismo idioma que se prueba aquí', () {
    final fuente = File('lib/main.dart').readAsStringSync();
    expect(fuente, contains("locale: const Locale('es')"));
    expect(fuente, contains('GlobalMaterialLocalizations.delegate'));
    expect(fuente, contains('GlobalWidgetsLocalizations.delegate'));
    expect(fuente, contains('GlobalCupertinoLocalizations.delegate'));
  });
}
