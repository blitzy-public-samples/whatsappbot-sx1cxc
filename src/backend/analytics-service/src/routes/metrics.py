from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Union
import numpy as np  # version: 1.24.0
from uuid import UUID

@dataclass
class BaseMetric:
    """
    Base class for all metric types with enhanced validation and monitoring capabilities.
    Provides core functionality for metric validation and data conversion.
    """
    id: UUID
    organization_id: str
    timestamp: datetime
    metadata: Dict = None
    is_valid: bool = False

    def __post_init__(self):
        """Initialize the metric with validation and metadata setup."""
        self.metadata = self.metadata or {}
        self.is_valid = self.validate()
        self.metadata['validation_timestamp'] = datetime.utcnow().isoformat()

    def validate(self) -> bool:
        """
        Enhanced validation with comprehensive checks for metric data integrity.
        
        Returns:
            bool: Validation result indicating data validity
        """
        try:
            # Validate UUID format
            if not isinstance(self.id, UUID):
                return False
            
            # Verify organization_id format (assuming alphanumeric format)
            if not self.organization_id.isalnum():
                return False
            
            # Validate timestamp range (not in future, not too old)
            if self.timestamp > datetime.utcnow() or \
               self.timestamp < datetime.utcnow() - timedelta(days=30):
                return False
            
            # Verify metadata structure
            if self.metadata is not None and not isinstance(self.metadata, dict):
                return False
                
            return True
        except Exception as e:
            self.metadata['validation_error'] = str(e)
            return False

    def to_dict(self) -> Dict:
        """
        Converts metric to dictionary with enhanced metadata.
        
        Returns:
            Dict: Formatted metric data dictionary
        """
        return {
            'id': str(self.id),
            'organization_id': self.organization_id,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata,
            'is_valid': self.is_valid
        }

@dataclass
class MessageMetric(BaseMetric):
    """
    Message delivery metrics with SLA monitoring capabilities.
    Tracks message delivery statistics and performance against SLA requirements.
    """
    total_messages: int
    delivered_messages: int
    failed_messages: int
    delivery_rate: float = 0.0
    queue_stats: Dict = None
    type_distribution: Dict = None

    def __post_init__(self):
        """Initialize message metrics with enhanced monitoring."""
        super().__post_init__()
        self.queue_stats = self.queue_stats or {}
        self.type_distribution = self.type_distribution or {}
        self.delivery_rate = (self.delivered_messages / self.total_messages * 100) \
                           if self.total_messages > 0 else 0.0
        self.metadata['sla_compliant'] = self.calculate_sla_compliance()

    def calculate_sla_compliance(self) -> bool:
        """
        Checks delivery rate against SLA requirements (99% delivery rate).
        
        Returns:
            bool: SLA compliance status
        """
        SLA_THRESHOLD = 99.0  # Required delivery rate
        
        compliance_status = self.delivery_rate >= SLA_THRESHOLD
        self.metadata.update({
            'sla_threshold': SLA_THRESHOLD,
            'current_delivery_rate': self.delivery_rate,
            'compliance_check_time': datetime.utcnow().isoformat()
        })
        
        return compliance_status

@dataclass
class EngagementMetric(BaseMetric):
    """
    User engagement metrics with trend analysis capabilities.
    Tracks user interactions and performs statistical analysis on engagement patterns.
    """
    total_interactions: int
    engagement_rate: float
    interaction_types: Dict
    session_durations: List[float]
    trend_data: Dict = None

    def __post_init__(self):
        """Initialize engagement metrics with trend tracking."""
        super().__post_init__()
        self.trend_data = {}
        self._initialize_trend_tracking()

    def _initialize_trend_tracking(self):
        """Initialize trend tracking data structures."""
        if self.session_durations:
            self.trend_data.update({
                'avg_session_duration': float(np.mean(self.session_durations)),
                'median_session_duration': float(np.median(self.session_durations)),
                'std_session_duration': float(np.std(self.session_durations))
            })

    def analyze_trends(self) -> Dict:
        """
        Performs trend analysis on engagement data using statistical methods.
        
        Returns:
            Dict: Trend analysis results including patterns and predictions
        """
        analysis_results = {
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': {}
        }

        # Calculate moving averages for engagement rate
        if len(self.session_durations) >= 3:
            analysis_results['metrics']['moving_avg'] = float(
                np.convolve(self.session_durations, np.ones(3)/3, mode='valid')[-1]
            )

        # Detect trend patterns
        if len(self.session_durations) >= 2:
            trend_direction = np.diff(self.session_durations)[-1]
            analysis_results['metrics']['trend_direction'] = 'increasing' if trend_direction > 0 \
                                                           else 'decreasing' if trend_direction < 0 \
                                                           else 'stable'

        # Add correlation analysis
        analysis_results['metrics']['interaction_correlation'] = {
            k: float(np.corrcoef([self.total_interactions], [v])[0, 1])
            for k, v in self.interaction_types.items()
        }

        return analysis_results

@dataclass
class SystemMetric(BaseMetric):
    """
    System performance metrics with health monitoring capabilities.
    Tracks system performance and resource utilization with threshold monitoring.
    """
    response_time: float
    concurrent_users: int
    resource_usage: Dict
    health_status: Dict
    performance_history: List = None

    def __post_init__(self):
        """Initialize system metrics with performance tracking."""
        super().__post_init__()
        self.performance_history = []
        self._validate_performance_thresholds()

    def _validate_performance_thresholds(self):
        """Validate performance against defined thresholds."""
        self.metadata['performance_thresholds'] = {
            'response_time_threshold': 2.0,  # seconds
            'concurrent_users_threshold': 1000
        }

    def check_health(self) -> Dict:
        """
        Comprehensive system health check against defined thresholds.
        
        Returns:
            Dict: Health check results including scores and status
        """
        health_score = 100.0
        health_checks = {
            'timestamp': datetime.utcnow().isoformat(),
            'checks': {}
        }

        # Check response time
        if self.response_time > 2.0:
            health_score -= (self.response_time - 2.0) * 10
            health_checks['checks']['response_time'] = 'warning'
        else:
            health_checks['checks']['response_time'] = 'healthy'

        # Check concurrent users
        if self.concurrent_users > 1000:
            health_score -= (self.concurrent_users - 1000) * 0.1
            health_checks['checks']['concurrent_users'] = 'warning'
        else:
            health_checks['checks']['concurrent_users'] = 'healthy'

        # Check resource usage
        for resource, usage in self.resource_usage.items():
            if usage > 80:
                health_score -= (usage - 80) * 0.5
                health_checks['checks'][f'resource_{resource}'] = 'warning'
            else:
                health_checks['checks'][f'resource_{resource}'] = 'healthy'

        health_checks['health_score'] = max(0.0, min(100.0, health_score))
        health_checks['overall_status'] = 'healthy' if health_score >= 80 else 'warning'

        return health_checks