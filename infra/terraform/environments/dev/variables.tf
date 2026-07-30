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
  description = "Optional. e.g. dev.remata.com. Leave empty to stay HTTP-only."
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Optional. Existing Route53 zone (e.g. remata.com) that domain_name belongs to. Required if domain_name is set."
  type        = string
  default     = ""
}
