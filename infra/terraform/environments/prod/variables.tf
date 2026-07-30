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
  description = "Optional. e.g. remata.app (apex). Leave empty to stay HTTP-only (not recommended for prod). DNS is managed externally (Cloudflare)."
  type        = string
  default     = ""
}

variable "activate_https" {
  description = "Set true only after the ACM cert shows ISSUED (see module.alb.acm_certificate_status)."
  type        = bool
  default     = false
}
