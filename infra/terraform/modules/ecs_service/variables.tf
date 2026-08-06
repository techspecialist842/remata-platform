variable "environment" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "container_image" {
  description = "Full image URI including tag, e.g. <account>.dkr.ecr.<region>.amazonaws.com/remata-api:staging-<sha>."
  type        = string
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "cpu" {
  description = "Fargate task vCPU units (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "db_secret_arn" {
  type = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "fraud_policy" {
  description = "fail-open (allow through) or fail-closed (deny) when the fraud scoring engine itself errors."
  type        = string
  default     = "fail-open"
}
