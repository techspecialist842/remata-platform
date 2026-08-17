# Resultado del UAT de Fase 2

**Ejecutado por:** el proveedor, a mano sobre la app real (compilación web del
commit `69a69e7`, el mismo que está desplegado en staging).
**Fecha:** 17 de agosto de 2026.
**Cómo:** dos sesiones simultáneas e independientes —una como comercio, otra
como comprador— más una tercera para los casos que necesitan dos compradores a
la vez. Cada paso se hizo tocando la pantalla, no llamando a la API.

> **Esto no sustituye la prueba del cliente.** Comprueba que la app hace lo que
> tiene que hacer. Lo que no puede comprobar es si **se entiende**, porque quien
> la probó ya sabe cómo funciona. Para eso hace falta media hora de alguien que
> no la haya visto nunca. Los hallazgos 1 y 2 de abajo son justo de ese tipo, y
> aparecieron de casualidad.

---

## Resumen

| | Casos |
|---|---|
| Pasan | 38 (uno de ellos tras corregir el defecto 9) |
| Dudosos (funciona, pero algo no se entiende o no cuadra) | 5 |
| No ejecutables (falta la pantalla) | 1 |
| **Total ejecutado** | **44** |

**Criterio de salida del guion:** cero defectos Sev-1 y Sev-2 abiertos.

**No se cumple todavía**, y ya solo por una cosa: **dos funciones del guion no
existen en la app** —reportar una publicación y responder una reseña—. Las dos
están hechas y probadas en el servidor; lo que falta es la pantalla. Mientras
siga así, 6.6, 6.7 y la sección 7 entera no se pueden ejecutar.

El único fallo de comportamiento que apareció (defecto 9, la sesión vencida)
**ya está corregido y vuelto a comprobar**.

**Nada de lo encontrado impide operar ni pone dinero en riesgo.** No hay
ningún Sev-1.

---

## Lo que funcionó bien, y conviene decirlo

- **No se puede sobrevender.** Dos compradores pulsaron «Reservar» a la vez
  sobre la última unidad. Uno se la llevó; al otro le salió *«Alguien se
  adelantó y ya no quedan unidades suficientes»*. Nunca los dos.
- **El dinero se muestra bien.** Un precio de 4,50 se ve `$ 4.50`, no `$ 450`
  ni `$ 4.5`.
- **La nota está ponderada de verdad.** Una sola reseña de 4 estrellas deja la
  calificación en 4,0 y no la infla.
- **Cancelar devuelve el stock**, y marcar «no se presentó» también, pidiendo
  confirmación antes.
- **La reserva dice hasta cuándo:** *«El comercio debe confirmarla. Si no lo
  hace antes de las 5:58, la reserva se libera automáticamente.»*
- **Reportar no tumba nada.** (Comprobado en el servidor; en la app no hay
  botón todavía.)
- **Aguanta el maltrato.** Sin conexión avisa y no se cuelga; al recuperarla y
  reintentar **no crea dos órdenes**; girar la pantalla no borra lo escrito; y
  con la letra del sistema al máximo todo se sigue leyendo y pulsando.

---

## Registro de defectos

| # | Caso | Severidad | Qué pasó | Qué se esperaba |
|---|---|---|---|---|
| 1 | Toda la app | **Sev-3** | La app está escrita en **voseo rioplatense**: «Ingresá», «¿No tenés cuenta?», «Creá una», «Empezá a ahorrar», «Usá al menos 10 caracteres», «Vendé lo que te sobra», «no aparecés», «Probá quitando el filtro». Son 13 apariciones en 6 archivos | Panamá usa «tú». Debería decir «Ingresa», «¿No tienes cuenta?», «Crea una» |
| 2 | 1.3 | **Sev-3** | Al registrarse con un correo ya usado, el aviso sale **en inglés**: «Email already registered» | Un mensaje en español |
| 3 | 6.1 | **Sev-3** | El contador del comentario de la reseña sale **en inglés**: «1000 characters remaining» | En español, o quitarlo |
| 4 | 7.1–7.3 | **Sev-2** | **No hay forma de reportar una publicación desde la app.** La función existe en el servidor y está probada, pero no hay pantalla | Poder reportar desde la ficha de la oferta |
| 5 | 6.6–6.7 | **Sev-2** | **El comercio no puede responder a una reseña desde la app.** Igual que el anterior: hecho en el servidor, sin pantalla | Poder responder desde «Mi comercio» |
| 6 | 3.2 | **Sev-3** | Con la ubicación ya guardada, la ficha del comercio **sigue diciendo «Todavía no cargaste tu dirección»** mientras el botón de al lado dice «Cambiar ubicación». Se contradicen. El aviso de «no aparecés en búsquedas cercanas» sí desaparece, que es lo importante | Que la ficha refleje que el punto de retiro está puesto |
| 7 | 3.4 | **Sev-3** | Al **negar** el permiso de ubicación, el filtro de cercanía queda apagado y la app sigue perfectamente usable, pero **no explica por qué** | Un mensaje diciendo que sin permiso no hay búsqueda por cercanía |
| 8 | 8.1 | **Sev-4** | Sin conexión, el aviso es el genérico: «No se pudo completar la compra». No se cuelga, que es lo que más importa | Que diga que el problema es la conexión |
| 9 | 8.3 | **Sev-2 — CORREGIDO** | Con la app abierta 16 minutos sin tocarla, la primera acción que cambiaba algo —publicar, reservar— fallaba mostrando **«Unauthorized»**. Y el segundo intento también: el comercio se quedaba sin poder publicar | Que la sesión se renueve sola y la acción funcione |

