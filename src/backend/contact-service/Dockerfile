# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies required for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /app

# Copy dependency files
COPY requirements.txt pyproject.toml ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app

# Stage 2: Final runtime image
FROM python:3.11-slim

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    MODULE_NAME=src.app \
    VARIABLE_NAME=app \
    APP_ENV=production

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin appuser

# Create and set working directory
WORKDIR /app

# Copy installed dependencies and application code from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /app /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs \
    && chown -R appuser:appuser /app \
    && chmod -R 755 /app \
    && chmod -R 777 /app/logs /app/data

# Set up volume mounts
VOLUME ["/app/data", "/app/logs"]

# Expose port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Resource limits
ENV UVICORN_WORKERS=4 \
    UVICORN_LIMIT_CONCURRENCY=1000 \
    UVICORN_TIMEOUT_KEEP_ALIVE=30

# Set security options
LABEL org.opencontainers.image.source="https://github.com/your-org/whatsapp-web-enhancement" \
      org.opencontainers.image.description="Contact Service for WhatsApp Web Enhancement" \
      org.opencontainers.image.version="1.0.0"

# Set read-only root filesystem
RUN chmod a-w /etc /usr

# Entry point
ENTRYPOINT ["uvicorn"]
CMD ["src.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--limit-concurrency", "1000", "--timeout-keep-alive", "30"]

# Apply security options
SECURITY_OPT ["no-new-privileges:true"]