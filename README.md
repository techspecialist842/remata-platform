# REMATA — Plataforma

Backend e infraestructura del marketplace REMATA.

**Estado: Fase 1 (Núcleo de la plataforma) completa y desplegada en staging.**

| Ambiente | URL | Estado |
|---|---|---|
| staging | https://staging.remata.app/api/health | En vivo |
| dev | https://dev.remata.app/api/health | En vivo |
| prod | https://remata.app/api/health | En vivo (sin usuarios reales todavía) |

Documentación interactiva de la API: `/api/docs` en cualquiera de los tres.

> Este repositorio es **público**. Los documentos de negocio, especificaciones,
> RFP y el plan de fases son confidenciales y no se suben acá.

## Qué contiene

```
apps/api/                 Backend NestJS
  src/auth/               Registro, login, JWT, MFA de administradores
  src/admin/              Portal de administración
  src/entities/           Modelo de datos
  src/database/           Migraciones y semillas
  src/notifications/      Cola de notificaciones con prioridad
  src/fraud/              Motor base de evaluación de riesgo
  src/audit/              Registro de auditoría inalterable
  src/common/             Guards, filtros, interceptores, decoradores
infra/terraform/
  bootstrap/              Recursos únicos por cuenta: estado remoto, ECR, roles OIDC
  modules/                network, security_groups, database, alb, ecs_service, observability
  environments/           dev, staging, prod
.github/workflows/
  ci.yml                  Lint, tests unitarios, migraciones y pruebas e2e contra PostgreSQL real
  deploy.yml              Imagen a ECR, migraciones como tarea aislada, despliegue a ECS
  terraform-apply.yml     Cambios de infraestructura, solo manual
```

## Fase 1 — qué se entregó

- **Identidad y accesos**: registro y login para usuario, comercio y administrador;
  tokens de renovación de un solo uso; MFA obligatoria para administradores.
- **Estándares de API**: formato uniforme de errores, versionado, paginación,
  `Idempotency-Key` en operaciones sensibles, `X-Correlation-Id` en toda respuesta.
- **Auditoría inalterable** de acciones sensibles.
- **Infraestructura base de notificaciones** con cola por prioridad y preferencias.
- **Motor base de detección de fraude** en registro y login.

Las cuentas de administrador no pueden crearse desde el registro público: solo
las crea un administrador existente, o la semilla inicial.

## Desarrollo local

```bash
cd apps/api
cp .env.example .env        # completar DATABASE_URL y los secretos
npm ci
npm run migration:run
npm run start:dev
```

Requiere un PostgreSQL accesible. Ver `.env.example` para las variables.

```bash
npm run lint
npm run test                # unitarias
npm run test:e2e            # integración, necesita base de datos
```

## Despliegue

Un push a `main` despliega staging automáticamente. Dev y prod son manuales
(`deploy.yml` → Run workflow). Prod exige aprobación humana.

El despliegue ejecuta **las migraciones como tarea aislada antes de mover el
tráfico**: si una migración falla, el despliegue se detiene y el servicio en
funcionamiento no se ve afectado.

Los cambios de infraestructura van por `terraform-apply.yml`, nunca automáticos.

> **Orden importante:** si un cambio de código necesita variables o secretos
> nuevos, aplicar primero la infraestructura y después desplegar. Al revés, la
> aplicación arranca sin lo que necesita.

## Decisiones de arquitectura

- **ECS/Fargate** en lugar de Kubernetes — menor complejidad operativa para el
  tamaño de equipo actual.
- **GitHub OIDC** en lugar de llaves de AWS de larga duración. Dos roles con
  privilegios separados: uno estrecho para desplegar la aplicación, otro más
  amplio solo para infraestructura, con aprobación manual.
- **Un repositorio ECR compartido**, imágenes etiquetadas por ambiente y commit.
  Los tags son inmutables.
- **DNS en Cloudflare**, no Route53. Los certificados se validan por DNS.
- **Migraciones explícitas**, nunca automáticas al arrancar.

## Limitaciones conocidas

- El motor de fraude mantiene estado por instancia. Correcto con una sola
  instancia; **debe migrarse a almacenamiento compartido antes de escalar
  producción**, o la protección se degrada sin aviso.
- Las plantillas de notificación son identificadores, sin composición de
  contenido. El proveedor real de correo y push llega en Fase 4.
- El rol de comercio existe pero aún no tiene funciones propias — Fase 2.

## Qué sigue

**Fase 2 — Marketplace MVP**: catálogo, órdenes, promociones, reputación y
aplicaciones móviles. Depende del diseño visual definitivo.

## Nota sobre el entorno de desarrollo

Este proyecto se construye y prueba en Windows Server. El motor Docker local
opera en modo contenedores Windows, por lo que el `Dockerfile` no se construye
localmente — es una imagen `node:20-alpine` estándar que sí se construye en los
runners de GitHub Actions, donde se valida en cada cambio.
