# ADR-001 — Redis y KMS para cerrar los hallazgos 4 y 6

**Estado:** propuesto · **Fecha:** 2026-08-16
**Cierra:** hallazgo 6 (estado del motor de fraude en memoria) y hallazgo 4
(secreto TOTP sin cifrar a nivel de aplicación) de la revisión de seguridad de
Fase 1.

## El problema, en una frase cada uno

**Hallazgo 6.** Los contadores de velocidad del motor de fraude —y ahora
también los del límite de tasa— viven en un `Map` del proceso. Con una
instancia funciona. Con dos, cada una ve la mitad del tráfico y la protección
se degrada **en silencio**: nada falla, simplemente deja de proteger. Es
condición previa al escalado, no a operar.

**Hallazgo 4.** `users.mfa_secret` está en texto plano. El cifrado en reposo de
RDS protege contra el robo del disco, no contra quien consiga leer la base
—inyección SQL en otro módulo, credenciales filtradas, un volcado mal
guardado—. Quien lea esa tabla obtiene los secretos TOTP de todos los
administradores y puede generar códigos válidos indefinidamente, anulando el
segundo factor por completo.

---

## Decisión 1 — ElastiCache for Redis, en nodo, no serverless

### Qué se descartó y por qué

**ElastiCache Serverless.** Es la opción cómoda, pero su mínimo facturable
ronda los 90 USD al mes por entorno aunque no se use. Para tres entornos serían
~270 USD mensuales para guardar contadores que caben en unos pocos megabytes.
No paga.

**Una tabla en PostgreSQL.** Cero infraestructura nueva, y esa es toda su
virtud. El límite de tasa escribe en **cada petición**: llevaría a la base
primaria un volumen de escrituras que no tiene nada que ver con el negocio,
compitiendo por las mismas conexiones cuyo agotamiento ya nos costó un
incidente en Fase 2.

**DynamoDB.** Encaja bien —contadores atómicos, TTL nativo, sin clúster que
mantener— y sería más barato a bajo volumen. Se descarta porque obligaría a
escribir un adaptador de almacenamiento propio para el limitador, mientras que
para Redis existe uno mantenido. La complejidad se paga en mantenimiento, no
en factura.

### Lo que se adopta

| Entorno | Topología | Instancia | Coste aprox. |
|---|---|---|---|
| dev | 1 nodo | `cache.t4g.micro` | ~12 USD/mes |
| staging | 1 nodo | `cache.t4g.micro` | ~12 USD/mes |
| prod | 2 nodos, conmutación automática, multi-AZ | `cache.t4g.micro` | ~25 USD/mes |

**Ubicación y acceso.** Subredes privadas, en el grupo de subredes que ya usa
RDS. Grupo de seguridad nuevo que solo admite el puerto 6379 desde el grupo de
las tareas de ECS — igual que la base de datos hoy. Sin acceso público.

**Cifrado.** En tránsito (TLS) y en reposo, ambos activos. Token de
autenticación en Secrets Manager, inyectado como el resto de secretos.

**Qué se guarda.** Solo contadores efímeros con vencimiento: ventanas del
límite de tasa y velocidad del motor de fraude. **Ningún dato personal y nada
que no se pueda perder.** Si Redis se vacía, el sistema pierde memoria de los
últimos minutos, no información.

### La decisión que hay que tomar explícitamente: qué pasa si Redis cae

No es un detalle de implementación, es una elección de negocio.

- **Límite de tasa: falla abierto.** Si Redis no responde, se deja pasar el
  tráfico. Un caché caído no puede convertirse en una caída del marketplace.
- **Motor de fraude: falla según `FRAUD_POLICY`**, que ya existe y hoy vale
  `fail-open`. Se mantiene el comportamiento actual y la decisión sigue siendo
  una variable, no código.

Ambas elecciones priorizan disponibilidad sobre protección. Es lo correcto para
un marketplace en MVP y **debe revisarse antes de mover dinero real**.

---

## Decisión 2 — KMS con cifrado directo, sin sobre

### Qué se descartó y por qué

