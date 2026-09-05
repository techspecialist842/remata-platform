# Cobro al reservar (Mundo A) — diseño y qué hace falta para empezar

**Decisión del cliente:** el comprador paga al reservar, no al retirar. Después
del pago recibe su código de retiro, y el comercio valida ese código al
entregar. Se prefiere gestionar devoluciones antes que permitir reservas sin
pago que bloqueen inventario y luego nadie recoja.

Esta nota traduce esa decisión a lo que hay construido, y dice qué falta.

---

## Lo que la decisión confirma

El flujo elegido **ya es el que está especificado** en *Órdenes, Pagos,
Liquidaciones y Reembolsos*: reserva de inventario → orden preliminar →
autorización del pago → confirmación → preparación → retiro → liberación
financiera.

No hay que rediseñar nada. Hay que construirlo.

---

## Lo que ya existe y no cambia

**El código de retiro está hecho y probado.** Se genera al crear la orden, el
servidor guarda solo su huella y el comercio lo valida al entregar. Lo único
que cambia es **cuándo** se emite: después del cobro en vez de después de la
reserva.

**La reserva de inventario es atómica.** Dos compradores no pueden llevarse la
misma unidad; está comprobado con compras simultáneas reales.

**La ventana de quince minutos existe.** Hoy es el plazo para que el comercio
confirme. Pasa a ser **el plazo para pagar**, que es su sentido natural: es la
retención de inventario, y quien la consume es quien está pagando.

---

## Estados

La especificación define trece. No hacen falta todos desde el primer día, y
varios dependen de qué exija la pasarela.

**Los que hay hoy:** creada, confirmada, cumplida, cancelada.

**Los que añade el cobro:**

| Estado | Cuándo |
|---|---|
| `pago_pendiente` | La orden espera respuesta del procesador |
| `pagada` | El cobro se autorizó y el inventario quedó confirmado |

**Los que conviene esperar:** `autenticacion_requerida` —para 3D Secure— y
`pago_autorizado` como paso intermedio. Los dos dependen de cómo notifique la
pasarela, y construirlos antes de saberlo es adivinar.

`en_preparacion`, `lista_para_retirar` y `disponible_para_retiro` son
refinamientos operativos del estado confirmado. Se pueden añadir después sin
tocar lo financiero.

---

## La regla que no se puede romper

**Sin pago no hay código de retiro.** Es la única forma de que la decisión
signifique algo: si el código se emitiera antes, la orden sería una reserva sin
pago con otro nombre.

En la tabla de transiciones, eso es que `creada` deje de poder pasar
directamente a `confirmada`. Hoy puede, y debe dejar de poder.

---

## Qué hace falta para empezar

**Una cuenta de la pasarela de pago.** Hoy no hay ninguna configurada en el
sistema — ni claves, ni entorno de pruebas, ni nada.

El registro de decisiones fija Stripe como pasarela de cobro al comprador para
Panamá, con un libro contable interno y liquidación semanal por transferencia,
sin Stripe Connect. Esa decisión sigue en pie y no la cuestiono; lo que falta
es la cuenta.

Concretamente:

1. **Cuenta de Stripe** a nombre de REMATA, con el entorno de pruebas activo
2. **Las claves del entorno de pruebas**, que no van al repositorio
3. **Confirmar la moneda y el país de la cuenta**, porque condicionan qué
   métodos de pago se pueden ofrecer

Con el entorno de pruebas basta para construirlo entero. El de producción hace
falta solo al final.

---

## Por qué no se empezó a construir todavía

Sin pasarela, cambiar el flujo dejaría las órdenes atrapadas en
`pago_pendiente` sin forma de avanzar: el marketplace dejaría de funcionar.

Y construir los estados sin conectarlos sería escribir código que nadie ejecuta
y que puede no encajar con lo que la pasarela real exija cuando llegue.

Es preferible esperar a tener con qué probarlo.

---

## Mundo B queda fuera

El cliente describió un segundo flujo para activos de mayor valor, donde no se
paga el importe completo dentro de REMATA y se usa un esquema de reserva con
comprobante.

**Ese flujo no está en la documentación del proyecto.** Se buscó en los quince
documentos de negocio y no aparece, ni con ese nombre ni con otro; lo que sí
dice el documento de visión es que REMATA no será una casa de subastas.

Es muy posible que se acordara por otra vía. Pero para diseñarlo hace falta
tenerlo escrito:

- Qué se paga dentro de REMATA y qué fuera
- Qué es exactamente el comprobante, quién lo emite y quién lo valida
- Qué ocurre si el comprador no completa el pago fuera de la plataforma
- Si el inventario queda bloqueado mientras tanto, y por cuánto tiempo

Mundo A no depende de Mundo B, así que se puede construir primero.
