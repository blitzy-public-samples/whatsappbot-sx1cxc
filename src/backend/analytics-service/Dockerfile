# Build stage
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Set production environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS=4

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1000 analytics && \
    useradd -u 1000 -g analytics -s /bin/bash -m analytics

# Set working directory
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY --chown=analytics:analytics . .

# Set file permissions
RUN chmod -R 755 /app && \
    find /app -type f -exec chmod 644 {} \;

# Set resource limits
ENV UVICORN_WORKERS=${WORKERS} \
    UVICORN_MAX_REQUESTS=1000 \
    UVICORN_MAX_REQUESTS_JITTER=50

# Expose port
EXPOSE 8000

# Switch to non-root user
USER analytics

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Set security options
LABEL security.nsa.gov.sensitivity=high
LABEL org.opencontainers.image.source="https://github.com/org/whatsapp-web-enhancement"
LABEL org.opencontainers.image.description="Analytics Service for WhatsApp Web Enhancement"
LABEL org.opencontainers.image.version="1.0.0"

# Set resource limits
LABEL com.docker.resource.cpu="2" \
      com.docker.resource.memory="4Gi" \
      com.docker.resource.pids="1000" \
      com.docker.resource.nofile="1000000"

# Start the FastAPI application with uvicorn
ENTRYPOINT ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]