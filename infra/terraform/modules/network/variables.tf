variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "Use one NAT Gateway for all private subnets (cheaper, single point of failure — fine for dev/staging, not recommended for prod)."
  type        = bool
  default     = true
}
