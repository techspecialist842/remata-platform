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

output "acm_validation_record" {
  description = "Add this CNAME at the external DNS provider (Cloudflare) to validate the certificate. Empty if domain_name isn't set."
  value = local.has_domain ? {
    name  = tolist(aws_acm_certificate.this[0].domain_validation_options)[0].resource_record_name
    type  = tolist(aws_acm_certificate.this[0].domain_validation_options)[0].resource_record_type
    value = tolist(aws_acm_certificate.this[0].domain_validation_options)[0].resource_record_value
  } : null
}

output "acm_certificate_status" {
  description = "Check this in ACM (or `aws acm describe-certificate`) -- must show ISSUED before setting activate_https=true."
  value       = local.has_domain ? aws_acm_certificate.this[0].status : null
}
