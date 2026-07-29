output "state_bucket_name" {
  value = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  value = aws_dynamodb_table.terraform_locks.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "github_actions_deploy_role_arn" {
  description = "Put this in the GitHub repo/environment as AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_actions_deploy.arn
}

output "github_actions_terraform_role_arn" {
  description = "Put this in the GitHub repo/environment as AWS_TERRAFORM_ROLE_ARN (protected environment only)"
  value       = aws_iam_role.github_actions_terraform.arn
}
