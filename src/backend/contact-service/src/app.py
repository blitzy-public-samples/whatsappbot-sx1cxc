# External imports with version specifications
from fastapi import FastAPI, Request, Response  # fastapi ^0.104.0
from fastapi.middleware.cors import CORSMiddleware  # fastapi ^0.104.0
from fastapi.security import JWTBearer  # fastapi ^0.104.0
from fastapi.responses import JSONResponse
from fastapi_limiter import FastAPILimiter  # fastapi-limiter ^0.1.5
from fastapi_limiter.depends import RateLimiter
from prometheus_fastapi_instrumentator import Instrumentator  # prometheus-fastapi-instrumentator ^6.1.0
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
import uvicorn  # uvicorn ^0.24.0
import asyncpg  # asyncpg ^0.29.0
import redis.asyncio as redis  # redis ^4.5.0
import logging
import uuid
from datetime import datetime
from typing import Dict, Optional

# Internal imports
from .config import ServiceConfig
from .routes.contacts import router as contacts_router

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="Contact Service",
    description="WhatsApp Web Enhancement Contact Management Service",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize configuration and logging
config = ServiceConfig()
logger = logging.getLogger(__name__)

# Initialize metrics collector
instrumentator = Instrumentator().instrument(app)

# Database and Redis connection pools
db_pool: Optional[asyncpg.Pool] = None
redis_pool: Optional[redis.Redis] = None

class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Middleware for request tracing and correlation ID management."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract trace ID
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
        request.state.trace_id = trace_id
        
        # Add trace ID to response headers
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        
        return response

async def configure_middleware() -> None:
    """Configure application middleware with security and performance optimizations."""
    
    # Request tracing middleware
    app.add_middleware(RequestTracingMiddleware)
    
    # CORS middleware with configured origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Trace-ID"]
    )
    
    # Rate limiting middleware
    app.add_middleware(
        RateLimiter,
        key_func=lambda r: f"{r.client.host}:{r.url.path}",
        rate_limits=config.rate_limits
    )
    
    # Compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # JWT authentication middleware
    app.add_middleware(
        JWTBearer,
        auto_error=True,
        secret_key=config.jwt_secret
    )

async def configure_routes() -> None:
    """Configure API routes with versioning and documentation."""
    
    # Mount contact management routes
    app.include_router(
        contacts_router,
        prefix="/api/v1/contacts",
        tags=["contacts"]
    )
    
    # Health check endpoint
    @app.get("/health", tags=["monitoring"])
    async def health_check() -> Dict:
        """Comprehensive health check endpoint."""
        try:
            # Check database connectivity
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            
            # Check Redis connectivity
            await redis_pool.ping()
            
            return {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "version": app.version,
                "database": "connected",
                "redis": "connected"
            }
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": str(e)
                }
            )

@app.on_event("startup")
async def startup_handler() -> None:
    """Initialize service components and connections."""
    try:
        global db_pool, redis_pool
        
        # Initialize logging
        config.setup_logging()
        
        # Initialize database connection pool
        db_pool = await asyncpg.create_pool(
            config.db.get_connection_url(),
            min_size=5,
            max_size=config.db.pool_size,
            command_timeout=config.db.command_timeout
        )
        
        # Initialize Redis connection pool
        redis_pool = redis.Redis(
            connection_pool=redis.ConnectionPool(**config.redis.get_connection_params())
        )
        
        # Configure middleware
        await configure_middleware()
        
        # Configure routes
        await configure_routes()
        
        # Initialize rate limiter
        await FastAPILimiter.init(redis_pool)
        
        # Initialize metrics collection
        instrumentator.expose(app, include_in_schema=False, tags=["monitoring"])
        
        logger.info("Contact Service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start Contact Service: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_handler() -> None:
    """Gracefully shutdown service components."""
    try:
        # Close database connection pool
        if db_pool:
            await db_pool.close()
        
        # Close Redis connection pool
        if redis_pool:
            await redis_pool.close()
        
        logger.info("Contact Service shut down successfully")
        
    except Exception as e:
        logger.error(f"Error during Contact Service shutdown: {str(e)}")
        raise

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        log_level="info",
        reload=False,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )