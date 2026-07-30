variable "environment" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "engine_version" {
  # Major version only (not X.Y) so RDS resolves to whatever minor version
  # it currently supports -- a pinned X.Y previously failed apply outright
  # once that specific minor was no longer offered.
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "db_name" {
  type    = string
  default = "remata"
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "backup_retention_days" {
  type    = number
  default = 7
}
