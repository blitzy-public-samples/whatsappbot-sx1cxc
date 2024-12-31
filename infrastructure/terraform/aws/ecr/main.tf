# Provider configuration for AWS with version constraint
# Version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common configurations
locals {
  common_tags = {
    Environment     = var.environment
    Project         = var.project_name
    ManagedBy      = "terraform"
    SecurityLevel   = "High"
    ComplianceLevel = "Enterprise"
  }

  # List of microservices requiring ECR repositories
  microservices = [
    "api-gateway",
    "message-service",
    "contact-service",
    "template-service",
    "analytics-service"
  ]
}

# KMS key for ECR repository encryption
resource "aws_kms_key" "ecr_key" {
  description             = "KMS key for ECR repository encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-ecr-key-${var.environment}"
  })
}

# KMS key alias for easier reference
resource "aws_kms_alias" "ecr_key_alias" {
  name          = "alias/${var.project_name}-ecr-key-${var.environment}"
  target_key_id = aws_kms_key.ecr_key.key_id
}

# ECR repositories for each microservice
resource "aws_ecr_repository" "repositories" {
  for_each = toset(local.microservices)

  name                 = "${var.project_name}-${each.key}-${var.environment}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = merge(local.common_tags, {
    Name    = "${var.project_name}-${each.key}-${var.environment}"
    Service = each.key
  })
}

# ECR repository policies for security controls
resource "aws_ecr_repository_policy" "policies" {
  for_each   = aws_ecr_repository.repositories
  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforceIAMAuth"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Lifecycle policies for image management
resource "aws_ecr_lifecycle_policy" "policies" {
  for_each   = aws_ecr_repository.repositories
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain tagged production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["prod", "release"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Retain tagged staging images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["staging"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Remove untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Outputs for CI/CD integration
output "repository_urls" {
  description = "Map of repository names to their URLs for CI/CD integration"
  value       = { for repo in aws_ecr_repository.repositories : repo.name => repo.repository_url }
}

output "repository_arns" {
  description = "Map of repository names to their ARNs for IAM policy configuration"
  value       = { for repo in aws_ecr_repository.repositories : repo.name => repo.arn }
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for ECR encryption"
  value       = aws_kms_key.ecr_key.arn
}