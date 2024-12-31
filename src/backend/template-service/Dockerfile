# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and TypeScript configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine

# Set Node.js to run in production mode
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 -S node && \
    adduser -u 1001 -S node -G node

# Install curl for health check and security updates
RUN apk --no-cache add curl && \
    apk upgrade --no-cache

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set proper permissions
RUN chown -R node:node /app && \
    chmod -R 755 /app

# Configure security settings
RUN mkdir -p /app/node_modules/.cache && \
    chown -R node:node /app/node_modules/.cache && \
    chmod -R 755 /app/node_modules/.cache

# Create volume mount point with proper permissions
VOLUME ["/app/node_modules"]

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=2048"
LABEL com.kubernetes.resource.cpu="1" \
      com.kubernetes.resource.memory="2G"

# Configure read-only root filesystem
RUN chmod -R 755 /app && \
    chmod -R 755 /app/node_modules

# Set entry point
CMD ["node", "dist/app.js"]