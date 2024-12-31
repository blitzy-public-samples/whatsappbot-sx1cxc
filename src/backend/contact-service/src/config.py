# External imports - versions specified for production stability
from pydantic_settings import BaseSettings  # v2.0.0
from pydantic import BaseModel  # v2.0.0
from typing import Dict, Optional, List
import logging
import os
from logging.handlers import RotatingFileHandler

# Global constants with production-ready defaults
DEFAULT_SERVICE_NAME = "contact-service"
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_REQUEST_TIMEOUT = 30
DEFAULT_POOL_SIZE = 10
DEFAULT_MAX_OVERFLOW = 20
DEFAULT_POOL_TIMEOUT = 30
DEFAULT_SOCKET_TIMEOUT = 5
DEFAULT_RETRY_ATTEMPTS = 3

class DatabaseConfig(BaseModel):
    """Enhanced database connection and pool settings configuration with SSL support."""
    host: str
    port: int
    username: str
    password: str
    database: str
    pool_size: int = DEFAULT_POOL_SIZE
    max_overflow: int = DEFAULT_MAX_OVERFLOW
    pool_timeout: int = DEFAULT_POOL_TIMEOUT
    ssl_enabled: bool = True
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None
    ssl_ca_path: Optional[str] = None
    connection_timeout: int = 30
    command_timeout: int = 30

    def __init__(self, **data):
        """Initialize database configuration with enhanced security and validation."""
        super().__init__(**data)
        
        # Validate SSL configuration
        if self.ssl_enabled:
            assert all([self.ssl_cert_path, self.ssl_ca_path]), "SSL certificates required when SSL is enabled"
        
        # Validate pool settings
        assert self.pool_size > 0, "Pool size must be positive"
        assert self.max_overflow >= 0, "Max overflow must be non-negative"
        assert self.pool_timeout > 0, "Pool timeout must be positive"

    def get_connection_url(self) -> str:
        """Generate secure database connection URL with SSL support."""
        base_url = f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        
        params = [
            f"pool_size={self.pool_size}",
            f"max_overflow={self.max_overflow}",
            f"pool_timeout={self.pool_timeout}",
            f"connect_timeout={self.connection_timeout}",
            f"command_timeout={self.command_timeout}"
        ]

        if self.ssl_enabled:
            params.extend([
                "sslmode=verify-full",
                f"sslcert={self.ssl_cert_path}",
                f"sslkey={self.ssl_key_path}",
                f"sslrootcert={self.ssl_ca_path}"
            ])

        return f"{base_url}?{'&'.join(params)}"

class RedisConfig(BaseModel):
    """Enhanced Redis connection and cache settings with comprehensive TTL management."""
    host: str
    port: int
    password: Optional[str]
    db: int = 0
    socket_timeout: int = DEFAULT_SOCKET_TIMEOUT
    connection_pool_size: int = DEFAULT_POOL_SIZE
    ttl_config: Dict[str, int] = {
        "contact_cache": 900,  # 15 minutes
        "group_cache": 1800,   # 30 minutes
        "session_cache": 3600  # 1 hour
    }
    ssl_enabled: bool = True
    retry_attempts: int = DEFAULT_RETRY_ATTEMPTS
    retry_delay: int = 1
    sentinel_config: Optional[Dict] = None
    cluster_config: Optional[Dict] = None

    def __init__(self, **data):
        """Initialize Redis configuration with enhanced security and clustering support."""
        super().__init__(**data)
        
        # Validate TTL configuration
        assert all(ttl > 0 for ttl in self.ttl_config.values()), "All TTL values must be positive"
        
        # Validate connection settings
        assert self.connection_pool_size > 0, "Connection pool size must be positive"
        assert self.socket_timeout > 0, "Socket timeout must be positive"

    def get_connection_params(self) -> Dict:
        """Get comprehensive Redis connection parameters with security."""
        params = {
            "host": self.host,
            "port": self.port,
            "db": self.db,
            "socket_timeout": self.socket_timeout,
            "connection_pool_class_kwargs": {
                "max_connections": self.connection_pool_size
            },
            "retry_on_timeout": True,
            "retry_on_error": [TimeoutError],
            "retry": self.retry_attempts,
            "retry_delay": self.retry_delay
        }

        if self.password:
            params["password"] = self.password

        if self.ssl_enabled:
            params["ssl"] = True
            params["ssl_cert_reqs"] = "required"

        if self.sentinel_config:
            params["sentinel"] = self.sentinel_config

        if self.cluster_config:
            params["cluster"] = self.cluster_config

        return params

class ServiceConfig(BaseSettings):
    """Enhanced service configuration with comprehensive settings management."""
    service_name: str = DEFAULT_SERVICE_NAME
    environment: str
    log_level: str = DEFAULT_LOG_LEVEL
    db: DatabaseConfig
    redis: RedisConfig
    cors_origins: List[str] = ["*"]
    request_timeout: int = DEFAULT_REQUEST_TIMEOUT
    rate_limits: Dict[str, Dict] = {
        "default": {"rate": "100/minute"},
        "contact_creation": {"rate": "50/minute"},
        "bulk_operations": {"rate": "10/minute"}
    }
    metrics_config: Dict = {
        "enabled": True,
        "push_gateway": "localhost:9091",
        "push_interval": 10
    }
    tracing_config: Dict = {
        "enabled": True,
        "sampling_rate": 0.1,
        "jaeger_host": "localhost",
        "jaeger_port": 6831
    }
    health_check_config: Dict = {
        "enabled": True,
        "interval": 30,
        "timeout": 5
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    def __init__(self, **data):
        """Initialize comprehensive service configuration with monitoring."""
        super().__init__(**data)
        self.setup_logging()

    def setup_logging(self) -> None:
        """Configure comprehensive logging with environment-specific settings."""
        log_level = getattr(logging, self.log_level.upper(), logging.INFO)
        
        # Create formatter with trace ID support
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(trace_id)s] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(log_level)

        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

        # File handler with rotation
        if not os.path.exists('logs'):
            os.makedirs('logs')
        
        file_handler = RotatingFileHandler(
            f'logs/{self.service_name}.log',
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

        # Set logging levels for third-party libraries
        logging.getLogger('urllib3').setLevel(logging.WARNING)
        logging.getLogger('asyncio').setLevel(logging.WARNING)