### Sobre el defecto 9, ya corregido

La app **sí** sabía renovar la sesión: ante un 401 pedía un token nuevo y
repetía la petición. Pero se saltaba ese camino entero en las peticiones que
llevan `Idempotency-Key`, que son justo las que cambian algo —publicar,
reservar—. El motivo escrito en el código sonaba prudente: el servidor
**podría haber aplicado ya** el primer intento, y repetirlo sería razonar sobre
algo cuyo desenlace no se conoce.

Al saltarse ese camino, **tampoco se renovaba el token**. Y como toda acción
que cambia algo pasa por ahí, el segundo intento fallaba igual, y el tercero.
El comercio se quedaba sin poder publicar viendo una palabra en inglés.

**El supuesto era falso.** Se comprobó contra la API: se mandó una petición con
clave de idempotencia y token inválido —401—, y después **la misma clave** con
un token válido. Creó el recurso. El 401 no consume la clave porque lo emite el
guardia de autenticación antes de que corra nada, así que **un 401 es prueba de
que la operación no se aplicó**.

Repetir es seguro por dos motivos independientes:

1. El 401 demuestra que no se aplicó nada.
2. La repetición lleva **la misma** clave de idempotencia. Aunque el primer
   intento se hubiera aplicado, el servidor devolvería el resultado guardado en
   vez de duplicar. Para eso existe la clave.

Corregido en [`api.dart`](../apps/mobile/lib/datos/api.dart). **Verificado
esperando de verdad los 16 minutos**: publicar funciona a la primera, y la
renovación es invisible. Cubierto por cinco pruebas nuevas en
[`sesion_test.dart`](../apps/mobile/test/sesion_test.dart), que se comprobaron
contra el código anterior antes de darlas por buenas —fallaban, que es lo que
las hace valer algo—.

### Sobre el defecto 6, que tiene arreglo pequeño