**Cifrado de sobre con claves de datos.** Es el patrón habitual y aquí sería
sobreingeniería: existe para payloads grandes o para volúmenes de peticiones
que harían caro llamar a KMS. Un secreto TOTP ocupa ~32 caracteres —muy por
debajo del límite de 4 KB de KMS— y se descifra solo cuando un administrador
inicia sesión o completa su alta. Son decenas de llamadas al mes, no millones.

### Lo que se adopta

Una clave gestionada por el cliente **por entorno**, con alias
`alias/remata-<entorno>-mfa`, rotación automática anual, y cifrado directo con
`Encrypt`/`Decrypt`.

**La política de la clave separa dos papeles**: quien administra la clave no
puede descifrar con ella, y la única identidad autorizada a `Decrypt` es el rol
de tarea de ECS. Esto es lo que hace que leer la base de datos no alcance:
quien robe las credenciales de PostgreSQL obtiene texto cifrado y nada más.

**Contexto de cifrado ligado al usuario.** Cada secreto se cifra con
`{"userId": "<uuid>"}` como contexto. KMS exige el mismo contexto para
descifrar, así que un texto cifrado copiado de una fila a otra **no funciona**.
Sin esto, alguien con acceso de escritura a la base podría mover el secreto de
un administrador a otra cuenta y quedarse con su segundo factor.

**Punto de enlace de VPC para KMS** en producción: mantiene el tráfico fuera de
internet y evita el coste de datos del NAT. En dev y staging se puede empezar
sin él.

### La migración, que es la parte delicada

Hay administradores con secretos en texto plano. No se puede cambiar el formato
de golpe sin dejarlos fuera.

1. El código aprende a **leer los dos formatos**: si el valor lleva el prefijo
   `kms:v1:` lo descifra, si no, lo usa tal cual.
2. Se despliega. Nada cambia todavía para nadie.
3. Un proceso de respaldo cifra los secretos existentes, de uno en uno.
4. Cuando no queden textos planos —se comprueba con una consulta—, se retira la
   rama que lee sin cifrar.

Los pasos 1 y 4 son despliegues distintos, deliberadamente. Saltarse el paso 1
significa que el despliegue y el respaldo tienen que ser simultáneos, y no lo
son nunca.

### Lo que hay que aceptar

**Si KMS deja de responder, los administradores no pueden iniciar sesión.**
Aquí no cabe fallar abierto: descifrar el segundo factor sin KMS es
exactamente lo que se está impidiendo. Se mitiga con reintentos y una alarma,
no eliminando la dependencia. La disponibilidad de KMS es del 99,999%, y el
alcance del fallo son las cuentas de administración, no los compradores.

---

## Coste total

| Concepto | Mensual |
|---|---|
| Redis dev + staging | ~24 USD |
| Redis prod (2 nodos) | ~25 USD |
| KMS, 3 claves | 3 USD |
| Peticiones a KMS | < 1 USD |
| Punto de enlace de VPC (prod) | ~7 USD |
| **Total** | **~60 USD/mes** |

Cifras de referencia para `us-east-1`; la región definitiva puede variarlas.

---

## Qué cambia en el código

| Dónde | Cambio |
|---|---|
| `app.module.ts` | Almacenamiento Redis para el limitador, con degradación a memoria si no hay conexión |
| `fraud/` | Contadores de velocidad a Redis, respetando `FRAUD_POLICY` |
| `auth/mfa/` | Cifrar y descifrar el secreto contra KMS, con contexto de usuario |
| `entities/user.entity.ts` | Sin cambios: el texto cifrado cabe en la columna actual |
| Migraciones | Ninguna. El respaldo es un proceso, no un cambio de esquema |

Que no haga falta migración es deliberado: el formato nuevo se distingue por
prefijo, así que ambos conviven en la misma columna durante la transición.

---

## Lo que hace falta para empezar

1. **Aprobación del coste** (~60 USD/mes).
2. **Confirmar la elección de fallar abierto** en el límite de tasa y el motor
   de fraude.
3. **`terraform apply`** en los tres entornos, que ejecuta el cliente.

Sin lo tercero no hay nada que desplegar, así que conviene decidir 1 y 2 antes
de escribir el código.
