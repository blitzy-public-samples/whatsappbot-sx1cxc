# Backend configuration for WhatsApp Web Enhancement Application
# Version: ~> 1.6
# Purpose: Defines secure state storage and locking mechanism using AWS S3 and DynamoDB
# Security: Implements AES-256 encryption, versioning, and cross-region replication

terraform {
  # Configure S3 backend with enhanced security and high availability
  backend "s3" {
    # Primary state storage configuration
    bucket         = "whatsapp-web-enhancement-tfstate-${var.aws_region}"
    key            = "${var.environment}/terraform.tfstate"
    region         = var.aws_region
    
    # Enhanced security configuration
    encrypt        = true
    kms_key_id     = "arn:aws:kms:${var.aws_region}:ACCOUNT_ID:key/KEY_ID"
    acl            = "private"
    
    # State locking configuration
    dynamodb_table = "whatsapp-web-enhancement-tfstate-lock"
    
    # Workspace and organization configuration
    workspace_key_prefix = var.environment
    
    # Versioning and backup configuration
    versioning = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "arn:aws:kms:${var.aws_region}:ACCOUNT_ID:key/KEY_ID"
        }
      }
    }
    
    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/tfstate-replication"
      rules {
        id       = "tfstate-replication"
        status   = "Enabled"
        priority = 1
        
        destination {
          bucket        = "arn:aws:s3:::whatsapp-web-enhancement-tfstate-dr"
          storage_class = "STANDARD"
          
          # Encryption configuration for replicated objects
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:${var.aws_region}:ACCOUNT_ID:key/DR_KEY_ID"
          }
        }
        
        # Source selection criteria for replication
        source_selection_criteria {
          sse_kms_encrypted_objects {
            status = "Enabled"
          }
        }
      }
    }
    
    # Lifecycle rules for state management
    lifecycle_rule {
      enabled = true
      
      transition {
        days          = 90
        storage_class = "GLACIER"
      }
      
      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
      
      noncurrent_version_expiration {
        days = 90
      }
    }
    
    # Access logging configuration
    logging {
      target_bucket = "whatsapp-web-enhancement-tfstate-logs"
      target_prefix = "state-access-logs/"
    }
  }
  
  # Required provider configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Terraform version constraint
  required_version = "~> 1.6"
}