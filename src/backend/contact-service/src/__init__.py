# External imports with version specifications
import logging  # python3.11+
import structlog  # v23.1.0
from datetime import datetime
from typing import Dict, Optional

# Internal imports
from .app import app
from .config import ServiceConfig

# Initialize structured logging
logger = structlog.get_logger(__name__)

# Initialize service configuration
config = ServiceConfig()

# Service version for monitoring and deployment
VERSION = "1.0.0"

@app.on_event("startup")
async def configure_service() -> None:
    """
    Configure and validate Contact Service components with enhanced error handling 
    and health checks.
    """
    try:
        # Initialize structured logging with correlation IDs
        structlog.configure(
            processors=[
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            wrapper_class=structlog.BoundLogger,
            cache_logger_on_first_use=True,
        )
        logger.info("Structured logging configured", version=VERSION)

        # Validate service configuration and environment variables
        config.setup_logging()
        config.validate_config()
        logger.info("Service configuration validated", config_status="valid")

        # Check dependencies and external service connectivity
        await config.check_dependencies()
        logger.info("Service dependencies validated", dependencies_status="healthy")

        # Log successful initialization
        logger.info(
            "Contact Service initialized successfully",
            version=VERSION,
            environment=config.environment,
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(
            "Failed to initialize Contact Service",
            error=str(e),
            version=VERSION,
            timestamp=datetime.utcnow().isoformat()
        )
        raise

async def check_service_health() -> Dict:
    """
    Validate service health and dependency status.
    
    Returns:
        Dict: Service health status and metrics
    """
    try:
        health_status = {
            "service": "contact-service",
            "version": VERSION,
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "dependencies": {},
            "metrics": {}
        }

        # Check database connectivity and replication status
        db_status = await app.state.db_pool.check_health()
        health_status["dependencies"]["database"] = {
            "status": "healthy" if db_status else "unhealthy",
            "latency": db_status.get("latency") if db_status else None
        }

        # Check Redis cache availability
        cache_status = await app.state.redis_pool.ping()
        health_status["dependencies"]["cache"] = {
            "status": "healthy" if cache_status else "unhealthy"
        }

        # Collect service metrics
        health_status["metrics"] = {
            "active_connections": len(app.state.db_pool._holders),
            "cache_hit_ratio": app.state.metrics.get("cache_hit_ratio", 0),
            "request_rate": app.state.metrics.get("request_rate", 0),
            "error_rate": app.state.metrics.get("error_rate", 0)
        }

        return health_status

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "service": "contact-service",
            "version": VERSION,
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

# Export configured application instance and utilities
__all__ = ["app", "config", "VERSION", "check_service_health"]