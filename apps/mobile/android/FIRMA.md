# Firma de la aplicación Android

Sin esto, `flutter build apk --release` produce un APK firmado con la clave de
depuración. Se instala y se prueba, pero **Google Play lo rechaza**.

## Lo primero que hay que entender

Google Play liga la aplicación a la clave con la que se publicó **para
siempre**. Si esa clave se pierde:

- No se puede publicar ninguna actualización.
- Hay que publicar una aplicación distinta, con otro identificador.
- Cada persona que la tenga instalada debe desinstalar y volver a instalar.
- Se pierden las valoraciones y el histórico de descargas.

No es un secreto más. **Es el activo que hay que custodiar mejor de todo el
proyecto.**

## Generar la clave

Se hace **una sola vez**, y la ejecuta quien vaya a custodiarla — no quien
desarrolla.

```bash
keytool -genkey -v \
  -keystore remata-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias remata
```

Pedirá una contraseña y algunos datos de la organización. La validez de 10.000
días —unos 27 años— es lo que recomienda Google: la clave debe sobrevivir a la
aplicación.

## Configurarla

Crear `android/key.properties` con:

```properties
storePassword=<la contraseña del almacén>
keyPassword=<la contraseña de la clave>
keyAlias=remata
storeFile=<ruta absoluta a remata-release.jks>
```

**Ese archivo y el `.jks` no se suben al control de versiones.** Ya están
excluidos.

Comprobar que funcionó:

```bash
flutter build apk --release
```

Si aparece el aviso de que no hay `key.properties`, la configuración no se
está leyendo.

## Dónde guardar la clave

- **Copia en un gestor de contraseñas de la empresa**, no en el equipo de nadie.
- **Segunda copia fuera de línea**, en otro sitio físico.
- Nunca en el repositorio, ni en un adjunto de correo, ni en un chat.

Si en algún momento se usa integración continua para publicar, la clave va en
los secretos del repositorio y se reconstruye en tiempo de compilación — nunca
guardada en él.

## Para publicar en Play

Play prefiere un *app bundle* antes que un APK:

```bash
flutter build appbundle --release
```

El resultado queda en `build/app/outputs/bundle/release/`.

## Cómo comprobar con qué clave está firmado un archivo

```bash
keytool -printcert -jarfile build/app/outputs/flutter-apk/app-release.apk
```

Si el propietario dice `CN=Android Debug`, está firmado con la clave de
depuración y no sirve para publicar.
