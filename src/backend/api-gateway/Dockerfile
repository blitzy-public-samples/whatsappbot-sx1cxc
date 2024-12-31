# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production dependencies and built code
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Security hardening
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/* && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs:nodejs

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose API port
EXPOSE 3000

# Set entry point
ENTRYPOINT ["node", "dist/app.js"]

# Apply resource constraints
LABEL com.docker.resource.cpu="2" \
      com.docker.resource.memory="4G"

# Add metadata labels
LABEL maintainer="WhatsApp Web Enhancement Team" \
      description="API Gateway service for WhatsApp Web Enhancement Application" \
      version="1.0.0" \
      org.opencontainers.image.source="https://github.com/whatsapp-web/api-gateway" \
      org.opencontainers.image.licenses="MIT"