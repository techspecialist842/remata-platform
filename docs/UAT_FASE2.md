# Guion de UAT — Fase 2 (Marketplace)

Pruebas de aceptación para ejecutar **a mano**, por personas, sobre el entorno
de staging. No sustituyen a las automatizadas: comprueban lo que ninguna suite
puede comprobar, que es si el producto se entiende.

**Entorno:** `https://staging.remata.app`
**Duración estimada:** 90 minutos con dos personas (una como comprador, otra
como comercio).

## Antes de empezar

Necesitás dos dispositivos o dos navegadores distintos, porque hay que estar
con dos sesiones a la vez. Uno de los dos tiene que poder dar permiso de
ubicación.

Anotá para cada caso: **pasa / falla / dudoso**, y si falla, qué esperabas.
«Dudoso» es una respuesta válida y de las más útiles: significa que funciona
pero no se entiende, y eso es un defecto de producto aunque no lo sea de código.

## Criterio de salida

Se acepta la fase con **cero defectos Sev-1 y Sev-2 abiertos**.

| Severidad | Qué significa | Ejemplo |
|---|---|---|
| Sev-1 | Impide operar o pierde dinero | No se puede reservar; el stock queda descuadrado; se cobra de más |
| Sev-2 | Rompe un caso principal sin alternativa | No se puede calificar; el comercio no ve sus órdenes |
| Sev-3 | Molesta pero hay salida | Un mensaje confuso; una etiqueta mal escrita |
| Sev-4 | Cosmético | Un espaciado, un icono |

---

## 1. Alta y acceso

| # | Paso | Resultado esperado |
|---|---|---|
| 1.1 | Registrarse como comprador con un correo nuevo | Entra directamente al catálogo |
| 1.2 | Cerrar sesión y volver a entrar | Vuelve al catálogo con la misma cuenta |
| 1.3 | Intentar registrarse con el mismo correo | Dice que ya existe, sin crear nada |
| 1.4 | Contraseña de menos de 10 caracteres | Lo avisa **antes** de enviar |
| 1.5 | Registrarse eligiendo «Tengo un comercio» | Entra al panel del comercio, no al catálogo |

## 2. El comercio publica

| # | Paso | Resultado esperado |
|---|---|---|
| 2.1 | Crear una publicación con precio `4,50` | Se guarda como **borrador**, no sale al catálogo |
| 2.2 | Verificar el precio en la lista | Muestra `$ 4.50`, no `$ 450` ni `$ 4.5` |
| 2.3 | Publicarla | Pasa a «En el catálogo» |
| 2.4 | Buscarla desde el otro dispositivo, como comprador | Aparece |
| 2.5 | Elegir tipo «Caja sorpresa» al crear otra | Explica qué implica **mientras** se elige |
| 2.6 | Ver esa oferta como comprador | Se ve la etiqueta «Caja sorpresa» y su explicación antes de reservar |
| 2.7 | Pausar una publicación | Desaparece del catálogo del comprador |
| 2.8 | Poner precio habitual menor que el de venta | Lo rechaza y explica por qué |

## 3. Ubicación y cercanía

| # | Paso | Resultado esperado |
|---|---|---|
| 3.1 | Como comercio sin ubicación, mirar «Mi comercio» | Avisa de que no aparece en búsquedas cercanas |
| 3.2 | Fijar la ubicación con «Usar mi ubicación actual» | La guarda; el aviso desaparece |
| 3.3 | Como comprador, activar «Cerca tuyo» | Pide permiso de ubicación |
| 3.4 | **Negar** el permiso | Lo explica y el filtro queda apagado; la app sigue usable |
| 3.5 | Aceptar el permiso | Muestra la distancia en cada oferta, la más cercana primero |
| 3.6 | Comprobar una distancia contra el mapa | Coincide aproximadamente con la real |
| 3.7 | Apagar el filtro | Vuelven todas las ofertas, sin distancia |

## 4. Reserva

| # | Paso | Resultado esperado |
|---|---|---|
| 4.1 | Reservar 2 unidades | Confirma con número de orden y **código QR** |
| 4.2 | Leer el aviso del diálogo | Dice hasta qué hora el comercio debe confirmar |
| 4.3 | Ir a «Mis pedidos» | La orden aparece, **diciendo qué se reservó** |
| 4.4 | Como comercio, ver «Órdenes» | Aparece con el producto y la cantidad |
| 4.5 | Reservar más unidades de las que hay | Lo impide con un mensaje claro |
| 4.6 | **Con dos dispositivos a la vez**: reservar la última unidad simultáneamente | Uno gana; al otro le dice que alguien se adelantó. **Nunca los dos** |
| 4.7 | Cancelar una reserva propia | Las unidades vuelven al catálogo |

## 5. El comercio atiende

| # | Paso | Resultado esperado |
|---|---|---|
| 5.1 | Confirmar una orden | Pasa a «Confirmada — pendiente de retiro» |
| 5.2 | Marcar «Entregada» | Pasa a entregada y ya no ofrece acciones |
| 5.3 | En otra orden confirmada, «No se presentó» | **Pide confirmación** antes de hacer nada |
| 5.4 | Confirmar el no-show | La unidad vuelve al catálogo |
| 5.5 | Dejar una orden sin confirmar 15 minutos | Caduca sola y libera el stock |

## 6. Reputación

| # | Paso | Resultado esperado |
|---|---|---|
| 6.1 | Calificar una orden entregada, 4 estrellas y comentario | Lo acepta |
| 6.2 | Volver a «Mis pedidos» | Muestra la nota, ya no el botón de calificar |
| 6.3 | Intentar calificar algo no entregado | No se ofrece la opción |
| 6.4 | Como comercio, ver «Mi comercio» | Aparece la calificación |
| 6.5 | Comparar la nota con la media simple | Es **menor** con pocas reseñas. Es correcto: la nota está ponderada para que una sola opinión no valga como cien |
| 6.6 | Responder a una reseña | Se guarda; no cambia la nota |
| 6.7 | Intentar responder dos veces | Lo impide |

## 7. Moderación

| # | Paso | Resultado esperado |
|---|---|---|
| 7.1 | Como comprador, reportar una publicación | Lo acepta |
| 7.2 | Volver a buscarla | **Sigue en el catálogo**. Reportar no la oculta |
| 7.3 | Reportar la misma otra vez | Lo impide |

## 8. Lo que tiene que aguantar

| # | Paso | Resultado esperado |
|---|---|---|
| 8.1 | Poner el teléfono en modo avión y reservar | Dice que no hay conexión; no deja la pantalla colgada |
| 8.2 | Recuperar la conexión y reintentar | Funciona, y **no crea dos órdenes** |
| 8.3 | Dejar la app abierta 20 minutos y luego reservar | Funciona: la sesión se renueva sola |
| 8.4 | Girar la pantalla en cada pantalla principal | No se pierde lo escrito |
| 8.5 | Tamaño de letra del sistema al máximo | Se sigue pudiendo leer y pulsar todo |

---

## Registro de defectos

| # | Caso | Severidad | Qué pasó | Qué se esperaba |
|---|---|---|---|---|
| | | | | |

## Firma

| | Nombre | Fecha | Resultado |
|---|---|---|---|
| Ejecutado por | | | |
| Aceptado por | | | |
