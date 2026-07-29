resource "random_password" "master" {
  length  = 32
  special = false # avoid characters that need URL-encoding in a connection string
}

resource "aws_db_subnet_group" "this" {
  name       = "remata-${var.environment}-db"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "remata-${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "this" {
  identifier     = "remata-${var.environment}"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = "remata_admin"
  password = random_password.master.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]

  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_days
  # PCI DSS / GDPR baseline: card data never touches this database (Stripe
  # tokenization only), but PII (users/merchants) does — encryption at rest
  # above, deletion_protection + skip_final_snapshot=false give a recovery
  # point on accidental destroy.
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "remata-${var.environment}-final-${formatdate("YYYYMMDD-hhmm", timestamp())}"

  performance_insights_enabled = true

  tags = {
    Name        = "remata-${var.environment}-postgres"
    Environment = var.environment
  }

  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "remata/${var.environment}/database"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_db_instance.this.username
    password = random_password.master.result
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = aws_db_instance.this.db_name
    url      = "postgresql://${aws_db_instance.this.username}:${random_password.master.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${aws_db_instance.this.db_name}"
  })
}
