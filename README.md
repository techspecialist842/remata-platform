# REMATA — Fase 0

Esqueleto de plataforma (Fase 0: validación de arquitectura y fundación) para el marketplace REMATA.

**Staging está en vivo:** `http://remata-staging-208896587.us-east-2.elb.amazonaws.com/api/health` → `200 OK`. Ese es el criterio de aceptación central de Fase 0, cumplido.

Este repositorio es **público**. Los documentos de negocio, especificaciones técnicas, RFP/procurement y el plan de fases (`REMATA_Plan_Revisado.pdf`) son confidenciales y viven en el repositorio privado separado `techspecialist842/remata-docs` — no se suben acá.

## Qué contiene este repositorio

```
apps/api/            Servicio NestJS de ejemplo (health check, Swagger, versionado /api/v1)
infra/terraform/
  bootstrap/          Recursos de una sola vez por cuenta AWS: backend de estado remoto,
                       repositorio ECR compartido, rol OIDC de GitHub Actions
  modules/            Módulos reutilizables: network, security_groups, database, alb,
                       ecs_service, observability
  environments/
    dev/ staging/ prod/   Stacks por entorno, cada uno instanciando los módulos de arriba
.github/workflows/
  ci.yml              Lint + test + build del API, y fmt/validate de Terraform, en cada push/PR
  deploy.yml          Build & push de imagen a ECR + deploy a ECS (auto en push a main → staging)
  terraform-apply.yml Apply de infraestructura, solo manual, con rol IAM separado y más privilegiado
```

## Decisiones ya tomadas (Fase 0)

- **Runtime de contenedores: ECS/Fargate** (no Kubernetes/EKS) — más simple de operar para el tamaño de equipo actual.
- **Autenticación de CI/CD: GitHub OIDC**, no llaves de AWS de larga duración en secrets. Dos roles separados: uno estrecho para deploys de aplicación (`remata-github-actions-deploy`: solo ECR + `ecs:UpdateService`), y uno más amplio solo para cambios de infraestructura (`remata-github-actions-terraform`), gateado por aprobación manual.
- **Un repositorio ECR compartido**, imágenes etiquetadas por entorno + commit SHA, no un repo por entorno.
- **HTTP únicamente por ahora** en el ALB (sin dominio/certificado ACM todavía — ver bloqueos abajo).

## Estado actual — bootstrap ya aplicado

El stack `infra/terraform/bootstrap` ya se ejecutó contra la cuenta AWS real (`793835018474`, región `us-east-2`). Recursos creados:

- Bucket S3 `remata-terraform-state` + tabla DynamoDB `remata-terraform-locks` (backend remoto de Terraform)
- Repositorio ECR `remata-api` → `793835018474.dkr.ecr.us-east-2.amazonaws.com/remata-api`
- Proveedor OIDC de GitHub + los dos roles de IAM (`remata-github-actions-deploy`, `remata-github-actions-terraform`)
- Las 5 Variables del repositorio de GitHub (`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `AWS_TERRAFORM_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`) y los Environments (`dev`, `staging`, `prod`, `infra-staging`, `infra-prod`) ya están configurados en `techspecialist842/remata-platform`.

El usuario IAM `terraform-bootstrap` usado para ese apply único ya fue desactivado (`update-access-key --status Inactive`) — no debe reutilizarse.

**Pendiente, del lado del cliente:**

1. **Required reviewers en los Environments de prod** (`prod`, `infra-prod`, idealmente también `infra-staging`) — hay que agregarlos a mano desde GitHub (Settings → Environments → seleccionar reviewers), y confirmar que el plan de la cuenta/organización de GitHub soporta reglas de protección en repos privados (en cuentas personales gratuitas puede no estar disponible).
2. **Email del stakeholder de operaciones** para las alarmas de CloudWatch (`alert_email` en `infra/terraform/environments/{staging,prod}/terraform.tfvars` — obligatorio antes del go-live de prod).
3. **Dominio + certificado ACM**, si se quiere HTTPS real en vez de solo el DNS del ALB.
4. **Estructura de cuentas a futuro**: por ahora dev/staging/prod comparten la misma cuenta de AWS (más rápido para llegar a Fase 0); migrar a cuentas separadas por entorno es posible más adelante sin rehacer los módulos.

## Estado actual — staging ya aplicado

El stack `infra/terraform/environments/staging` ya se ejecutó completo contra AWS: VPC, subnets, NAT gateway, security groups, RDS Postgres, ALB, ECS cluster/service/task, dashboard + alarmas de CloudWatch. Health check verificado en `http://remata-staging-208896587.us-east-2.elb.amazonaws.com/api/health`.

Bugs reales encontrados y corregidos durante los intentos de apply (no solo teóricos — cada uno bloqueó un apply real):

- El `sub` claim que emite GitHub para OIDC incluye IDs numéricos (`repo:OWNER@ID/REPO@ID:...`), no el formato `repo:OWNER/REPO:...` que la mayoría de la documentación muestra — la política de confianza no lo contemplaba.
- Descripciones de Security Group con guión largo (—); la API de EC2 rechaza caracteres no-ASCII en `GroupDescription`.
- Al rol de Terraform le faltaban `iam:ListRolePolicies` / `iam:ListAttachedRolePolicies` (necesarios para que Terraform lea de vuelta los roles que acaba de crear) y `iam:CreateServiceLinkedRole` (RDS necesita crear su service-linked role la primera vez que se usa en la cuenta).
- `engine_version = "16.4"` de Postgres ya no existe en RDS; se cambió a solo la versión mayor (`"16"`).

## Cómo seguir desde acá (dev / prod)

1. Push a `main` → `ci.yml` corre, y `deploy.yml` construye/publica la imagen a ECR automáticamente.
2. Disparar manualmente `terraform-apply.yml` (stack: `dev` o `prod`, action: `apply`) para crear esos entornos — mismos módulos que staging, debería aplicar limpio ya que los bugs de arriba están corregidos en el código compartido.
3. Confirmar `http://<alb_dns_name>/api/health` responde `200`.

## Qué falta a propósito (fuera de alcance de Fase 0)

- HTTPS/dominio propio (ver pendiente #3 arriba).
- Esquema de base de datos, autenticación/RBAC real, lógica de negocio — eso es Fase 1.
- SLOs formales/error-budget (Fase 5), blue-green con CodeDeploy (mejora sobre el circuit-breaker actual, también Fase 5).
- Cuenta de AWS separada por entorno (ver pendiente #4 arriba).

## Nota de entorno de desarrollo

Este esqueleto se construyó y se probó (build, tests, arranque del servidor, `terraform validate` en los 4 stacks) en un entorno Windows Server sin Docker Linux ni AWS CLI disponibles — el `Dockerfile` no se pudo *construir* localmente (el motor Docker local corre en modo Windows containers), pero es una imagen `node:20-alpine` estándar que sí construirá en los runners `ubuntu-latest` de GitHub Actions.
