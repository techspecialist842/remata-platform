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
