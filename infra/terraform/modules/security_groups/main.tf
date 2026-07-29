resource "aws_security_group" "alb" {
  name        = "remata-${var.environment}-alb"
  description = "ALB — public HTTP/HTTPS ingress"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS listener is provisioned once a domain + ACM cert are confirmed
  # (see README — deferred, staging currently serves over the ALB's plain
  # HTTP DNS name only). Port kept open here so the listener can be added
  # without a security-group change.
  ingress {
    description = "HTTPS (listener pending ACM cert)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "remata-${var.environment}-alb-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "ecs_service" {
  name        = "remata-${var.environment}-ecs-service"
  description = "ECS Fargate tasks — ingress only from the ALB"
  vpc_id      = var.vpc_id

  ingress {
    description     = "From ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "remata-${var.environment}-ecs-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "database" {
  name        = "remata-${var.environment}-database"
  description = "RDS Postgres — ingress only from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "remata-${var.environment}-db-sg"
    Environment = var.environment
  }
}
