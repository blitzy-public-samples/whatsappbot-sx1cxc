"""
Analytics Service Routes Initialization Module

Configures and combines FastAPI route handlers for analytics service with comprehensive
monitoring, caching, and error handling capabilities. Implements hierarchical routing
structure for dashboard, metrics, and reports endpoints.

Version: 1.0.0
Author: Analytics Service Team
"""

# External imports with versions
from fastapi import APIRouter, Depends, HTTPException  # v0.104.0
from prometheus_client import Counter, Histogram  # v0.17.1
from typing import Dict, Optional
import logging

# Internal route imports
from .dashboard import router as dashboard_router
from .metrics import router as metrics_router
from .reports import router as reports_router

# Initialize logging
logger = logging.getLogger(__name__)

# Prometheus metrics for route monitoring
ROUTE_REQUESTS = Counter(
    'analytics_route_requests_total',
    'Total number of analytics route requests',
    ['route_group', 'endpoint']
)

ROUTE_LATENCY = Histogram(
    'analytics_route_latency_seconds',
    'Analytics route request latency',
    ['route_group']
)

# Constants for rate limiting and timeouts
ROUTE_TIMEOUT = 30.0  # seconds
MAX_REQUESTS_PER_MINUTE = 1000  # Support for 1000+ concurrent users

def initialize_routes() -> APIRouter:
    """
    Initializes and combines all analytics service route handlers with comprehensive
    error handling and monitoring capabilities.

    Returns:
        APIRouter: Combined router instance with all analytics routes, monitoring,
                  and documentation
    """
    # Create main router with version prefix and tags
    router = APIRouter(
        prefix="/api/v1/analytics",
        tags=["analytics"],
        responses={
            404: {"description": "Not found"},
            500: {"description": "Internal server error"},
            503: {"description": "Service unavailable"}
        }
    )

    # Configure route monitoring middleware
    @router.middleware("http")
    async def monitor_routes(request, call_next):
        """Monitors route performance and collects metrics."""
        route_group = request.url.path.split("/")[3]  # Extract route group from path
        
        # Increment request counter
        ROUTE_REQUESTS.labels(
            route_group=route_group,
            endpoint=request.url.path
        ).inc()

        # Track request latency
        with ROUTE_LATENCY.labels(route_group=route_group).time():
            response = await call_next(request)
            
        return response

    # Configure error handling
    @router.exception_handler(HTTPException)
    async def http_exception_handler(request, exc):
        """Handles HTTP exceptions with detailed error tracking."""
        logger.error(f"HTTP error occurred: {exc.detail}", 
                    extra={
                        "status_code": exc.status_code,
                        "path": request.url.path,
                        "method": request.method
                    })
        return {"error": exc.detail, "status_code": exc.status_code}

    @router.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        """Handles general exceptions with error logging."""
        logger.error(f"Unexpected error: {str(exc)}", 
                    extra={
                        "path": request.url.path,
                        "method": request.method
                    },
                    exc_info=True)
        return {"error": "Internal server error", "status_code": 500}

    # Include sub-routers with specific configurations
    router.include_router(
        dashboard_router,
        prefix="/dashboard",
        tags=["analytics-dashboard"],
        responses={
            429: {"description": "Too many requests"},
            503: {"description": "Service unavailable"}
        }
    )

    router.include_router(
        metrics_router,
        prefix="/metrics",
        tags=["analytics-metrics"],
        responses={
            429: {"description": "Too many requests"},
            503: {"description": "Service unavailable"}
        }
    )

    router.include_router(
        reports_router,
        prefix="/reports",
        tags=["analytics-reports"],
        responses={
            429: {"description": "Too many requests"},
            503: {"description": "Service unavailable"}
        }
    )

    # Add health check endpoint
    @router.get("/health")
    async def health_check() -> Dict:
        """
        Health check endpoint for the analytics service.
        
        Returns:
            Dict: Service health status information
        """
        try:
            # Perform basic health checks
            health_status = {
                "status": "healthy",
                "version": "1.0.0",
                "routes": {
                    "dashboard": dashboard_router.url_path_for("get_dashboard_metrics"),
                    "metrics": metrics_router.url_path_for("get_delivery_metrics"),
                    "reports": reports_router.url_path_for("get_delivery_report")
                },
                "rate_limit": MAX_REQUESTS_PER_MINUTE,
                "timeout": ROUTE_TIMEOUT
            }
            return health_status
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Service health check failed"
            )

    return router

# Export the configured router instance
router = initialize_routes()

# Export route-specific components for external use
__all__ = [
    'router',
    'dashboard_router',
    'metrics_router',
    'reports_router',
    'ROUTE_TIMEOUT',
    'MAX_REQUESTS_PER_MINUTE'
]