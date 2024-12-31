"""
Analytics Service Configuration Module

This module provides comprehensive configuration management for the Analytics Service
with enhanced security, validation, and monitoring capabilities.

Version: 1.0.0
"""

from dataclasses import dataclass, field
import os
from typing import Dict, List, Optional
from pydantic import BaseModel, validator, SecretStr  # pydantic v2.4.0

# Global environment settings
ENV = os.getenv('ENV', 'development')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
DEFAULT_WORKER_COUNT = int(os.getenv('WORKER_COUNT', '4'))

@dataclass
class DatabaseConfig(BaseModel):
    """
    Enhanced database configuration with comprehensive security and performance settings.
    Includes connection pooling, SSL support, and timeout configurations.
    """
    host: str = field(default_factory=lambda: os.getenv('DB_HOST', 'localhost'))
    port: int = field(default_factory=lambda: int(os.getenv('DB_PORT', '5432')))
    username: str = field(default_factory=lambda: os.getenv('DB_USER', 'analytics_user'))
    password: SecretStr = field(default_factory=lambda: SecretStr(os.getenv('DB_PASSWORD', '')))
    database: str = field(default_factory=lambda: os.getenv('DB_NAME', 'analytics_db'))
    pool_size: int = field(default_factory=lambda: int(os.getenv('DB_POOL_SIZE', '10')))
    max_overflow: int = field(default_factory=lambda: int(os.getenv('DB_MAX_OVERFLOW', '20')))
    ssl_enabled: bool = field(default_factory=lambda: os.getenv('DB_SSL_ENABLED', 'true').lower() == 'true')
    ssl_settings: Dict = field(default_factory=dict)
    connection_timeout: int = field(default_factory=lambda: int(os.getenv('DB_CONN_TIMEOUT', '30')))
    command_timeout: int = field(default_factory=lambda: int(os.getenv('DB_CMD_TIMEOUT', '60')))

    @validator('port', 'pool_size', 'max_overflow')
    def validate_positive_numbers(cls, v: int, field: str) -> int:
        if v <= 0:
            raise ValueError(f"{field} must be a positive number")
        return v

    def __post_init__(self):
        """Initialize SSL settings if enabled"""
        if self.ssl_enabled:
            self.ssl_settings = {
                'ssl_ca': os.getenv('DB_SSL_CA'),
                'ssl_cert': os.getenv('DB_SSL_CERT'),
                'ssl_key': os.getenv('DB_SSL_KEY'),
                'ssl_verify_cert': True
            }

@dataclass
class RedisConfig(BaseModel):
    """
    Enhanced Redis configuration with connection pooling, timeout settings,
    and retry mechanisms for improved reliability.
    """
    host: str = field(default_factory=lambda: os.getenv('REDIS_HOST', 'localhost'))
    port: int = field(default_factory=lambda: int(os.getenv('REDIS_PORT', '6379')))
    password: SecretStr = field(default_factory=lambda: SecretStr(os.getenv('REDIS_PASSWORD', '')))
    db: int = field(default_factory=lambda: int(os.getenv('REDIS_DB', '0')))
    pool_size: int = field(default_factory=lambda: int(os.getenv('REDIS_POOL_SIZE', '10')))
    socket_timeout: int = field(default_factory=lambda: int(os.getenv('REDIS_SOCKET_TIMEOUT', '5')))
    connection_timeout: int = field(default_factory=lambda: int(os.getenv('REDIS_CONN_TIMEOUT', '10')))
    retry_count: int = field(default_factory=lambda: int(os.getenv('REDIS_RETRY_COUNT', '3')))
    retry_settings: Dict = field(default_factory=lambda: {
        'retry_delay': float(os.getenv('REDIS_RETRY_DELAY', '0.1')),
        'max_delay': float(os.getenv('REDIS_MAX_DELAY', '1.0')),
        'exponential_backoff': True
    })

    @validator('port', 'pool_size', 'socket_timeout')
    def validate_positive_numbers(cls, v: int, field: str) -> int:
        if v <= 0:
            raise ValueError(f"{field} must be a positive number")
        return v

