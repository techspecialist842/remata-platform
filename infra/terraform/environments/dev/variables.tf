variable "aws_region" {
  type = string
}

variable "container_image" {
  type = string
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "alert_email" {
  type    = string
  default = ""
}

variable "domain_name" {
  description = "Optional. e.g. dev.remata.app. Leave empty to stay HTTP-only. DNS is managed externally (Cloudflare)."
  type        = string
  default     = ""
}

variable "activate_https" {
  description = "Set true only after the ACM cert shows ISSUED (see module.alb.acm_certificate_status)."
  type        = bool
  default     = false
}
