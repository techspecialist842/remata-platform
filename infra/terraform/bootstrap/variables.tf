variable "aws_region" {
  description = "AWS region for all REMATA infrastructure. BLOCKED on client decision — see docs/04 - Procurement plan review."
  type        = string
  # No default on purpose: force an explicit choice instead of silently
  # deploying to a region nobody picked.
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name for Terraform remote state."
  type        = string
  default     = "remata-terraform-state"
}

variable "lock_table_name" {
  description = "DynamoDB table name used for Terraform state locking."
  type        = string
  default     = "remata-terraform-locks"
}

variable "ecr_repository_name" {
  description = "Shared ECR repository name for the REMATA API image (tagged per environment/commit, not one repo per env)."
  type        = string
  default     = "remata-api"
}

variable "github_org" {
  description = "GitHub org or user that owns the REMATA repo. BLOCKED on client decision."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without org prefix). BLOCKED on client decision."
  type        = string
}

variable "root_domain" {
  description = "Optional. Root domain to create a Route53 public hosted zone for (e.g. remata.app). Leave empty to skip -- HTTPS support stays inert until this is set and the registrar's nameservers are pointed at the resulting zone."
  type        = string
  default     = ""
}
