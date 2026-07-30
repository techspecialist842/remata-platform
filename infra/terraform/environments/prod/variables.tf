variable "aws_region" {
  type = string
}

variable "container_image" {
  type = string
}

variable "desired_count" {
  description = "Prod defaults to 2 for basic HA across AZs."
  type        = number
  default     = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "alert_email" {
  type = string
  # No default — prod alarms must reach someone. BLOCKED on ops stakeholder.
}

variable "domain_name" {
  description = "Optional. e.g. app.remata.com or remata.com. Leave empty to stay HTTP-only (not recommended for prod)."
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Optional. Existing Route53 zone (e.g. remata.com) that domain_name belongs to. Required if domain_name is set."
  type        = string
  default     = ""
}
