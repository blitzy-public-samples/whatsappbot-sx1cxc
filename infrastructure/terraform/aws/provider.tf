# Provider Configuration for WhatsApp Web Enhancement Application
# Version: AWS Provider ~> 5.0
# Purpose: Defines AWS provider settings with enhanced security and compliance features

terraform {
  # Enforce minimum Terraform version for security and feature compatibility
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider configuration with enhanced security features and comprehensive tagging
provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources for consistent tracking and compliance
  default_tags {
    tags = {
      Project             = "WhatsApp Web Enhancement"
      ManagedBy          = "Terraform"
      Environment        = var.environment
      SecurityCompliance = "Required"
      DataClassification = "Confidential"
      BackupRequired     = "True"
      LastUpdated        = timestamp()
      CostCenter         = "WhatsApp-Enhancement"
      ServiceOwner       = "DevOps"
      ComplianceLevel    = "Enterprise"
    }
  }

  # Enhanced security settings
  assume_role {
    role_arn     = var.assume_role_arn
    session_name = "TerraformDeployment-${var.environment}"
    external_id  = var.external_id
  }

  # Default provider settings for enhanced security
  default_tags_enabled = true
  
  # S3 settings for enhanced security
  s3_force_path_style = false
  
  # HTTP settings for security
  http_proxy               = var.http_proxy
  skip_metadata_api_check  = false
  skip_region_validation   = false
  skip_credentials_validation = false
  skip_requesting_account_id = false

  # Retry settings for reliability
  max_retries = 5
  
  # Endpoints configuration for VPC endpoints (if used)
  endpoints {
    s3       = var.s3_endpoint
    dynamodb = var.dynamodb_endpoint
    ec2      = var.ec2_endpoint
    rds      = var.rds_endpoint
  }
}

# Secondary provider configuration for disaster recovery region
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  # Inherit the same tags and security settings
  default_tags {
    tags = {
      Project             = "WhatsApp Web Enhancement"
      ManagedBy          = "Terraform"
      Environment        = var.environment
      SecurityCompliance = "Required"
      DataClassification = "Confidential"
      BackupRequired     = "True"
      LastUpdated        = timestamp()
      CostCenter         = "WhatsApp-Enhancement"
      ServiceOwner       = "DevOps"
      ComplianceLevel    = "Enterprise"
      Region            = "DR"
    }
  }

  assume_role {
    role_arn     = var.assume_role_arn_dr
    session_name = "TerraformDeployment-${var.environment}-DR"
    external_id  = var.external_id_dr
  }
}

# Data source to get the current AWS region for validation
data "aws_region" "current" {}

# Data source to get the current AWS caller identity for validation
data "aws_caller_identity" "current" {}

# Local variables for provider configuration validation
locals {
  is_valid_region = can(regex("^(us|eu|ap|sa|ca|me|af)-[a-z]+-\\d+$", data.aws_region.current.name))
  is_valid_environment = can(regex("^(dev|staging|prod)$", var.environment))
  
  # Ensure we're running in the correct account
  validate_account = (
    data.aws_caller_identity.current.account_id == var.allowed_account_id
    ? true
    : file("ERROR: Running in wrong AWS account!")
  )
}