@dataclass
class MetricsConfig(BaseModel):
    """
    Comprehensive metrics collection configuration with support for
    multiple collectors, custom labels, and alerting thresholds.
    """
    enabled: bool = field(default_factory=lambda: os.getenv('METRICS_ENABLED', 'true').lower() == 'true')
    collector_endpoint: str = field(default_factory=lambda: os.getenv('METRICS_ENDPOINT', 'http://localhost:9090'))
    collection_interval: int = field(default_factory=lambda: int(os.getenv('METRICS_INTERVAL', '60')))
    metric_types: List[str] = field(default_factory=lambda: [
        'counter',
        'gauge',
        'histogram',
        'summary'
    ])
    labels: Dict[str, str] = field(default_factory=lambda: {
        'service': 'analytics',
        'environment': ENV,
        'version': os.getenv('SERVICE_VERSION', '1.0.0')
    })
    batch_size: int = field(default_factory=lambda: int(os.getenv('METRICS_BATCH_SIZE', '100')))
    aggregation_rules: Dict = field(default_factory=dict)
    alert_thresholds: Dict = field(default_factory=lambda: {
        'error_rate': float(os.getenv('ALERT_ERROR_RATE', '0.01')),
        'latency_p95': float(os.getenv('ALERT_LATENCY_P95', '1.0')),
        'memory_usage': float(os.getenv('ALERT_MEMORY_USAGE', '0.85'))
    })

@dataclass
class Config(BaseModel):
    """
    Main configuration class that consolidates all service settings
    with comprehensive validation and security features.
    """
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    metrics: MetricsConfig = field(default_factory=MetricsConfig)
    environment: str = field(default_factory=lambda: ENV)
    log_level: str = field(default_factory=lambda: LOG_LEVEL)
    worker_count: int = field(default_factory=lambda: DEFAULT_WORKER_COUNT)
    cors_settings: Dict = field(default_factory=lambda: {
        'allowed_origins': os.getenv('CORS_ORIGINS', '*').split(','),
        'allowed_methods': ['GET', 'POST', 'PUT', 'DELETE'],
        'allowed_headers': ['*'],
        'max_age': 3600
    })
    rate_limits: Dict = field(default_factory=lambda: {
        'default': int(os.getenv('RATE_LIMIT_DEFAULT', '100')),
        'burst': int(os.getenv('RATE_LIMIT_BURST', '200')),
        'window_size': int(os.getenv('RATE_LIMIT_WINDOW', '3600'))
    })
    security_settings: Dict = field(default_factory=lambda: {
        'enable_ssl': True,
        'min_tls_version': 'TLSv1.2',
        'secure_headers': True,
        'request_timeout': int(os.getenv('REQUEST_TIMEOUT', '30'))
    })

def validate_database_config(config: DatabaseConfig) -> bool:
    """
    Comprehensive validation of database configuration parameters.
    
    Args:
        config: DatabaseConfig instance to validate
        
    Returns:
        bool: True if configuration is valid
        
    Raises:
        ValueError: If configuration is invalid
    """
    if not config.host:
        raise ValueError("Database host is required")
    
    if not isinstance(config.port, int) or not (1024 <= config.port <= 65535):
        raise ValueError("Invalid database port number")
    
    if not config.username or not config.password.get_secret_value():
        raise ValueError("Database credentials are required")
    
    if config.ssl_enabled and not all(config.ssl_settings.values()):
        raise ValueError("SSL settings are incomplete")
    
    if not (0 < config.pool_size <= 100):
        raise ValueError("Invalid pool size")
    
    return True

def load_config(env_file: Optional[str] = None) -> Config:
    """
    Loads and validates the complete service configuration.
    
    Args:
        env_file: Optional path to environment file
        
    Returns:
        Config: Validated configuration instance
        
    Raises:
        ValueError: If configuration validation fails
    """
    if env_file and os.path.exists(env_file):
        # Load environment variables from file
        with open(env_file) as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

    # Initialize configuration with validation
    config = Config()
    
    # Validate database configuration
    validate_database_config(config.db)
    
    # Apply environment-specific overrides
    if config.environment == 'production':
        config.security_settings['enable_ssl'] = True
        config.security_settings['secure_headers'] = True
        config.cors_settings['allowed_origins'] = os.getenv('CORS_ORIGINS', '').split(',')
    
    return config

__all__ = ['Config', 'load_config', 'DatabaseConfig', 'RedisConfig', 'MetricsConfig']