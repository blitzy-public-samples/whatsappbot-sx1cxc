# External imports with version specifications
from fastapi import FastAPI  # fastapi ^0.104.0
from fastapi.middleware.cors import CORSMiddleware  # fastapi ^0.104.0
from fastapi.middleware.gzip import GZipMiddleware  # fastapi ^0.104.0
import logging  # python3.11+
from prometheus_client import Counter, Histogram  # prometheus_client ^0.17.0
from typing import Dict, Any
import time

# Internal imports
from .contacts import router as contacts_router
from .groups import router as groups_router
from .import import router as import_router

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize metrics collectors
ROUTE_COUNTER = Counter(
    'contact_service_route_requests_total',
    'Total route requests',
    ['route', 'method']
)

ROUTE_LATENCY = Histogram(
    'contact_service_route_latency_seconds',
    'Route request latency',
    ['route']
)

async def log_request_timing(request: Dict[str, Any], call_next: Any) -> Any:
    """
    Middleware to log request timing and collect metrics.
    """
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    # Record metrics
    ROUTE_COUNTER.labels(
        route=request.url.path,
        method=request.method
    ).inc()
    
    ROUTE_LATENCY.labels(
        route=request.url.path
    ).observe(duration)

    return response

def include_routers(app: FastAPI) -> None:
    """
    Configures and includes all route handlers in the main FastAPI application
    with comprehensive monitoring, security, and performance features.

    Args:
        app: FastAPI application instance
    """
    try:
        # Configure CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure based on environment
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID"]
        )

        # Add compression middleware
        app.add_middleware(
            GZipMiddleware,
            minimum_size=1000  # Only compress responses larger than 1KB
        )

        # Add timing middleware
        app.middleware("http")(log_request_timing)

        # Include routers with prefixes
        app.include_router(
            contacts_router,
            prefix="/api/v1",
            tags=["contacts"]
        )

        app.include_router(
            groups_router,
            prefix="/api/v1",
            tags=["groups"]
        )

        app.include_router(
            import_router,
            prefix="/api/v1",
            tags=["import"]
        )

        # Add health check endpoint
        @app.get("/health", tags=["health"])
        async def health_check():
            """Health check endpoint for monitoring."""
            return {
                "status": "healthy",
                "version": "1.0.0",
                "timestamp": time.time()
            }

        # Add metrics endpoint
        @app.get("/metrics", tags=["monitoring"])
        async def metrics():
            """Prometheus metrics endpoint."""
            from prometheus_client import generate_latest
            return generate_latest()

        logger.info("Successfully configured and included all route handlers")

    except Exception as e:
        logger.error(f"Failed to configure routes: {str(e)}")
        raise RuntimeError("Failed to initialize route handlers")