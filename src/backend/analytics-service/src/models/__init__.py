"""
Analytics Service Models Package

Provides core metric and report models with enhanced validation and monitoring capabilities
for message delivery, user engagement, and system performance analytics.

Version: 1.0.0
Dependencies:
    - typing (v3.11+)
    - logging (v3.11+)
"""

from typing import List, Dict, Any  # v3.11+
import logging  # v3.11+

# Import metric models
from .metrics import (
    BaseMetric,
    MessageMetric,
    EngagementMetric,
    SystemMetric
)

# Import report models
from .reports import (
    BaseReport,
    MessageDeliveryReport,
    EngagementReport,
    SystemPerformanceReport
)

# Package metadata
__version__ = '1.0.0'

# Configure logging for analytics operations
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Handler for logging analytics operations
handler = logging.StreamHandler()
handler.setFormatter(
    logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
)
logger.addHandler(handler)

# Export all models and their key functionalities
__all__ = [
    # Metric Models
    'BaseMetric',
    'MessageMetric',
    'EngagementMetric',
    'SystemMetric',
    
    # Report Models
    'BaseReport',
    'MessageDeliveryReport',
    'EngagementReport',
    'SystemPerformanceReport',
]

# Log package initialization
logger.info(
    f"Analytics Service Models initialized (v{__version__})"
)

def get_supported_metrics() -> List[str]:
    """
    Returns a list of supported metric types.
    
    Returns:
        List[str]: Names of supported metric types
    """
    return ['MessageMetric', 'EngagementMetric', 'SystemMetric']

def get_supported_reports() -> List[str]:
    """
    Returns a list of supported report types.
    
    Returns:
        List[str]: Names of supported report types
    """
    return [
        'MessageDeliveryReport',
        'EngagementReport',
        'SystemPerformanceReport'
    ]

def get_model_metadata() -> Dict[str, Any]:
    """
    Returns metadata about the analytics models package.
    
    Returns:
        Dict[str, Any]: Package metadata including version and capabilities
    """
    return {
        'version': __version__,
        'supported_metrics': get_supported_metrics(),
        'supported_reports': get_supported_reports(),
        'validation_enabled': True,
        'monitoring_enabled': True,
        'sla_requirements': {
            'message_delivery_rate': 99.0,
            'system_response_time': 2.0,
            'concurrent_users_support': 1000
        }
    }