locals {
  environment = "dev"
}

module "network" {
  source             = "../../modules/network"
  environment        = local.environment
  single_nat_gateway = true
}

module "security_groups" {
  source      = "../../modules/security_groups"
  environment = local.environment
  vpc_id      = module.network.vpc_id
}

module "database" {
  source                = "../../modules/database"
  environment           = local.environment
  private_subnet_ids    = module.network.private_subnet_ids
  security_group_id     = module.security_groups.database_sg_id
  instance_class        = var.db_instance_class
  multi_az              = false
  deletion_protection   = false
  backup_retention_days = 1
}

module "alb" {
  source            = "../../modules/alb"
  environment       = local.environment
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  security_group_id = module.security_groups.alb_sg_id
}

module "ecs_service" {
  source             = "../../modules/ecs_service"
  environment        = local.environment
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.security_groups.ecs_service_sg_id
  target_group_arn   = module.alb.target_group_arn
  container_image    = var.container_image
  desired_count      = var.desired_count
  db_secret_arn      = module.database.secret_arn
}

module "observability" {
  source                  = "../../modules/observability"
  environment             = local.environment
  ecs_cluster_name        = module.ecs_service.cluster_name
  ecs_service_name        = module.ecs_service.service_name
  alb_arn_suffix          = module.alb.arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  db_instance_id          = "remata-${local.environment}"
  alert_email             = var.alert_email
}
