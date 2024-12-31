# AWS S3 Configuration for WhatsApp Web Enhancement Application
# Provider version: hashicorp/aws ~> 5.0

# Import required variables from parent module
variable "aws_region" {}
variable "environment" {}
variable "project_name" {}

# Local variables for configuration
locals {
  common_tags = {
    Name              = "${var.project_name}-media-${var.environment}"
    Environment       = var.environment
    CostCenter        = "WhatsApp-Storage"
    DataClassification = "Confidential"
    ManagedBy        = "Terraform"
    Service          = "S3"
  }
}

# Media storage configuration variables
variable "media_retention_days" {
  type        = number
  description = "Number of days to retain media files before transitioning to IA storage"
  default     = 90
}

variable "enable_versioning" {
  type        = bool
  description = "Enable versioning for media bucket"
  default     = true
}

variable "enable_replication" {
  type        = bool
  description = "Enable 3x cross-region replication"
  default     = true
}

variable "max_file_size" {
  type        = map(number)
  description = "Maximum file size limits by type in MB"
  default = {
    image    = 5
    document = 16
    audio    = 16
    export   = 100
  }
}

# Primary media storage bucket
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media-${var.environment}"
  force_destroy = var.environment != "prod"

  tags = local.common_tags
}

# Bucket versioning configuration
resource "aws_s3_bucket_versioning" "media_versioning" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status     = var.enable_versioning ? "Enabled" : "Disabled"
    mfa_delete = var.environment == "prod" ? "Enabled" : "Disabled"
  }
}

# Server-side encryption configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "media_encryption" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_encryption.id
    }
    bucket_key_enabled = true
  }
}

# KMS key for S3 encryption
resource "aws_kms_key" "s3_encryption" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

# Bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "media_lifecycle" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "media-lifecycle"
    status = "Enabled"

    transition {
      days          = var.media_retention_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.media_retention_days * 2
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# Cross-region replication configuration
resource "aws_s3_bucket_replication_configuration" "media_replication" {
  count = var.enable_replication ? 1 : 0
  
  bucket = aws_s3_bucket.media.id
  role   = aws_iam_role.replication[0].arn

  rule {
    id     = "replica-1"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.media_replica_1[0].arn
      storage_class = "STANDARD"
    }
  }

  rule {
    id     = "replica-2"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.media_replica_2[0].arn
      storage_class = "STANDARD"
    }
  }
}

# Replica buckets
resource "aws_s3_bucket" "media_replica_1" {
  count  = var.enable_replication ? 1 : 0
  bucket = "${var.project_name}-media-replica-1-${var.environment}"
  
  tags = merge(local.common_tags, {
    ReplicationType = "Primary-Replica"
  })
}

resource "aws_s3_bucket" "media_replica_2" {
  count  = var.enable_replication ? 1 : 0
  bucket = "${var.project_name}-media-replica-2-${var.environment}"
  
  tags = merge(local.common_tags, {
    ReplicationType = "Primary-Replica"
  })
}

# Bucket metrics configuration
resource "aws_s3_bucket_metric" "media_metrics" {
  bucket = aws_s3_bucket.media.id
  name   = "EntireBucket"

  filter {
    prefix = ""
    tags   = {
      Environment = var.environment
    }
  }
}

# Intelligent tiering configuration
resource "aws_s3_bucket_intelligent_tiering_configuration" "media_tiering" {
  bucket = aws_s3_bucket.media.id
  name   = "EntireDataset"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

# Bucket policy for size limits and security
resource "aws_s3_bucket_policy" "media_policy" {
  bucket = aws_s3_bucket.media.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSizeLimit"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.media.arn}/*"
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "images/*",
              "documents/*",
              "audio/*",
              "exports/*"
            ]
          }
          NumericGreaterThan = {
            "s3:content-length" = {
              "images/*"    = var.max_file_size.image * 1024 * 1024
              "documents/*" = var.max_file_size.document * 1024 * 1024
              "audio/*"     = var.max_file_size.audio * 1024 * 1024
              "exports/*"   = var.max_file_size.export * 1024 * 1024
            }
          }
        }
      }
    ]
  })
}

# Output values
output "media_bucket_name" {
  value       = aws_s3_bucket.media.id
  description = "The name of the media storage bucket"
}

output "media_bucket_arn" {
  value       = aws_s3_bucket.media.arn
  description = "The ARN of the media storage bucket"
}

output "media_bucket_replica_arns" {
  value = var.enable_replication ? [
    aws_s3_bucket.media_replica_1[0].arn,
    aws_s3_bucket.media_replica_2[0].arn
  ] : []
  description = "The ARNs of the replica buckets"
}