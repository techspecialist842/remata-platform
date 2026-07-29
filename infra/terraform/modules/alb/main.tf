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

# HTTP listener only for now — see security_groups module note. Once a
# domain + ACM certificate are confirmed with the client, add an HTTPS
# listener on 443 and change this one to a 301 redirect.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
