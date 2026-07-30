variable "aws_region" {
  type = string
  # No default — must match the region chosen in bootstrap. BLOCKED on client decision.
}

variable "container_image" {
  description = "Full ECR image URI:tag. Must already exist in ECR — apply bootstrap and run the CI image-build workflow once before the first apply here."
  type        = string
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
  description = "BLOCKED — pending ops stakeholder email for alarm notifications."
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Optional. e.g. staging.remata.com. Leave empty to stay HTTP-only."
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Optional. Existing Route53 zone (e.g. remata.com) that domain_name belongs to. Required if domain_name is set."
  type        = string
  default     = ""
}
