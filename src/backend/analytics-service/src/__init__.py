"""
Analytics Service Initialization Module

This module serves as the main entry point for the Analytics Service, providing centralized access
to analytics models, metrics, and reporting capabilities with enhanced validation and monitoring.

Version: 1.0.0
"""

import logging
from importlib.metadata import version  # v4.0.0

# Import core application components
from .app import app, configure_monitoring

# Import metric models with validation capabilities
from .models.metrics import (
    BaseMetric,
    MessageMetric,
    EngagementMetric,
    SystemMetric
)

# Import report models with enhanced analytics
from .models.reports import (
    BaseReport,
    MessageDeliveryReport,
    EngagementReport,
    SystemPerformanceReport
)

# Package metadata
__version__ = '1.0.0'

# Define public API
__all__ = [
    'app',
    'BaseMetric',
    'MessageMetric',
    'EngagementMetric',
    'SystemMetric',
    'BaseReport',
    'MessageDeliveryReport',
    'EngagementReport',
    'SystemPerformanceReport',
    'configure_logging',
    'validate_environment'
]

# Initialize logger
logger = logging.getLogger(__name__)

def configure_logging(log_level: str = 'INFO', log_format: str = None) -> None:
    """
    Configures comprehensive logging for the analytics service with enhanced monitoring
    and security audit capabilities.

    Args:
        log_level: Desired logging level (default: INFO)
        log_format: Custom log format string (optional)

    Returns:
        None
    """
    # Set default log format if not provided
    if log_format is None:
        log_format = (
            '%(asctime)s - %(name)s - %(levelname)s - '
            '%(message)s - [trace_id=%(trace_id)s]'
        )

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format=log_format,
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Configure security audit logging
    audit_handler = logging.FileHandler('security_audit.log')
    audit_handler.setLevel(logging.INFO)
    audit_formatter = logging.Formatter(
        '%(asctime)s - SECURITY_AUDIT - %(message)s'
    )
    audit_handler.setFormatter(audit_formatter)
    logging.getLogger('security_audit').addHandler(audit_handler)

    # Configure performance monitoring logging
    perf_handler = logging.FileHandler('performance.log')
    perf_handler.setLevel(logging.DEBUG)
    perf_formatter = logging.Formatter(
        '%(asctime)s - PERFORMANCE - %(message)s'
    )
    perf_handler.setFormatter(perf_formatter)
    logging.getLogger('performance').addHandler(perf_handler)

    logger.info(f"Logging configured with level: {log_level}")

def validate_environment() -> bool:
    """
    Performs comprehensive validation of the runtime environment and dependencies
    to ensure proper service operation.

    Returns:
        bool: True if environment is valid, False otherwise
    """
    try:
        # Validate Python version
        import sys
        if sys.version_info < (3, 11):
            logger.error("Python version 3.11+ is required")
            return False

        # Validate critical dependencies
        required_packages = {
            'fastapi': '0.104.0',
            'pandas': '2.0.0',
            'numpy': '1.24.0',
            'prometheus-client': '0.17.0',
            'pydantic': '2.4.0'
        }

        for package, min_version in required_packages.items():
            try:
                current_version = version(package)
                if current_version < min_version:
                    logger.error(
                        f"{package} version {min_version}+ required, "
                        f"found {current_version}"
                    )
                    return False
            except Exception as e:
                logger.error(f"Failed to validate {package}: {str(e)}")
                return False

        # Validate monitoring setup
        if not configure_monitoring():
            logger.error("Failed to configure monitoring")
            return False

        # Log successful validation
        logger.info("Environment validation completed successfully")
        return True

    except Exception as e:
        logger.error(f"Environment validation failed: {str(e)}")
        return False

# Initialize logging with default configuration
configure_logging()

# Validate environment on module import
if not validate_environment():
    logger.warning(
        "Environment validation failed - service may not function correctly"
    )