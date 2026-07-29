output "alb_dns_name" {
  value = module.alb.dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_service.cluster_name
}

output "database_endpoint" {
  value = module.database.endpoint
}
