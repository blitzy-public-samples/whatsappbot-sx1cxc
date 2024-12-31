# Terraform AWS Provider version: ~> 5.0
# Core Terraform version: ~> 1.6

# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the created VPC for network isolation"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure resource deployment"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources"
  value       = aws_subnet.public[*].id
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint URL for EKS cluster API access"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name identifier of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_security_group_id" {
  description = "Security group ID controlling EKS cluster network access"
  value       = module.eks.cluster_security_group_id
}

# Database Outputs
output "rds_endpoint" {
  description = "Connection endpoint for RDS PostgreSQL instance"
  value       = aws_db_instance.postgresql.endpoint
}

output "rds_port" {
  description = "Port number for RDS PostgreSQL instance connections"
  value       = aws_db_instance.postgresql.port
}

output "db_master_password" {
  description = "Master password for RDS instance authentication"
  value       = aws_db_instance.postgresql.password
  sensitive   = true
}

# Cache Outputs
output "redis_endpoint" {
  description = "Primary endpoint for ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Port number for ElastiCache Redis cluster connections"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].port
}

# Storage Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for application media storage"
  value       = aws_s3_bucket.media_storage.id
}

# Container Registry Output
output "ecr_repository_url" {
  description = "URL of the ECR repository for container images"
  value       = aws_ecr_repository.main.repository_url
}

# Load Balancer Output
output "load_balancer_dns" {
  description = "DNS name of the application load balancer for traffic distribution"
  value       = aws_lb.main.dns_name
}

# Region Output
output "aws_region" {
  description = "AWS region identifier where resources are deployed"
  value       = var.aws_region
}

# Tag-based Outputs
output "resource_tags" {
  description = "Common tags applied to all resources"
  value = {
    Project         = "WhatsApp Web Enhancement"
    Environment     = var.environment
    ManagedBy      = "Terraform"
    SecurityLevel   = "High"
    ComplianceLevel = "Enterprise"
  }
}

# High Availability Status
output "high_availability_enabled" {
  description = "Status of high availability configuration across services"
  value = {
    multi_az_rds     = aws_db_instance.postgresql.multi_az
    multi_az_redis   = aws_elasticache_cluster.redis.az_mode == "cross-az"
    multi_az_eks     = length(data.aws_availability_zones.available.names) > 1
  }
}

# Infrastructure Metadata
output "infrastructure_metadata" {
  description = "Metadata about the infrastructure deployment"
  value = {
    deployment_timestamp = timestamp()
    terraform_version   = terraform.required_version
    provider_version    = "~> 5.0"
    vpc_cidr           = aws_vpc.main.cidr_block
    availability_zones = data.aws_availability_zones.available.names
  }
}