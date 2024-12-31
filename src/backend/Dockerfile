# syntax=docker/dockerfile:1.4
# Enable BuildKit features
# Version: docker/buildkit v0.12.0

# Global build arguments
ARG BUILD_VERSION
ARG BUILD_DATE
ARG GIT_COMMIT

# Common build settings
ARG BUILDKIT_INLINE_CACHE=1
ARG DOCKER_BUILDKIT_CACHE="type=local,dest=./cache"

###################
# API Gateway Build
###################
FROM node:20-alpine AS api-gateway-builder

# Build-time metadata
LABEL org.opencontainers.image.title="API Gateway" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

# Set working directory
WORKDIR /app/api-gateway

# Copy package files for dependency installation
COPY --chown=node:node api-gateway/package*.json api-gateway/tsconfig.json ./

# Install dependencies with yarn for better performance
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY --chown=node:node api-gateway/src ./src

# Build TypeScript code with optimization flags
RUN yarn build && \
    yarn cache clean && \
    yarn install --production --frozen-lockfile

#######################
# Message Service Build
#######################
FROM golang:1.21-alpine AS message-service-builder

# Build-time metadata
LABEL org.opencontainers.image.title="Message Service" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

# Set secure build flags
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64 \
    GO111MODULE=on

WORKDIR /app/message-service

# Copy go.mod and go.sum for dependency caching
COPY --chown=appuser:appgroup message-service/go.mod message-service/go.sum ./

# Download dependencies
RUN go mod download && \
    go mod verify

# Copy source code and build configuration
COPY --chown=appuser:appgroup message-service/ ./

# Build with security flags
RUN go build -trimpath -ldflags="-w -s \
    -X main.Version=${BUILD_VERSION} \
    -X main.BuildDate=${BUILD_DATE} \
    -X main.GitCommit=${GIT_COMMIT}" \
    -o message-service ./cmd/server

###################
# API Gateway Final
###################
FROM node:20-alpine AS api-gateway

# Runtime metadata
LABEL maintainer="WhatsApp Web Enhancement Team" \
      description="API Gateway service for WhatsApp Web Enhancement" \
      version="${BUILD_VERSION}"

# Set production environment
ENV NODE_ENV=production \
    PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy built artifacts from builder
COPY --from=api-gateway-builder --chown=nodejs:nodejs /app/api-gateway/dist ./dist
COPY --from=api-gateway-builder --chown=nodejs:nodejs /app/api-gateway/node_modules ./node_modules
COPY --from=api-gateway-builder --chown=nodejs:nodejs /app/api-gateway/package.json ./

# Security hardening
RUN apk add --no-cache curl=~8.4.0 && \
    rm -rf /var/cache/apk/* && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs:nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 3000

ENTRYPOINT ["node", "dist/app.js"]

#######################
# Message Service Final
#######################
FROM alpine:3.18 AS message-service

# Runtime metadata
LABEL maintainer="WhatsApp Web Enhancement Team" \
      description="Message processing service for WhatsApp Web Enhancement" \
      version="${BUILD_VERSION}"

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates=~20230506 \
    tzdata=~2023c && \
    rm -rf /var/cache/apk/* && \
    update-ca-certificates

# Create non-root user
RUN addgroup -g 10001 appgroup && \
    adduser -D -u 10001 -G appgroup appuser && \
    mkdir -p /app/config && \
    chown -R appuser:appgroup /app

# Set runtime environment
ENV TZ=UTC \
    NO_COLOR=1

WORKDIR /app

# Copy binary and config from builder
COPY --from=message-service-builder --chown=appuser:appgroup /app/message-service/message-service .
COPY --from=message-service-builder --chown=appuser:appgroup /app/message-service/config/config.yaml ./config/

# Security configuration
USER appuser:appgroup

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["/app/message-service"]
CMD ["--config", "/app/config/config.yaml"]

# Security options for both services
SECURITY_OPTS --security-opt=no-new-privileges:true \
              --read-only \
              --cap-drop ALL