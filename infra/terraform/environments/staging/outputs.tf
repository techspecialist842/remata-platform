output "alb_dns_name" {
  description = "Staging URL: http://<this>/api/health"
  value       = module.alb.dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_service.cluster_name
}

output "ecs_service_name" {
  value = module.ecs_service.service_name
}

output "database_endpoint" {
  value = module.database.endpoint
}
