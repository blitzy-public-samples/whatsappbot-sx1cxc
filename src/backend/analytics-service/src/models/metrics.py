"""
Core metrics models for the analytics service.
Provides data structures and calculations for message delivery, user engagement,
and system performance metrics with enhanced validation and monitoring capabilities.

Version: 1.0.0
"""

from dataclasses import dataclass, field  # v3.7+
from datetime import datetime
from typing import Dict, List, Optional, Union
import numpy as np  # v1.24.0
import uuid
import re

@dataclass
class BaseMetric:
    """
    Enhanced abstract base class for all metric types with improved validation
    and metadata handling capabilities.
    """
    metric_id: str
    organization_id: str
    timestamp: datetime
    metadata: Dict = field(default_factory=dict)
    is_valid: bool = field(default=False, init=False)
    validation_errors: List[str] = field(default_factory=list, init=False)

    def __post_init__(self):
        """Post-initialization validation and setup."""
        self.validation_errors = []
        self.validate()
        self.metadata.update({
            'created_at': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'metric_type': self.__class__.__name__
        })

    def validate(self) -> bool:
        """
        Performs comprehensive metric validation.
        Returns:
            bool: Validation result
        """
        self.validation_errors = []
        
        # Validate metric_id format
        try:
            uuid.UUID(self.metric_id)
        except ValueError:
            self.validation_errors.append("Invalid metric_id format")

        # Validate organization_id format
        if not re.match(r'^[a-zA-Z0-9-]{4,}$', self.organization_id):
            self.validation_errors.append("Invalid organization_id format")

        # Validate timestamp
        if self.timestamp > datetime.utcnow():
            self.validation_errors.append("Timestamp cannot be in the future")

        self.is_valid = len(self.validation_errors) == 0
        return self.is_valid

    def to_dict(self) -> Dict:
        """
        Converts metric to dictionary format with enhanced metadata.
        Returns:
            Dict: Enhanced dictionary representation of metric
        """
        return {
            'metric_id': self.metric_id,
            'organization_id': self.organization_id,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata,
            'is_valid': self.is_valid,
            'validation_errors': self.validation_errors,
            'calculation_context': {
                'calculated_at': datetime.utcnow().isoformat(),
                'metric_version': '1.0.0'
            }
        }

@dataclass
class MessageMetric(BaseMetric):
    """
    Enhanced metric class for message delivery statistics with queue monitoring.
    Tracks message delivery performance and validates against SLA requirements.
    """
    total_messages: int
    delivered_messages: int
    failed_messages: int
    delivery_status_breakdown: Dict[str, int]
    queue_status: Dict[str, Union[int, float]]
    message_types: Dict[str, int]

    def __post_init__(self):
        """Initialize message delivery metrics with enhanced tracking."""
        super().__post_init__()
        self.delivery_rate = self.calculate_delivery_rate()
        
        # Additional validation specific to MessageMetric
        if self.total_messages < 0 or self.delivered_messages < 0 or self.failed_messages < 0:
            self.validation_errors.append("Message counts cannot be negative")
        
        if self.total_messages < (self.delivered_messages + self.failed_messages):
            self.validation_errors.append("Total messages must be >= delivered + failed messages")

    def calculate_delivery_rate(self) -> float:
        """
        Calculates message delivery success rate with SLA validation.
        Returns:
            float: Delivery success rate percentage
        """
        if self.total_messages == 0:
            return 0.0
        
        rate = (self.delivered_messages / self.total_messages) * 100
        
        # Track historical performance in metadata
        self.metadata['delivery_rate_history'] = self.metadata.get('delivery_rate_history', [])
        self.metadata['delivery_rate_history'].append({
            'timestamp': datetime.utcnow().isoformat(),
            'rate': rate
        })
        
        # SLA validation (99% requirement)
        if rate < 99.0:
            self.validation_errors.append("Delivery rate below SLA requirement of 99%")
            
        return round(rate, 2)

@dataclass
class EngagementMetric(BaseMetric):
    """
    Enhanced metric class for user engagement statistics with trend analysis.
    Tracks user interactions and calculates weighted engagement scores.
    """
    total_interactions: int
    unique_users: int
    interaction_types: Dict[str, int]
    session_durations: Dict[str, float]
    interaction_weights: Dict[str, float]
    engagement_rate: float = field(init=False)

    def __post_init__(self):
        """Initialize user engagement metrics with enhanced analysis."""
        super().__post_init__()
        self.engagement_rate = self.calculate_engagement_rate()

    def calculate_engagement_rate(self) -> float:
        """
        Calculates weighted user engagement rate with trend analysis.
        Returns:
            float: Weighted user engagement rate percentage
        """
        if self.unique_users == 0:
            return 0.0

        # Calculate weighted interaction score
        weighted_score = sum(
            count * self.interaction_weights.get(interaction_type, 1.0)
            for interaction_type, count in self.interaction_types.items()
        )

        # Apply session duration factor
        avg_session_duration = np.mean(list(self.session_durations.values()))
        duration_factor = min(avg_session_duration / 300.0, 1.0)  # Normalize to 5 minutes

        rate = (weighted_score / self.unique_users) * duration_factor * 100
        return round(rate, 2)

@dataclass
class SystemMetric(BaseMetric):
    """
    Enhanced metric class for system performance statistics with threshold monitoring.
    Tracks system health and performance against SLA requirements.
    """
    response_time: float
    cpu_usage: float
    memory_usage: float
    concurrent_users: int
    error_counts: Dict[str, int]
    resource_thresholds: Dict[str, float]
    performance_history: Dict[str, List[float]] = field(default_factory=dict)

    def __post_init__(self):
        """Initialize system performance metrics with enhanced monitoring."""
        super().__post_init__()
        self.validate_thresholds()
        self.update_performance_history()

    def validate_thresholds(self):
        """Validates system metrics against defined thresholds."""
        if self.response_time > self.resource_thresholds.get('max_response_time', 2.0):
            self.validation_errors.append("Response time exceeds threshold")
        if self.cpu_usage > self.resource_thresholds.get('max_cpu_usage', 80.0):
            self.validation_errors.append("CPU usage exceeds threshold")
        if self.memory_usage > self.resource_thresholds.get('max_memory_usage', 80.0):
            self.validation_errors.append("Memory usage exceeds threshold")

    def update_performance_history(self):
        """Updates performance history with current metrics."""
        timestamp = datetime.utcnow().isoformat()
        self.performance_history.setdefault('response_times', []).append(self.response_time)
        self.performance_history.setdefault('cpu_usage', []).append(self.cpu_usage)
        self.performance_history.setdefault('memory_usage', []).append(self.memory_usage)
        self.performance_history.setdefault('timestamps', []).append(timestamp)

    def is_healthy(self) -> bool:
        """
        Comprehensive system health check against SLA requirements.
        Returns:
            bool: System health status
        """
        health_checks = [
            self.response_time < 2.0,  # 2 second SLA requirement
            self.concurrent_users <= 1000,  # 1000+ concurrent users support
            self.cpu_usage < self.resource_thresholds.get('max_cpu_usage', 80.0),
            self.memory_usage < self.resource_thresholds.get('max_memory_usage', 80.0),
            sum(self.error_counts.values()) < self.resource_thresholds.get('max_errors', 100)
        ]
        
        return all(health_checks)