# Provider configuration
# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for VPC remote state
data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "${var.project_name}-${var.environment}-terraform-state"
    key    = "vpc/terraform.tfstate"
    region = "us-east-1"
  }
}

# RDS subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "rds_subnet_group" {
  name        = "${var.project_name}-${var.environment}-rds-subnet-group"
  description = "RDS subnet group for ${var.project_name} ${var.environment}"
  subnet_ids  = data.terraform_remote_state.vpc.outputs.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Enhanced security group for RDS
resource "aws_security_group" "rds_security_group" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL instance"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "PostgreSQL access from VPC"
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-sg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "${var.project_name}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-monitoring-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Optimized parameter group for PostgreSQL
resource "aws_db_parameter_group" "rds_parameter_group" {
  name        = "${var.project_name}-${var.environment}-rds-pg"
  family      = "postgres15"
  description = "Custom parameter group for ${var.project_name} ${var.environment}"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "8GB"
  }

  parameter {
    name  = "work_mem"
    value = "64MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2GB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "24GB"
  }

  parameter {
    name  = "checkpoint_timeout"
    value = "900"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-pg"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Production-grade RDS instance
resource "aws_db_instance" "rds_instance" {
  identifier     = "${var.project_name}-${var.environment}-db"
  engine         = "postgres"
  engine_version = var.rds_engine_version

  instance_class        = var.rds_instance_class
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  iops                  = 12000

  # High Availability Configuration
  multi_az = true
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_security_group.id]
  parameter_group_name   = aws_db_parameter_group.rds_parameter_group.name

  # Backup Configuration
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Security Configuration
  storage_encrypted = true
  deletion_protection = var.enable_deletion_protection

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_role.arn

  # Log Exports
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Additional Configuration
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true

  tags = {
    Name               = "${var.project_name}-${var.environment}-rds"
    Environment        = var.environment
    ManagedBy         = "terraform"
    Backup            = "required"
    SecurityCompliance = "required"
  }
}

# Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint for application configuration"
  value       = aws_db_instance.rds_instance.endpoint
}

output "rds_arn" {
  description = "RDS instance ARN for IAM and monitoring configuration"
  value       = aws_db_instance.rds_instance.arn
}