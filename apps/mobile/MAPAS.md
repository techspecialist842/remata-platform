# Mapa de ofertas — cómo configurar las claves

Todo está montado. Falta pegar dos claves, y el mapa funciona.

---

## Lo que hace falta

**Dos claves distintas** del proyecto REMATA en Google Cloud: una para Android
y otra para iOS.

Una sola clave compartida obligaría a dejarla sin restringir, que es
exactamente lo que no conviene: la clave viaja dentro de la aplicación y
cualquiera puede extraerla del archivo instalable. Lo que impide que la usen a
costa de la cuenta de facturación **no es esconderla, es restringirla**.

---

## Android

**1. Crear la clave** en Google Cloud → APIs y servicios → Credenciales.

**2. Restringirla:**

| Campo | Valor |
|---|---|
| Tipo de restricción | Aplicaciones para Android |
| Nombre del paquete | `app.remata.remata_movil` |
| Huella SHA-1 | *(ver abajo)* |

**3. Pegarla.** Copiar `android/mapas.properties.ejemplo` a
`android/mapas.properties` y poner la clave. Ese archivo **no se sube al
repositorio**, igual que la clave de firma.

### La huella SHA-1

Sale de la clave de firma de publicación, que hay que crear antes
(ver [`android/FIRMA.md`](android/FIRMA.md)). Con el almacén ya creado:

```
keytool -list -v -keystore <ruta-del-almacen> -alias <alias>
```

De la salida se copia la línea `SHA1:`.

**Hasta que exista esa clave, la de Google no se puede restringir por
aplicación.** Mientras tanto se puede dejar restringida solo por API, que
sirve para desarrollar pero no para publicar.

---

## iOS

**1. Crear una segunda clave**, distinta de la de Android.

**2. Restringirla:**

| Campo | Valor |
|---|---|
| Tipo de restricción | Aplicaciones para iOS |
| Identificador del paquete | `app.remata.remataMovil` |

No es un error de tipeo que difiera del de Android: Android no admite
mayúsculas cómodamente en el paquete e iOS no admite guiones bajos.

**3. Pegarla.** Copiar `ios/Flutter/Mapas.xcconfig.ejemplo` a
`ios/Flutter/Mapas.xcconfig`. Tampoco se sube al repositorio.

---

## Qué pasa si falta la clave

**La aplicación compila y funciona igual.** El mapa es un añadido: buscar por
cercanía, ver la distancia de cada oferta y reservar no dependen de él.

Lo que se ve sin clave es **un mapa gris y vacío**. Ocurre dentro del
componente nativo de Google y la aplicación no puede sustituirlo por un
mensaje. Si alguien reporta «el mapa no carga», lo primero que hay que mirar es
si la clave está puesta y bien restringida.

En iOS, además, no se llega a inicializar el componente. Es deliberado:
inicializarlo con una clave vacía hace que la aplicación **se cierre al
arrancar**, y una aplicación que no abre es mucho peor que una sin mapa.

---

## Coste

Google Maps Platform da **200 dólares mensuales de uso gratuito**, que con el
volumen inicial no se agotan.

Aun así conviene **poner un límite de gasto en el proyecto**. Una clave mal
restringida y sin tope puede generar una factura desagradable, y el tope es lo
único que la acota si algo se escapa.

---

## Lo que no está comprobado

Lo de Android está montado y comprobado hasta donde se puede sin la clave.

**Lo de iOS está escrito pero no se ha ejecutado nunca.** El proyecto de iPhone
no se ha compilado todavía —hace falta una Mac— así que la conexión de la clave
en `AppDelegate.swift` y en los archivos de configuración está hecha según la
documentación de Google, no verificada. La primera compilación en una Mac es
donde se sabrá.
