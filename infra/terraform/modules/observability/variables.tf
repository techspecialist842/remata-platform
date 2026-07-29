variable "environment" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_name" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "db_instance_id" {
  type = string
}

variable "alert_email" {
  description = "Email for SNS alarm subscription. BLOCKED — pending ops stakeholder confirmation. Leave empty to skip the subscription (alarms still fire, just unsubscribed)."
  type        = string
  default     = ""
}
