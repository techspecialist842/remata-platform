terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Values supplied at `terraform init -backend-config=backend.hcl` time —
  # bucket/table come from the bootstrap stack's outputs. Kept out of this
  # file because backend blocks can't reference variables.
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "remata"
      ManagedBy   = "terraform"
      Environment = "staging"
    }
  }
}
