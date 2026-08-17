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
| Pasan | 43 (cinco de ellos tras corregir lo que se encontró) |
| No ejecutables (falta la pantalla) | 1 |
| **Total ejecutado** | **44** |

De los nueve defectos anotados, **siete están corregidos y vueltos a
comprobar**, uno se retiró —era un error de la propia ejecución— y los dos que
quedan no son fallos sino pantallas que faltan.

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
| 1 | Toda la app | **Sev-3 — CORREGIDO** | La app estaba escrita en **voseo rioplatense**: «Ingresá», «¿No tenés cuenta?», «Creá una», «Empezá a ahorrar», «Usá al menos 10 caracteres», «Vendé lo que te sobra», «no aparecés», «Probá quitando el filtro» | Panamá usa «tú»: «Entra», «¿No tienes cuenta?», «Crea una» |
| 2 | 1.3 | **Sev-3 — CORREGIDO** | Al registrarse con un correo ya usado, el aviso salía **en inglés**: «Email already registered». Y no era el único: el servidor contestaba en inglés en trece sitios | Un mensaje en español |
| 3 | 6.1 | **Sev-3 — CORREGIDO** | El contador del comentario salía **en inglés**: «1000 characters remaining», y el botón de volver decía «Back» | En español |
| 4 | 7.1–7.3 | **Sev-2** | **No hay forma de reportar una publicación desde la app.** La función existe en el servidor y está probada, pero no hay pantalla | Poder reportar desde la ficha de la oferta |
| 5 | 6.6–6.7 | **Sev-2** | **El comercio no puede responder a una reseña desde la app.** Igual que el anterior: hecho en el servidor, sin pantalla | Poder responder desde «Mi comercio» |
| 6 | 3.2 | **Sev-3 — CORREGIDO** | Con la ubicación ya guardada, la ficha del comercio **seguía diciendo «Todavía no cargaste tu dirección»** mientras el botón de al lado decía «Cambiar ubicación» | Que la ficha refleje que el punto de retiro está puesto |
| 7 | 3.4 | ~~Sev-3~~ **RETIRADO** | **No era un defecto: fue un error de la ejecución.** Al negar el permiso la app sí lo explica —«Bloqueaste el acceso a la ubicación. Puedes habilitarlo desde los ajustes del sistema»—, pero es un aviso efímero y la comprobación lo leyó tarde | — |
| 8 | 8.1 | **Sev-4 — CORREGIDO** | Sin conexión, el aviso al reservar era el genérico «No se pudo completar la compra», que suena a que el problema es la compra. Al entrar sí se hablaba de la conexión: cada pantalla lo adivinaba por su cuenta | Que diga que el problema es la conexión |
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

### Sobre los defectos 1, 2 y 3, ya corregidos

**El voseo** estaba en trece frases de seis archivos. Todas convertidas a
tuteo, que es lo de Panamá. Las pruebas que afirmaban los textos viejos se
actualizaron con ellos.

**El inglés venía de dos sitios distintos**, y solo uno se veía a simple vista:

- **El servidor** contestaba en inglés en trece sitios —«Email already
  registered», «Invalid credentials», «Unauthorized»…—. Traducidos todos. Los
  dos mensajes que son vagos a propósito —los del motor de fraude— siguen
  siéndolo: decir por qué se bloqueó a alguien le enseña qué cambiar para
  pasar.
- **El propio Flutter**, que pone por su cuenta el botón de volver, el contador
  de caracteres y los textos de un calendario. Salían en inglés porque la app
  **no tenía configurado ningún idioma**. Ahora declara español, y con eso caen
  todos a la vez, no solo los dos que encontró el UAT.

Lo segundo no se puede comprobar buscando literales en el código, porque no hay
ninguno: los pone el framework. Se comprobó en la app real —el botón dice
«Atrás»— y quedó una prueba que lo fija, más otra que verifica que `main.dart`
sigue declarando el idioma, para que quitarlo no deje las pruebas en verde con
la app en inglés.

### Sobre el defecto 6, ya corregido

El texto se decidía mirando la **dirección escrita**, que está vacía porque
«Usar mi ubicación actual» solo guarda coordenadas. El icono, el aviso y el
botón, en cambio, miran las **coordenadas**, y por eso sí se enteraban.

Eran dos estados donde hacían falta tres: sin nada, con coordenadas pero sin
dirección escrita, y con dirección. El de en medio ahora dice «Punto de retiro
fijado en el mapa».

### Sobre el defecto 8, ya corregido

El arreglo no fue copiar la frase en una tercera pantalla, que es como empiezan
a divergir. Ahora el cliente distingue **una sola vez** «no llegué al servidor»
de «el servidor dice que no», y todas las pantallas dan el mismo mensaje.

Al hacerlo apareció algo que no estaba en el guion: un corte de red **durante
la renovación de la sesión** cerraba la sesión. Pasar por un túnel en el
momento justo obligaba a escribir la contraseña otra vez. Ahora solo se cierra
cuando el servidor contesta que el refresco no vale.

### Sobre el defecto 7, que no era tal

Lo retiro. La app **sí** explica el permiso denegado; el aviso dura unos
segundos y la comprobación de entonces leyó la pantalla cuando ya se había ido.

Es el mismo error que estuvo a punto de dar por malo el caso 4.6, el de la
sobreventa. Vale la pena dejarlo escrito: **un mensaje efímero se comprueba
yendo a buscarlo enseguida**, y una comprobación que llega tarde no distingue
«no lo dijo» de «ya no está».

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
| 3.2 | **Pasa** | Guarda, el aviso desaparece y la ficha ya es coherente |
| 3.3 | Pasa | Pide el permiso |
| 3.4 | **Pasa** | Lo explica —«Bloqueaste el acceso a la ubicación…»— y la app sigue usable. En la primera ejecución quedó como dudoso por un error de medición |
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
| 8.1 | **Pasa** | Avisa nombrando la conexión y la pantalla no se cuelga |
| 8.2 | **Pasa** | Al recuperar la conexión y reintentar, crea **una sola** orden |
| 8.3 | **Pasa tras corregir** | Fallaba: tras 16 min en reposo, publicar devolvía «Unauthorized», y el segundo intento también (defecto 9). Corregido y vuelto a comprobar con la espera real: funciona a la primera |
| 8.4 | Pasa | Girar la pantalla no borra lo escrito |
| 8.5 | Pasa | Con la letra al máximo todo se lee y se pulsa |

---

## Qué hace falta para cerrar la fase

1. ~~Arreglar el defecto 9~~ — hecho y comprobado.
2. ~~Corregir el voseo y los textos en inglés~~ — hecho y comprobado.
3. ~~Arreglar los defectos 6 y 8~~ — hecho y comprobado.
4. **Decidir sobre los defectos 4 y 5** (reportar y responder): construirlos
   ahora o pasarlos a la siguiente fase. Es lo único que queda, y es decisión
   del cliente.
5. **Media hora de alguien del equipo del cliente** recorriendo la app por
   primera vez, para lo que esta ejecución no puede ver.

## Firma

| | Nombre | Fecha | Resultado |
|---|---|---|---|
| Ejecutado por | Proveedor | 17/08/2026 | 43 pasan · 1 no ejecutable |
| Aceptado por | | | |
