"""
Analytics Service - FastAPI Application Entry Point

This module initializes and configures the FastAPI application for the Analytics Service
with comprehensive monitoring, performance optimization, and reliability features.

Version: 1.0.0
"""

import logging
from typing import Dict
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator  # v6.1.0
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration  # v1.32.0
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # v0.41b0
from fastapi_cache import FastAPICache  # v0.2.1
from fastapi_cache.backends.redis import RedisBackend
import aioredis
import uvicorn

from .config import Config, load_config

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="Analytics Service",
    version="1.0.0",
    docs_url="/analytics/docs",
    redoc_url="/analytics/redoc",
    openapi_url="/analytics/openapi.json"
)

# Load configuration
config = load_config()

# Configure logging
logging.basicConfig(
    level=config.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

async def init_monitoring() -> None:
    """Initialize comprehensive monitoring and instrumentation."""
    # Initialize Sentry SDK for error tracking
    sentry_sdk.init(
        dsn=config.security_settings.get("sentry_dsn"),
        environment=config.environment,
        traces_sample_rate=1.0,
        integrations=[FastApiIntegration()],
        enable_tracing=True
    )

    # Initialize Prometheus metrics
    instrumentator = Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="analytics_requests_inprogress",
        inprogress_labels=True
    )
    instrumentator.instrument(app).expose(app, include_in_schema=False)

    # Initialize OpenTelemetry tracing
    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="health,metrics",
        tracer_provider=config.tracing.provider
    )

async def init_middleware() -> None:
    """Configure optimized middleware stack."""
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_settings["allowed_origins"],
        allow_credentials=True,
        allow_methods=config.cors_settings["allowed_methods"],
        allow_headers=config.cors_settings["allowed_headers"],
        max_age=config.cors_settings["max_age"]
    )

    # Compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Custom middleware for request tracking
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

@app.on_event("startup")
async def startup_handler() -> None:
    """Initialize service resources on startup."""
    logger.info(f"Starting Analytics Service in {config.environment} environment")
    
    # Initialize monitoring
    await init_monitoring()
    
    # Initialize middleware
    await init_middleware()
    
    # Initialize Redis cache
    redis = aioredis.from_url(
        f"redis://{config.redis.host}:{config.redis.port}",
        password=config.redis.password.get_secret_value(),
        db=config.redis.db,
        encoding="utf8",
        decode_responses=True
    )
    FastAPICache.init(RedisBackend(redis), prefix="analytics-cache:")
    
    logger.info("Analytics Service startup completed")

@app.on_event("shutdown")
async def shutdown_handler() -> None:
    """Graceful shutdown handler."""
    logger.info("Initiating Analytics Service shutdown")
    
    # Close Redis connections
    await FastAPICache.clear()
    
    # Flush metrics
    await Instrumentator().shutdown()
    
    logger.info("Analytics Service shutdown completed")

@app.get("/health")
async def health_check() -> Dict:
    """Health check endpoint with detailed status."""
    return {
        "status": "healthy",
        "environment": config.environment,
        "version": app.version,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@app.get("/readiness")
async def readiness_check() -> Dict:
    """Readiness check endpoint with dependency status."""
    status = {
        "status": "ready",
        "dependencies": {
            "database": await check_db_connection(),
            "redis": await check_redis_connection(),
            "metrics": config.metrics.enabled
        }
    }
    return JSONResponse(
        content=status,
        status_code=200 if all(status["dependencies"].values()) else 503
    )

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        workers=config.worker_count,
        log_level=config.log_level.lower(),
        reload=config.environment == "development",
        ssl_keyfile=config.security_settings.get("ssl_keyfile"),
        ssl_certfile=config.security_settings.get("ssl_certfile")
    )