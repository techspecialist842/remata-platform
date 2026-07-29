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
