output "alb_dns_name" {
  value = module.alb.dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_service.cluster_name
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "acm_validation_record" {
  description = "Add this CNAME at Cloudflare to validate the certificate."
  value       = module.alb.acm_validation_record
}

output "acm_certificate_status" {
  value = module.alb.acm_certificate_status
}
