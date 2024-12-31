# Stage 1: Builder
FROM golang:1.21-alpine AS builder

# Build arguments for versioning and tracking
ARG APP_NAME=message-service
ARG APP_VERSION=latest
ARG BUILD_DATE
ARG GIT_COMMIT

# Build-time labels
LABEL org.opencontainers.image.title="${APP_NAME}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.vendor="WhatsApp Web Enhancement" \
      org.opencontainers.image.source="https://github.com/whatsapp-web-enhancement/message-service" \
      org.opencontainers.image.description="WhatsApp message processing service"

# Set secure build flags
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GO111MODULE=on \
    GOSUMDB=sum.golang.org

# Install build dependencies
RUN apk add --no-cache \
    git=~2.40 \
    make=~4.4 \
    gcc=~12.2 \
    && rm -rf /var/cache/apk/*

# Create non-root user for build
RUN addgroup -g 10001 appgroup && \
    adduser -D -u 10001 -G appgroup appuser

WORKDIR /build

# Copy go.mod and go.sum first for better layer caching
COPY --chown=appuser:appgroup go.mod go.sum ./

# Download dependencies
RUN go mod download && \
    go mod verify

# Copy source code
COPY --chown=appuser:appgroup . .

# Build the application with security flags
RUN go build -trimpath -ldflags="-w -s \
    -X main.Version=${APP_VERSION} \
    -X main.BuildDate=${BUILD_DATE} \
    -X main.GitCommit=${GIT_COMMIT}" \
    -o message-service ./cmd/server

# Stage 2: Final runtime
FROM alpine:3.18

# Runtime labels
LABEL maintainer="WhatsApp Web Enhancement Team" \
      description="Production image for WhatsApp message processing service" \
      security-severity="high"

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    ca-certificates=~20230506 \
    tzdata=~2023c \
    && rm -rf /var/cache/apk/* \
    && update-ca-certificates

# Create non-root user for runtime
RUN addgroup -g 10001 appgroup && \
    adduser -D -u 10001 -G appgroup appuser && \
    mkdir -p /app/config && \
    chown -R appuser:appgroup /app

# Set runtime environment variables
ENV TZ=UTC \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    NO_COLOR=1

WORKDIR /app

# Copy binary and config from builder
COPY --from=builder --chown=appuser:appgroup /build/message-service .
COPY --from=builder --chown=appuser:appgroup /build/config/config.yaml ./config/

# Create necessary directories with appropriate permissions
RUN mkdir -p /app/tmp && \
    chown -R appuser:appgroup /app/tmp && \
    chmod 755 /app/message-service

# Configure security options
USER appuser:appgroup
EXPOSE 8080

# Set resource limits
LABEL resource.memory.limit="4g" \
      resource.cpu.limit="2"

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Set security options
SECURITY_OPTS --security-opt=no-new-privileges:true \
              --security-opt=seccomp=unconfined \
              --read-only \
              --tmpfs /tmp \
              --tmpfs /var/run \
              --cap-drop ALL

# Define volume for configuration
VOLUME ["/app/config"]

# Start the application
ENTRYPOINT ["/app/message-service"]
CMD ["--config", "/app/config/config.yaml"]