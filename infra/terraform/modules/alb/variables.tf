variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

variable "domain_name" {
  description = "Optional. FQDN to serve this environment on (e.g. staging.remata.com). Leave empty to stay HTTP-only on the ALB's raw DNS name -- the default until a domain is confirmed."
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Optional. Existing Route53 public hosted zone name (e.g. remata.com) that domain_name belongs to. Required if domain_name is set; the zone itself is not created here -- it must already exist with the registrar's nameservers pointed at it."
  type        = string
  default     = ""
}
