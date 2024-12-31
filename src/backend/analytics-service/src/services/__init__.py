"""
Analytics Service Package Initialization
Provides core analytics service components for comprehensive metrics processing
and analysis, including delivery tracking, engagement metrics, and performance reporting.

Version: 1.0.0
Author: Analytics Service Team
"""

# Import core components from internal modules
from .aggregator import MetricsAggregator
from .calculator import MetricsCalculator

# Define package exports
__all__ = [
    "MetricsAggregator",
    "MetricsCalculator"
]

# Package metadata
__version__ = "1.0.0"
__author__ = "Analytics Service Team"
__description__ = """
Enterprise-grade analytics service providing:
- Message delivery tracking and SLA monitoring
- User engagement analysis and pattern detection
- System performance metrics and health monitoring
- Custom dashboard analytics support
"""

# Package configuration
DEFAULT_CONFIG = {
    "time_periods": ["hourly", "daily", "weekly"],
    "optimization_settings": {
        "memory_efficient": True,
        "parallel": True
    },
    "sla_thresholds": {
        "delivery_rate": 99.0,
        "response_time": 2.0,
        "concurrent_users": 1000
    }
}

# Performance requirements based on technical specification
PERFORMANCE_THRESHOLDS = {
    "response_time": 2.0,  # 2 seconds max response time
    "delivery_rate": 99.0,  # 99% minimum delivery rate
    "concurrent_users": 1000,  # Support for 1000+ concurrent users
    "cpu_usage": 80.0,  # Maximum CPU utilization percentage
    "memory_usage": 80.0,  # Maximum memory utilization percentage
}

def create_metrics_aggregator(custom_config: dict = None) -> MetricsAggregator:
    """
    Factory function to create a configured MetricsAggregator instance.
    
    Args:
        custom_config: Optional custom configuration to override defaults
        
    Returns:
        Configured MetricsAggregator instance
    """
    config = DEFAULT_CONFIG.copy()
    if custom_config:
        config.update(custom_config)
    
    return MetricsAggregator(
        aggregation_config=config,
        performance_thresholds=PERFORMANCE_THRESHOLDS
    )

def create_metrics_calculator(historical_data=None) -> MetricsCalculator:
    """
    Factory function to create a configured MetricsCalculator instance.
    
    Args:
        historical_data: Optional historical data for trend analysis
        
    Returns:
        Configured MetricsCalculator instance
    """
    import pandas as pd
    
    # Initialize empty DataFrame if no historical data provided
    if historical_data is None:
        historical_data = pd.DataFrame(columns=['timestamp', 'metric_type', 'value'])
    
    return MetricsCalculator(
        config={"thresholds": PERFORMANCE_THRESHOLDS},
        historical_data=historical_data
    )

# Initialize package-level logger
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Add console handler if not already present
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)