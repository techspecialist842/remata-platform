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
  description = "Optional. FQDN to serve this environment on (e.g. staging.remata.app). Leave empty to stay HTTP-only on the ALB's raw DNS name -- the default until a domain is confirmed. DNS is managed externally (Cloudflare) -- see acm_validation_record output for what to configure."
  type        = string
  default     = ""
}

variable "activate_https" {
  description = "Set true only after the ACM certificate shows ISSUED (i.e. after the validation CNAME from acm_validation_record has been added at the DNS provider and propagated). Creates the HTTPS listener and switches HTTP to redirect. False by default so a fresh domain_name doesn't try to serve HTTPS before the cert is actually ready."
  type        = bool
  default     = false
}
