# REMATA — aplicación móvil

Cliente Flutter del marketplace. Son dos aplicaciones dentro del mismo binario,
porque comprador y comercio no comparten ni tareas ni pantallas:

- **Comprador** — registro e inicio de sesión, búsqueda en el catálogo, detalle
  de una oferta, reserva con cupón opcional y seguimiento de los pedidos.
- **Comercio** — alta de publicaciones, publicar y pausar, y las órdenes
  recibidas con su ciclo completo: confirmar, entregar, rechazar o marcar que
  el comprador no se presentó.

Cuál se muestra lo decide el rol que viene en el token de la sesión. Eso sirve
para elegir pantalla, no como control de acceso: el servidor revalida el rol en
cada petición, así que un cliente que se mintiera solo cosecharía 403.

Habla contra la API de Fase 2 (`apps/api`). No duplica reglas de negocio: el
precio, el descuento y la disponibilidad los decide el servidor, y la app los
muestra.

## Ejecutar

La URL de la API se fija al compilar, de modo que el mismo código sirve para
cualquier entorno:

```bash
flutter run --dart-define=REMATA_API=https://staging.remata.app
flutter run --dart-define=REMATA_API=http://127.0.0.1:3000   # API local
```

Sin `--dart-define` apunta a staging.

Para el navegador, la API debe permitir el origen desde el que se sirve la app.
Se declara en el backend con `CORS_ORIGINS`, separando por comas. Ojo:
`localhost` y `127.0.0.1` son orígenes distintos para el navegador, así que hay
que listar el que realmente se use.

```bash
flutter build web --release --dart-define=REMATA_API=https://staging.remata.app
```

## Comprobaciones

```bash
flutter analyze   # sin avisos
flutter test      # 38 pruebas
```

Las pruebas de widget montan cada pantalla contra un cliente HTTP simulado, así
que verifican lo que ve la persona usuaria —importes, descuentos, estados de la
orden, listados vacíos y fallos de red— sin necesidad de servidor ni navegador.

## Cómo está organizado

| Carpeta | Qué contiene |
| --- | --- |
| `lib/design/` | Tokens de color, tipografía y espaciado, más los componentes compartidos. |
| `lib/datos/` | Cliente HTTP, modelos del dominio y el repositorio que usan las pantallas. |
| `lib/pantallas/` | Una pantalla por archivo. Comprador: `auth`, `catalogo`, `detalle`, `pedidos`. Comercio: `publicaciones`, `nueva_publicacion`, `ordenes_recibidas`. |

Tres decisiones que conviene conocer antes de tocar el código:

**El diseño visual está centralizado a propósito.** Todo color, tamaño y
espaciado sale de `lib/design/tokens.dart`. El rediseño pendiente con el equipo
de diseño se aplica cambiando ese archivo, no recorriendo las pantallas
(decisión DEC-007).

**Los importes viajan como enteros en centavos**, junto con su moneda, y solo se
formatean al pintarlos. Nunca se opera con decimales: en dinero, redondear dos
veces es perder un centavo. Lo que la persona teclea (`7,25`, `7.25`, `7`) se
convierte partiendo en unidades y céntimos, no multiplicando por cien en coma
flotante. La moneda la manda el servidor en cada registro y la pantalla la
sigue; el MVP opera en USD según el modelo canónico de datos.

**Solo se ofrece la acción que la API acepta.** Un borrador se publica, uno
publicado se pausa; sobre un vencido o un retirado no se ofrece nada. Un botón
que solo puede devolver 400 es peor que ningún botón.

## Qué falta

Quedan pendientes las notificaciones push, la reputación del propio comercio
—la API la indexa por `merchantId` y al iniciar sesión la app solo recibe el
`userId`, así que hace falta un endpoint de «mi comercio»— y el resto de
pantallas de los mockups.

Las compilaciones de Android necesitan el SDK 36; la máquina de desarrollo
actual tiene el 35.