El texto se decide mirando la **dirección escrita**, que está vacía porque
«Usar mi ubicación actual» solo guarda coordenadas. El icono, el aviso y el
botón, en cambio, miran las **coordenadas**, y por eso sí se enteran. Es una
línea: [`cuenta_comercio.dart:275`](../apps/mobile/lib/pantallas/cuenta_comercio.dart#L275).

### Sobre los defectos 4 y 5

No son errores: es alcance que quedó a medias entre servidor y app. Conviene
que el cliente decida si entran en Fase 2 —y entonces hay que construir las dos
pantallas— o si se pasan a la siguiente fase y se descuelgan del criterio de
salida.

---

## Detalle por sección

### 1. Alta y acceso

| # | Resultado | Nota |
|---|---|---|
| 1.1 | Pasa | El comprador entra directo al catálogo |
| 1.2 | Pasa | Cierra sesión y vuelve a entrar con la misma cuenta |
| 1.3 | Dudoso | Avisa y no crea nada, pero **en inglés** (defecto 2) |
| 1.4 | Pasa | «Usá al menos 10 caracteres», **antes** de enviar |
| 1.5 | Pasa | El comercio entra al panel, no al catálogo |

### 2. El comercio publica

| # | Resultado | Nota |
|---|---|---|
| 2.1 | Pasa | Queda en borrador, fuera del catálogo |
| 2.2 | Pasa | Muestra `$ 4.50` |
| 2.3 | Pasa | Al publicar pasa a «En el catálogo» |
| 2.4 | Pasa | El comprador la encuentra |
| 2.5 | Pasa | «El contenido es sorpresa: lo elige el comercio con lo que le haya quedado. Por eso está más barato», mientras se elige |
| 2.6 | Pasa | Etiqueta en la lista y explicación en la ficha, antes de reservar |
| 2.7 | Pasa | Al pausarla desaparece del catálogo |
| 2.8 | Pasa | «Tiene que ser mayor que el precio de venta» |

### 3. Ubicación y cercanía

| # | Resultado | Nota |
|---|---|---|
| 3.1 | Pasa | «Sin ubicación no aparecés cuando alguien busca ofertas cerca suyo» |
| 3.2 | Pasa con reparo | Guarda y el aviso desaparece, pero la ficha se contradice (defecto 6) |
| 3.3 | Pasa | Pide el permiso |
| 3.4 | Dudoso | Negarlo no rompe nada, pero no se explica (defecto 7) |
| 3.5 | Pasa | Aparece la distancia en cada oferta |
| 3.6 | Pasa | Comprador y comercio en el mismo punto: dice 0 m |
| 3.7 | Pasa | Al apagar el filtro vuelven todas, sin distancia |

### 4. Reserva

| # | Resultado | Nota |
|---|---|---|
| 4.1 | Pasa | Número de orden y código QR |
| 4.2 | Pasa | Dice hasta qué hora tiene que confirmar el comercio |
| 4.3 | Pasa | «Mis pedidos» dice qué se reservó |
| 4.4 | Pasa | El comercio ve producto y cantidad |
| 4.5 | Pasa | No deja pedir más de lo que hay |
| 4.6 | **Pasa** | Dos a la vez sobre la última unidad: uno gana, al otro se le explica. **Nunca los dos** |
| 4.7 | Pasa | Cancelar devuelve las unidades al catálogo |

### 5. El comercio atiende

| # | Resultado | Nota |
|---|---|---|
| 5.1 | Pasa | «Confirmada — pendiente de retiro» |
| 5.2 | Pasa | Entregada, y ya no ofrece acciones |
| 5.3 | Pasa | «No se presentó» pide confirmación antes |
| 5.4 | Pasa | La unidad vuelve al catálogo |
| 5.5 | **Pasa** | Reserva creada a las 12:49:15, vencía a las 13:04:15 —quince minutos exactos—. Caducó sola y el stock volvió a 2 de 2 |

### 6. Reputación

| # | Resultado | Nota |
|---|---|---|
| 6.1 | Pasa | Acepta 4 estrellas con comentario (con el contador en inglés, defecto 3) |
| 6.2 | Pasa | Muestra la nota y ya no ofrece calificar |
| 6.3 | Pasa | No ofrece calificar una orden sin entregar |
| 6.4 | Pasa | El comercio ve su calificación |
| 6.5 | Pasa | Con una reseña de 4, la nota es 4,0 y no sube más |
| 6.6 | **No ejecutable** | No hay pantalla para responder (defecto 5) |
| 6.7 | **No ejecutable** | Ídem |

### 7. Moderación

| # | Resultado | Nota |
|---|---|---|
| 7.1–7.3 | **No ejecutable** | No hay pantalla para reportar (defecto 4) |

### 8. Lo que tiene que aguantar

| # | Resultado | Nota |
|---|---|---|
| 8.1 | Dudoso | Avisa y no se cuelga, pero el mensaje es genérico (defecto 8) |
| 8.2 | **Pasa** | Al recuperar la conexión y reintentar, crea **una sola** orden |
| 8.3 | **Pasa tras corregir** | Fallaba: tras 16 min en reposo, publicar devolvía «Unauthorized», y el segundo intento también (defecto 9). Corregido y vuelto a comprobar con la espera real: funciona a la primera |
| 8.4 | Pasa | Girar la pantalla no borra lo escrito |
| 8.5 | Pasa | Con la letra al máximo todo se lee y se pulsa |

---

## Qué hace falta para cerrar la fase

1. ~~Arreglar el defecto 9~~ — hecho y comprobado.
2. **Decidir sobre los defectos 4 y 5** (reportar y responder): construirlos
   ahora o pasarlos a la siguiente fase. Esto sí es decisión del cliente, y es
   lo único que bloquea el criterio de salida.
3. **Corregir el voseo** y los tres textos en inglés. Es trabajo de un rato y
   cambia mucho cómo se percibe la app en Panamá.
4. **Media hora de alguien del equipo del cliente** recorriendo la app por
   primera vez, para lo que esta ejecución no puede ver.

Los defectos 6, 7 y 8 son pequeños y se pueden arreglar sin esperar a nadie.

## Firma

| | Nombre | Fecha | Resultado |
|---|---|---|---|
| Ejecutado por | Proveedor | 17/08/2026 | 36 pasan · 5 dudosos · 1 no ejecutable |
| Aceptado por | | | |
