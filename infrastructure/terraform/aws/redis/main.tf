# AWS Provider configuration
# Version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for VPC information
data "aws_vpc" "main" {
  id = data.terraform_remote_state.vpc.outputs.vpc_id
}

# KMS key for Redis encryption
resource "aws_kms_key" "redis_key" {
  description             = "KMS key for Redis encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name            = "${var.project_name}-${var.environment}-redis-kms"
    Environment     = var.environment
    Service         = "redis"
    ManagedBy       = "terraform"
    SecurityLevel   = "High"
    EncryptionType  = "AES-256"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis_sg" {
  name_prefix = "${var.project_name}-${var.environment}-redis-sg"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_worker_security_group_id]
    description     = "Allow Redis traffic from EKS workers"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-sg"
    Environment = var.environment
    Service     = "redis"
    ManagedBy   = "terraform"
  }
}

# Redis subnet group
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name        = "${var.project_name}-${var.environment}-redis-subnet"
  description = "Redis subnet group for WhatsApp Web Enhancement Application"
  subnet_ids  = data.terraform_remote_state.vpc.outputs.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-subnet"
    Environment = var.environment
    Service     = "redis"
    ManagedBy   = "terraform"
  }
}

# Redis parameter group
resource "aws_elasticache_parameter_group" "redis_params" {
  family      = "redis7.0"
  name        = "${var.project_name}-${var.environment}-redis-params"
  description = "Redis parameter group for WhatsApp Web Enhancement Application"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxclients"
    value = "65000"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-params"
    Environment = var.environment
    Service     = "redis"
    ManagedBy   = "terraform"
  }
}

# Redis replication group
resource "aws_elasticache_replication_group" "redis_cluster" {
  replication_group_id          = "${var.project_name}-${var.environment}-redis"
  description                   = "Redis cluster for WhatsApp Web Enhancement Application"
  node_type                     = var.redis_node_type
  num_cache_clusters           = 3
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis_params.name
  subnet_group_name            = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids           = [aws_security_group.redis_sg.id]
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  engine                      = "redis"
  engine_version              = "7.0"
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  kms_key_id                 = aws_kms_key.redis_key.arn
  maintenance_window         = "sun:05:00-sun:09:00"
  snapshot_window           = "03:00-05:00"
  snapshot_retention_limit  = 7
  auto_minor_version_upgrade = true
  apply_immediately         = false

  tags = {
    Name              = "${var.project_name}-${var.environment}-redis"
    Environment       = var.environment
    Service           = "redis"
    ManagedBy         = "terraform"
    BackupRetention   = "7days"
    EncryptionEnabled = "true"
    MultiAZ           = "true"
    Performance       = "100K-ops-per-second"
  }
}

# Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint address"
  value       = aws_elasticache_replication_group.redis_cluster.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port number"
  value       = aws_elasticache_replication_group.redis_cluster.port
}

output "redis_configuration" {
  description = "Redis cluster configuration details"
  value = {
    engine_version = aws_elasticache_replication_group.redis_cluster.engine_version
    node_type      = aws_elasticache_replication_group.redis_cluster.node_type
    num_nodes      = aws_elasticache_replication_group.redis_cluster.num_cache_clusters
  }
}