# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for resource deployment with multi-region support"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-[a-z]+-\\d+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment specification with strict validation"
  type        = string

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod."
  }
}

# Project Configuration
variable "project_name" {
  description = "Project name for consistent resource naming and tagging"
  type        = string
  default     = "whatsapp-web-enhancement"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

# EKS Cluster Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster with compatibility checks"
  type        = string
  default     = "1.28"

  validation {
    condition     = can(regex("^\\d+\\.\\d+$", var.eks_cluster_version))
    error_message = "EKS cluster version must be in the format X.Y"
  }
}

variable "eks_node_instance_type" {
  description = "EC2 instance type for EKS worker nodes with performance requirements"
  type        = string
  default     = "t3.xlarge"

  validation {
    condition     = can(regex("^t3\\.|^m5\\.|^c5\\.|^r5\\.", var.eks_node_instance_type))
    error_message = "EKS node instance type must be from allowed families (t3, m5, c5, r5)"
  }
}

variable "eks_node_desired_size" {
  description = "Desired number of worker nodes for normal operation"
  type        = number
  default     = 3

  validation {
    condition     = var.eks_node_desired_size >= 3 && var.eks_node_desired_size <= var.eks_node_max_size
    error_message = "Desired node count must be at least 3 and not exceed maximum size."
  }
}

variable "eks_node_max_size" {
  description = "Maximum number of worker nodes for scaling"
  type        = number
  default     = 10

  validation {
    condition     = var.eks_node_max_size >= var.eks_node_desired_size && var.eks_node_max_size <= 20
    error_message = "Maximum node count must be greater than desired size and not exceed 20."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC with subnet allocation space"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# Database Configuration
variable "rds_instance_class" {
  description = "RDS instance type for database performance requirements"
  type        = string
  default     = "r5.xlarge"

  validation {
    condition     = can(regex("^(db|r5|r6g)\\.", var.rds_instance_class))
    error_message = "RDS instance class must be from allowed families (db, r5, r6g)"
  }
}

# Cache Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type for caching layer"
  type        = string
  default     = "r6g.large"

  validation {
    condition     = can(regex("^(cache|r6g)\\.", var.redis_node_type))
    error_message = "Redis node type must be from allowed families (cache, r6g)"
  }
}

# High Availability Configuration
variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain backups for compliance"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_period >= 30 && var.backup_retention_period <= 365
    error_message = "Backup retention period must be between 30 and 365 days."
  }
}

# Resource Tagging
variable "tags" {
  description = "Common tags for all resources with required fields"
  type        = map(string)
  default = {
    Project          = "WhatsApp Web Enhancement"
    ManagedBy        = "Terraform"
    Environment      = "var.environment"
    Owner            = "DevOps"
    SecurityLevel    = "High"
    ComplianceLevel  = "Enterprise"
  }

  validation {
    condition     = contains(keys(var.tags), "Project") && contains(keys(var.tags), "Environment")
    error_message = "Tags must contain at least Project and Environment keys."
  }
}