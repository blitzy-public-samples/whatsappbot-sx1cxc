"""
Advanced analytics calculation service implementing statistical analysis, metric computations,
and performance monitoring with comprehensive analytics capabilities.

Version: 1.0.0
Author: Analytics Service Team
"""

# External imports with versions
import numpy as np  # v1.24.0
import pandas as pd  # v2.0.0
from typing import List, Dict, Optional, Union
from datetime import datetime, timedelta

# Internal imports
from ..models.metrics import MessageMetric, EngagementMetric, SystemMetric

class MetricsCalculator:
    """
    Advanced metrics calculation engine supporting comprehensive analytics processing
    with configurable thresholds and statistical analysis.
    """
    
    def __init__(self, config: Dict, historical_data: pd.DataFrame):
        """
        Initialize the metrics calculator with comprehensive configuration and validation.
        
        Args:
            config: Configuration dictionary containing threshold values and analysis parameters
            historical_data: DataFrame containing historical metrics for trend analysis
        """
        # Validate and set thresholds
        if not validate_thresholds(config.get('thresholds', {}), strict_mode=True):
            raise ValueError("Invalid threshold configuration")
            
        # Initialize threshold arrays using numpy
        self._delivery_thresholds = np.array(config.get('delivery_thresholds', [99.0, 97.0, 95.0]))
        self._engagement_thresholds = np.array(config.get('engagement_thresholds', [80.0, 60.0, 40.0]))
        
        # Set performance thresholds
        self._performance_thresholds = {
            'response_time': config.get('response_time_threshold', 2.0),
            'cpu_usage': config.get('cpu_threshold', 80.0),
            'memory_usage': config.get('memory_threshold', 80.0),
            'concurrent_users': config.get('concurrent_users_threshold', 1000)
        }
        
        # Initialize historical data framework
        self._historical_data = historical_data
        self._validate_historical_data()

    def calculate_delivery_statistics(self, metrics: List[MessageMetric], time_range: datetime) -> Dict:
        """
        Calculates comprehensive message delivery statistics with trend analysis.
        
        Args:
            metrics: List of MessageMetric objects for analysis
            time_range: Time range for historical comparison
            
        Returns:
            Dict containing detailed delivery statistics, patterns, and trends
        """
        # Validate input metrics
        valid_metrics = [m for m in metrics if m.is_valid]
        if not valid_metrics:
            raise ValueError("No valid metrics provided for analysis")
            
        # Calculate basic delivery statistics
        delivery_rates = np.array([m.delivery_rate for m in valid_metrics])
        total_messages = sum(m.total_messages for m in valid_metrics)
        
        # Perform statistical analysis
        stats_summary = calculate_statistical_summary(delivery_rates, {
            'percentiles': [25, 50, 75, 90, 95, 99],
            'include_outliers': True
        })
        
        # Calculate trends and patterns
        historical_comparison = self._calculate_historical_trends(
            'delivery_rate',
            delivery_rates,
            time_range
        )
        
        return {
            'current_statistics': {
                'total_messages': total_messages,
                'average_delivery_rate': float(np.mean(delivery_rates)),
                'std_deviation': float(np.std(delivery_rates)),
                'sla_compliance': float(np.mean(delivery_rates >= 99.0))
            },
            'statistical_analysis': stats_summary,
            'historical_trends': historical_comparison,
            'threshold_analysis': self._analyze_thresholds(delivery_rates, self._delivery_thresholds),
            'timestamp': datetime.utcnow().isoformat()
        }

    def calculate_engagement_statistics(self, metrics: List[EngagementMetric], filters: Dict) -> Dict:
        """
        Analyzes user engagement patterns with advanced metrics.
        
        Args:
            metrics: List of EngagementMetric objects for analysis
            filters: Dictionary containing analysis filters and parameters
            
        Returns:
            Dict containing detailed engagement analysis with patterns and predictions
        """
        # Apply filters and validate metrics
        filtered_metrics = self._apply_engagement_filters(metrics, filters)
        engagement_rates = np.array([m.engagement_rate for m in filtered_metrics])
        
        # Calculate engagement patterns
        interaction_patterns = self._analyze_interaction_patterns(filtered_metrics)
        
        # Perform predictive analysis
        predictions = self._calculate_engagement_predictions(
            engagement_rates,
            interaction_patterns
        )
        
        return {
            'engagement_metrics': {
                'average_rate': float(np.mean(engagement_rates)),
                'peak_engagement': float(np.max(engagement_rates)),
                'engagement_volatility': float(np.std(engagement_rates))
            },
            'interaction_analysis': interaction_patterns,
            'user_segments': self._analyze_user_segments(filtered_metrics),
            'predictions': predictions,
            'timestamp': datetime.utcnow().isoformat()
        }

    def calculate_performance_statistics(self, metrics: List[SystemMetric], include_predictions: bool = True) -> Dict:
        """
        Comprehensive system performance analysis with health indicators.
        
        Args:
            metrics: List of SystemMetric objects for analysis
            include_predictions: Boolean flag for including predictive analysis
            
        Returns:
            Dict containing detailed performance analysis with health indicators
        """
        # Extract performance metrics
        response_times = np.array([m.response_time for m in metrics])
        cpu_usage = np.array([m.cpu_usage for m in metrics])
        memory_usage = np.array([m.memory_usage for m in metrics])
        
        # Calculate health indicators
        health_status = self._calculate_health_status(metrics)
        
        # Performance analysis results
        performance_data = {
            'response_time_analysis': {
                'average': float(np.mean(response_times)),
                'p95': float(np.percentile(response_times, 95)),
                'sla_compliance': float(np.mean(response_times < 2.0))
            },
            'resource_utilization': {
                'cpu': {
                    'average': float(np.mean(cpu_usage)),
                    'peak': float(np.max(cpu_usage))
                },
                'memory': {
                    'average': float(np.mean(memory_usage)),
                    'peak': float(np.max(memory_usage))
                }
            },
            'health_indicators': health_status,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Add predictive analysis if requested
        if include_predictions:
            performance_data['predictions'] = self._generate_performance_predictions(metrics)
            
        return performance_data

    def _validate_historical_data(self) -> None:
        """Validates historical data integrity and completeness."""
        required_columns = ['timestamp', 'metric_type', 'value']
        if not all(col in self._historical_data.columns for col in required_columns):
            raise ValueError("Historical data missing required columns")
        
        # Ensure data is sorted by timestamp
        self._historical_data.sort_values('timestamp', inplace=True)

    def _calculate_historical_trends(self, metric_name: str, current_values: np.ndarray, time_range: datetime) -> Dict:
        """Calculates historical trends and patterns for specified metric."""
        historical_values = self._historical_data[
            (self._historical_data['metric_type'] == metric_name) &
            (self._historical_data['timestamp'] >= time_range)
        ]['value'].values
        
        return {
            'trend_direction': np.polyfit(range(len(historical_values)), historical_values, 1)[0],
            'volatility': float(np.std(historical_values)),
            'year_over_year': self._calculate_yoy_change(historical_values, current_values)
        }

    def _analyze_thresholds(self, values: np.ndarray, thresholds: np.ndarray) -> Dict:
        """Analyzes metric values against defined thresholds."""
        return {
            'threshold_breaches': [
                float(np.mean(values < threshold)) for threshold in thresholds
            ],
            'critical_breaches': float(np.mean(values < thresholds.min())),
            'threshold_margins': [
                float(np.min(values - threshold)) for threshold in thresholds
            ]
        }

def validate_thresholds(thresholds: Dict, strict_mode: bool = False) -> bool:
    """
    Advanced threshold validation with type checking and range verification.
    
    Args:
        thresholds: Dictionary containing threshold configurations
        strict_mode: Boolean flag for strict validation rules
        
    Returns:
        Boolean indicating validation result
    """
    try:
        # Basic validation
        required_keys = ['delivery', 'engagement', 'performance']
        if strict_mode and not all(key in thresholds for key in required_keys):
            return False
            
        # Value range validation
        for key, value in thresholds.items():
            if not isinstance(value, (int, float, list, dict)):
                return False
            if isinstance(value, (int, float)) and (value < 0 or value > 100):
                return False
                
        return True
    except Exception:
        return False

def calculate_statistical_summary(data: np.ndarray, options: Dict) -> Dict:
    """
    Comprehensive statistical analysis with advanced metrics.
    
    Args:
        data: NumPy array containing metric values
        options: Dictionary containing analysis options
        
    Returns:
        Dict containing detailed statistical summary
    """
    percentiles = options.get('percentiles', [25, 50, 75])
    
    summary = {
        'basic_stats': {
            'mean': float(np.mean(data)),
            'median': float(np.median(data)),
            'std': float(np.std(data)),
            'min': float(np.min(data)),
            'max': float(np.max(data))
        },
        'percentiles': {
            f'p{p}': float(np.percentile(data, p)) for p in percentiles
        }
    }
    
    # Calculate confidence intervals if sample size is sufficient
    if len(data) >= 30:
        confidence_level = 0.95
        z_score = 1.96  # 95% confidence level
        standard_error = np.std(data) / np.sqrt(len(data))
        mean = np.mean(data)
        
        summary['confidence_interval'] = {
            'lower': float(mean - z_score * standard_error),
            'upper': float(mean + z_score * standard_error),
            'confidence_level': confidence_level
        }
    
    return summary