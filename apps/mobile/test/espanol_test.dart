import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

/// La app habla el español de Panamá, donde se usa «tú».
///
/// Esta prueba existe porque el voseo se cuela solo. Se coló al escribir la
/// app entera, y volvió a colarse dos veces más mientras se corregía —una de
/// ellas dentro del propio arreglo del voseo—. Revisarlo a ojo no funciona:
/// cada frase nueva es otra oportunidad de repetirlo.
///
/// No busca todas las formas del voseo, solo las que aparecen de verdad al
/// escribir una interfaz.

/// Palabra suelta, sin `\b`.
///
/// En Dart `\b` es ASCII: después de una vocal acentuada no hay frontera de
/// palabra, así que `\bContá\b` **nunca encaja**. Un guardia escrito así pasa
/// siempre y no protege de nada —comprobado inyectando voseo a propósito—.
RegExp palabra(String p) => RegExp(
      '(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])$p(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])',
    );

/// Cada forma con lo que debería decirse, para que el fallo sirva de algo.
const formas = <String, String>{
  'tenés': 'tienes',
  'podés': 'puedes',
  'querés': 'quieres',
  'sabés': 'sabes',
  'buscás': 'buscas',
  'aparecés': 'apareces',
  'publicás': 'publicas',
  'Ingresá': 'Entra / Escribe',
  'Creá': 'Crea',
  'Empezá': 'Empieza',
  'Usá': 'Usa',
  'Vendé': 'Vende',
  'Probá': 'Prueba',
  'Contá': 'Cuenta',
  'Poné': 'Pon / Escribe',
  'Mostrá': 'Muestra',
  'Revisá': 'Revisa',
  'Escribí': 'Escribe',
  'Elegí': 'Elige',
  'Iniciá': 'Inicia',
  'Activala': 'Actívala',
  'intentá': 'inténtalo',
  'cerca tuyo': 'cerca de ti',
  'cerca suyo': 'cerca de él',
};

List<String> buscarVoseo(Iterable<File> archivos) {
  final hallazgos = <String>[];
  for (final archivo in archivos) {
    final lineas = archivo.readAsLinesSync();
    for (var i = 0; i < lineas.length; i++) {
      // Solo lo que ve el usuario: los comentarios pueden hablar como quieran.
      if (lineas[i].trimLeft().startsWith('//')) continue;
      formas.forEach((forma, correcto) {
        if (palabra(forma).hasMatch(lineas[i])) {
          hallazgos.add(
            '${archivo.path}:${i + 1}  «$forma» -> debería ser «$correcto»',
          );
        }
      });
    }
  }
  return hallazgos;
}

void main() {
  test('el detector encuentra el voseo que se le pone delante', () {
    // Sin esto, un guardia roto pasaría siempre y nadie se enteraría. Es
    // exactamente lo que ocurrió con la primera versión de esta prueba.
    final tmp = File('${Directory.systemTemp.path}/voseo_prueba.dart')
      ..writeAsStringSync("const t = 'Contá qué pasa';\nconst u = 'ok';\n");
    expect(buscarVoseo([tmp]), hasLength(1));
    tmp.deleteSync();
  });

  test('no queda voseo en los textos de la app', () {
    final hallazgos = buscarVoseo(
      Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart')),
    );
    expect(
      hallazgos,
      isEmpty,
      reason: 'Voseo en la interfaz:\n${hallazgos.join('\n')}',
    );
  });
}
