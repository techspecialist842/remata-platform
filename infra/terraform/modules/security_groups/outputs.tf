output "alb_sg_id" {
  value = aws_security_group.alb.id
}

output "ecs_service_sg_id" {
  value = aws_security_group.ecs_service.id
}

output "database_sg_id" {
  value = aws_security_group.database.id
}
