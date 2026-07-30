resource "aws_lb" "this" {
  name               = "remata-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.security_group_id]
  subnets            = var.public_subnet_ids

  # PHI/PCI-adjacent traffic (auth, payments) — enable at minimum for
  # staging/prod once real user data flows through. Cheap to turn on now.
  enable_deletion_protection = false

  tags = {
    Name        = "remata-${var.environment}-alb"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "api" {
  name        = "remata-${var.environment}-api"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # required for awsvpc-networked Fargate tasks

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }

  deregistration_delay = 15

  tags = {
    Name        = "remata-${var.environment}-api-tg"
    Environment = var.environment
  }
}

locals {
  has_domain   = var.domain_name != ""
  https_active = local.has_domain && var.activate_https
}

# HTTP listener: forwards directly to the target group until HTTPS is
# actually live (cert issued + activate_https flipped true), then switches
# to a 301 redirect. Keeping it as "forward" during the cert-request
# window means http://<domain> already works the moment DNS is pointed at
# the ALB, even before the certificate validates.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.https_active ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.api.arn
    }
  }

  dynamic "default_action" {
    for_each = local.https_active ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

# DNS is managed externally (Cloudflare), not Route53 -- this module only
# requests the certificate and reports what to configure. Two manual DNS
# steps at the external provider, once per domain:
#   1. Add the CNAME from acm_validation_record output (validates the cert)
#   2. Point the domain at alb_dns_name output (CNAME, or Cloudflare's
#      "CNAME flattening" if it's an apex domain)
# Terraform intentionally does NOT wait for validation (aws_acm_certificate_
# validation would block/timeout on records it can't see or create) --
# apply again with activate_https=true once the cert shows ISSUED in ACM.
resource "aws_acm_certificate" "this" {
  count             = local.has_domain ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "remata-${var.environment}-cert"
    Environment = var.environment
  }
}

resource "aws_lb_listener" "https" {
  count             = local.https_active ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.this[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
