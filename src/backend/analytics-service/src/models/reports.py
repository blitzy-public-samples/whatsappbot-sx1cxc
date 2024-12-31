"""
Analytics Report Models Module

Defines comprehensive report models for analytics data aggregation and presentation,
including message delivery, user engagement, and system performance reports with
enhanced validation, trend analysis, and health monitoring capabilities.

Version: 1.0.0
Dependencies:
    - dataclasses (Python Standard Library)
    - datetime (Python Standard Library)
    - typing (Python Standard Library)
    - pandas (v2.0.0)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Union
import pandas as pd  # v2.0.0

from .metrics import BaseMetric, MessageMetric, EngagementMetric, SystemMetric

@dataclass
class BaseReport:
    """
    Enhanced abstract base class for all report types with improved validation
    and metadata handling capabilities.
    """
    report_id: str
    organization_id: str
    start_time: datetime
    end_time: datetime
    report_type: str
    metadata: Dict = field(default_factory=dict)
    validation_rules: Dict = field(default_factory=dict)
    time_partitions: Dict = field(default_factory=dict)
    
    def __post_init__(self):
        """
        Post-initialization validation and setup with enhanced error checking
        and metadata handling.
        """
        self._validate_time_range()
        self._initialize_metadata()
        self._setup_time_partitions()
        self._configure_validation_rules()
    
    def _validate_time_range(self) -> None:
        """
        Validates time range parameters with business rule enforcement.
        
        Raises:
            ValueError: If time range validation fails
        """
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        
        if self.end_time > datetime.utcnow():
            raise ValueError("End time cannot be in the future")
        
        # Enforce maximum time range of 90 days
        max_range = datetime.timedelta(days=90)
        if (self.end_time - self.start_time) > max_range:
            raise ValueError("Time range cannot exceed 90 days")

    def _initialize_metadata(self) -> None:
        """
        Initializes report metadata with comprehensive tracking information.
        """
        self.metadata.update({
            'created_at': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'report_type': self.report_type,
            'time_range': {
                'start': self.start_time.isoformat(),
                'end': self.end_time.isoformat(),
                'duration_hours': (self.end_time - self.start_time).total_seconds() / 3600
            },
            'data_retention': {
                'policy': 'standard',
                'retention_days': 90,
                'archival_policy': 'compress_after_30_days'
            }
        })

    def _setup_time_partitions(self) -> None:
        """
        Configures time-based partitioning strategy for efficient data handling.
        """
        duration_hours = (self.end_time - self.start_time).total_seconds() / 3600
        
        if duration_hours <= 24:
            partition_size = 'hourly'
        elif duration_hours <= 168:  # 1 week
            partition_size = 'daily'
        else:
            partition_size = 'weekly'
            
        self.time_partitions.update({
            'strategy': partition_size,
            'partition_count': int(duration_hours / 
                               {'hourly': 1, 'daily': 24, 'weekly': 168}[partition_size]),
            'partition_boundaries': self._calculate_partition_boundaries(partition_size)
        })

    def _calculate_partition_boundaries(self, partition_size: str) -> List[datetime]:
        """
        Calculates time partition boundaries based on the partition strategy.
        
        Args:
            partition_size: The size of each partition ('hourly', 'daily', 'weekly')
            
        Returns:
            List[datetime]: List of partition boundary timestamps
        """
        boundaries = []
        current = self.start_time
        
        while current <= self.end_time:
            boundaries.append(current)
            if partition_size == 'hourly':
                current += datetime.timedelta(hours=1)
            elif partition_size == 'daily':
                current += datetime.timedelta(days=1)
            else:  # weekly
                current += datetime.timedelta(weeks=1)
                
        return boundaries

    def _configure_validation_rules(self) -> None:
        """
        Sets up data validation rules based on report type and requirements.
        """
        self.validation_rules.update({
            'completeness_threshold': 0.95,  # 95% data completeness required
            'freshness_threshold_minutes': 60,
            'consistency_checks': ['time_series_continuity', 'value_range_validation'],
            'quality_metrics': ['accuracy', 'completeness', 'consistency']
        })

    def to_dict(self) -> Dict:
        """
        Enhanced conversion to dictionary with comprehensive metadata and validation status.
        
        Returns:
            Dict: Validated dictionary representation of report
        """
        return {
            'report_id': self.report_id,
            'organization_id': self.organization_id,
            'report_type': self.report_type,
            'time_range': {
                'start': self.start_time.isoformat(),
                'end': self.end_time.isoformat()
            },
            'metadata': self.metadata,
            'validation_rules': self.validation_rules,
            'time_partitions': self.time_partitions,
            'generated_at': datetime.utcnow().isoformat()
        }

@dataclass
class MessageDeliveryReport(BaseReport):
    """
    Enhanced report class for message delivery analytics with comprehensive
    trend visualization and analysis capabilities.
    """
    metrics: List[MessageMetric]
    delivery_trends: Dict = field(default_factory=dict)
    failure_analysis: Dict = field(default_factory=dict)
    sla_compliance: Dict = field(default_factory=dict)
    visualization_data: Dict = field(default_factory=dict)
    
    def __post_init__(self):
        """
        Initializes message delivery report with enhanced analytics processing.
        """
        super().__post_init__()
        self.average_delivery_rate = self._calculate_average_delivery_rate()
        self.delivery_trends = self.calculate_trends()
        self._analyze_failures()
        self._evaluate_sla_compliance()
        self._prepare_visualization_data()
    
    def _calculate_average_delivery_rate(self) -> float:
        """
        Calculates weighted average delivery rate across all metrics.
        
        Returns:
            float: Weighted average delivery rate
        """
        if not self.metrics:
            return 0.0
            
        total_messages = sum(metric.total_messages for metric in self.metrics)
        total_delivered = sum(metric.delivered_messages for metric in self.metrics)
        
        return round((total_delivered / total_messages * 100), 2) if total_messages > 0 else 0.0

    def calculate_trends(self) -> Dict:
        """
        Performs comprehensive trend analysis with advanced statistical calculations
        and visualization support.
        
        Returns:
            Dict: Comprehensive trend analysis with visualization data
        """
        # Convert metrics to pandas DataFrame for advanced analysis
        df = pd.DataFrame([{
            'timestamp': metric.timestamp,
            'delivery_rate': metric.delivery_rate,
            'total_messages': metric.total_messages,
            'failed_messages': metric.failed_messages
        } for metric in self.metrics])
        
        # Sort by timestamp for time series analysis
        df.sort_values('timestamp', inplace=True)
        
        # Calculate rolling averages and trends
        df['rolling_avg_rate'] = df['delivery_rate'].rolling(window=24).mean()
        df['rolling_avg_volume'] = df['total_messages'].rolling(window=24).mean()
        
        # Calculate trend indicators
        trend_analysis = {
            'overall_trend': self._calculate_trend_direction(df['delivery_rate']),
            'hourly_patterns': self._analyze_hourly_patterns(df),
            'volume_correlation': df['delivery_rate'].corr(df['total_messages']),
            'statistical_summary': {
                'mean_rate': df['delivery_rate'].mean(),
                'std_dev': df['delivery_rate'].std(),
                'percentiles': df['delivery_rate'].quantile([0.25, 0.5, 0.75]).to_dict()
            }
        }
        
        return trend_analysis

    def _calculate_trend_direction(self, series: pd.Series) -> str:
        """
        Calculates the overall trend direction using linear regression.
        
        Args:
            series: Time series data
            
        Returns:
            str: Trend direction indicator
        """
        if len(series) < 2:
            return "insufficient_data"
            
        slope = pd.Series(range(len(series))).corr(series)
        
        if slope > 0.1:
            return "improving"
        elif slope < -0.1:
            return "declining"
        else:
            return "stable"

    def _analyze_hourly_patterns(self, df: pd.DataFrame) -> Dict:
        """
        Analyzes hourly patterns in delivery rates.
        
        Args:
            df: DataFrame with delivery metrics
            
        Returns:
            Dict: Hourly pattern analysis
        """
        df['hour'] = df['timestamp'].dt.hour
        hourly_stats = df.groupby('hour')['delivery_rate'].agg([
            'mean', 'std', 'count'
        ]).to_dict('index')
        
        return {
            'hourly_stats': hourly_stats,
            'peak_hour': max(hourly_stats.items(), key=lambda x: x[1]['mean'])[0],
            'trough_hour': min(hourly_stats.items(), key=lambda x: x[1]['mean'])[0]
        }

    def _analyze_failures(self) -> None:
        """
        Performs detailed analysis of message delivery failures.
        """
        failure_metrics = {
            'total_failures': sum(metric.failed_messages for metric in self.metrics),
            'failure_categories': self._aggregate_failure_categories(),
            'failure_trends': self._calculate_failure_trends()
        }
        
        self.failure_analysis.update(failure_metrics)

    def _evaluate_sla_compliance(self) -> None:
        """
        Evaluates compliance with SLA requirements and updates compliance metrics.
        """
        sla_threshold = 99.0  # 99% delivery rate requirement
        
        compliance_metrics = {
            'sla_threshold': sla_threshold,
            'current_compliance': self.average_delivery_rate >= sla_threshold,
            'compliance_trend': self._calculate_compliance_trend(),
            'violation_periods': self._identify_sla_violations()
        }
        
        self.sla_compliance.update(compliance_metrics)

    def _prepare_visualization_data(self) -> None:
        """
        Prepares data for visualization components with multiple view options.
        """
        self.visualization_data.update({
            'time_series': {
                'delivery_rates': self._prepare_time_series_data(),
                'volume_data': self._prepare_volume_data()
            },
            'distributions': {
                'delivery_rate_histogram': self._prepare_histogram_data(),
                'failure_distribution': self._prepare_failure_distribution()
            },
            'correlations': self._prepare_correlation_data()
        })