output "dns_name" {
  value = aws_lb.this.dns_name
}

output "arn_suffix" {
  description = "For CloudWatch metric dimensions, e.g. app/remata-staging/50dc6c495c0c9188"
  value       = aws_lb.this.arn_suffix
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}

output "target_group_arn_suffix" {
  description = "For CloudWatch metric dimensions, e.g. targetgroup/remata-staging-api/73e2d6bc24d8a067"
  value       = aws_lb_target_group.api.arn_suffix
}
