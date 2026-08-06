resource "aws_ecs_cluster" "this" {
  name = "remata-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "remata-${var.environment}-cluster"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/remata-${var.environment}-api"
  retention_in_days = var.log_retention_days
}

# --- Execution role: pulls the image from ECR and fetches secrets at
# container startup. NOT the same as the task role below. ---
data "aws_iam_policy_document" "execution_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "remata-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.execution_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "random_password" "jwt_access_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_enrollment_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name = "remata/${var.environment}/jwt"
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id
  secret_string = jsonencode({
    access_secret     = random_password.jwt_access_secret.result
    enrollment_secret = random_password.jwt_enrollment_secret.result
  })
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.db_secret_arn, aws_secretsmanager_secret.jwt.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-db-secret"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# --- Task role: assumed by the application code itself at runtime.
# Empty for the Fase 0 skeleton — grow it as real features need AWS
# permissions (e.g. S3 for uploads, SES for email), never widen the
# execution role above for that purpose. ---
resource "aws_iam_role" "task" {
  name               = "remata-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.execution_assume.json
}

resource "aws_ecs_task_definition" "api" {
  family                   = "remata-${var.environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.container_image
      essential = true
      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV", value = var.environment == "prod" ? "production" : var.environment },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "DB_SSL", value = "true" },
        { name = "FRAUD_POLICY", value = var.fraud_policy },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.db_secret_arn}:url::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${aws_secretsmanager_secret.jwt.arn}:access_secret::" },
        { name = "JWT_ENROLLMENT_SECRET", valueFrom = "${aws_secretsmanager_secret.jwt.arn}:enrollment_secret::" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  tags = {
    Name        = "remata-${var.environment}-api-task"
    Environment = var.environment
  }
}

data "aws_region" "current" {}

resource "aws_ecs_service" "api" {
  name            = "remata-${var.environment}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  launch_type     = "FARGATE"
  desired_count   = var.desired_count

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.security_group_id]
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = var.container_port
  }

  # Baseline safety net for Fase 0 — a failed rollout auto-rolls-back
  # instead of leaving a bad deploy stuck. CodeDeploy-based blue-green with
  # traffic shifting is a Fase 5 hardening item (REM-TECH-20), not required
  # for this skeleton.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition] # CI updates this via `aws ecs update-service`, not terraform apply
  }

  depends_on = [aws_iam_role_policy.execution_secrets]
}
