# Volver atrás un despliegue

Qué hacer cuando un despliegue sale mal. Escrito para leerse **durante** el
incidente, no antes: pasos concretos, sin contexto que estorbe.

## Lo primero

**El código y la base de datos se revierten por separado, y no en el mismo
sentido.** Volver la imagen atrás es rápido y seguro. Revertir una migración
puede destruir datos escritos desde que se aplicó. Casi siempre lo correcto es
volver el código y **dejar la migración puesta**.

Por eso las migraciones de este proyecto solo añaden. Ninguna de Fase 2 borra
ni renombra columnas, así que la versión anterior del código convive con el
esquema nuevo: le sobran columnas y las ignora.

## 1. Volver la imagen atrás

Las imágenes llevan etiqueta inmutable con el SHA del commit, así que la
anterior sigue en ECR.

```bash
# Qué revisión corre ahora
aws ecs describe-services --cluster remata-staging \
  --services remata-staging-api \
  --query 'services[0].taskDefinition' --output text

# Las últimas revisiones de la familia
aws ecs list-task-definitions --family-prefix remata-staging-api \
  --sort DESC --max-items 5
```

Volver a la revisión anterior:

```bash
aws ecs update-service --cluster remata-staging \
  --service remata-staging-api \
  --task-definition remata-staging-api:<REVISION_ANTERIOR> \
  --force-new-deployment
```

ECS levanta las tareas nuevas antes de bajar las viejas, así que no hay corte.
Tarda entre dos y cuatro minutos.

**Comprobar:**

```bash
curl -s https://staging.remata.app/api/health
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://staging.remata.app/api/v1/catalogo/rescates?page=1&pageSize=1'
```

## 2. Solo si hay que revertir el esquema

Antes de ejecutar nada, respondé esto: **¿qué se escribió en esas columnas
desde que se aplicó la migración?** Si la respuesta no es «nada», revertir
las borra.

```bash
# Qué migraciones están aplicadas
SELECT name, timestamp FROM migrations ORDER BY timestamp DESC LIMIT 5;
```

La reversión es de una en una, la última primero:

```bash
npm run migration:revert   # revierte SOLO la última
```

Para revertir tres, hay que ejecutarlo tres veces y comprobar entre medias.

**Antes, siempre, una copia:**

```bash
aws rds create-db-snapshot \
  --db-instance-identifier remata-staging \
  --db-snapshot-identifier remata-staging-pre-rollback-$(date +%Y%m%d%H%M)
```

## 3. Migraciones de Fase 2 y qué implica revertirlas

| Migración | Qué añade | Al revertir se pierde |
|---|---|---|
| `GeoComercio` | Dirección y coordenadas del comercio | Las ubicaciones que hayan cargado los comercios |
| `TipoRescate` | Tipo de oferta | La clasificación; todo vuelve a ser «unitario» |
| `QrToken` | Hash del código de retiro y su marca de uso | Los códigos emitidos: esas órdenes solo se retiran por número |
| `Reportes` | Tabla de denuncias | **Todas las denuncias, incluidas las sin revisar** |
| `RespuestaResena` | Respuesta del comercio a una reseña | Las réplicas escritas |

Ninguna es necesaria revertir para volver el código atrás. La versión anterior
ignora estas columnas.

## 4. Si el despliegue falló a mitad

El flujo ejecuta las migraciones **antes** de cambiar el tráfico. Si falla ahí,
el servicio sigue sirviendo la versión anterior y no hay nada que revertir: se
arregla la migración y se vuelve a desplegar.

Si falló *después* de cambiar el tráfico, aplicá el paso 1.

## 5. Qué mirar para decidir

```bash
# Errores recientes de la aplicación
aws logs tail /ecs/remata-staging-api --since 15m --filter-pattern ERROR

# Estado de las tareas
aws ecs describe-services --cluster remata-staging \
  --services remata-staging-api \
  --query 'services[0].deployments'
```

Si el registro muestra `idle in transaction` acumulándose, el problema es de
conexiones retenidas: mirá `pg_stat_activity` antes de revertir, porque el
síntoma puede seguir con la versión anterior.

```sql
SELECT count(*), state, wait_event_type
FROM pg_stat_activity WHERE datname = 'remata'
GROUP BY state, wait_event_type ORDER BY count DESC;
```

## 6. Después

Anotá en el registro de incidentes: qué se desplegó, qué falló, qué se hizo y
cuánto duró. Si se revirtió una migración, anotá **qué datos se perdieron** —
esa es la parte que nadie recuerda tres meses después y la que hace falta para
reconstruir.

---

## Producción

Producción sirve en el dominio raíz (`remata.app`) y se despliega **a mano**
con `workflow_dispatch`, no al fusionar. Los mismos pasos, cambiando
`remata-staging` por `remata-prod`.
