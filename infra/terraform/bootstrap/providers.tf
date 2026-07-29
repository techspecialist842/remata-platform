terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrap has no remote backend yet — it CREATES the backend that every
  # environment stack (dev/staging/prod) will then use. Its own state is
  # local and must be kept safe (or migrated to S3 manually once created).
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "remata"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}
