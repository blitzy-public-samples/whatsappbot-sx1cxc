# -----------------------------
# Stage 1: Build stage
# Base image: node:20-alpine (v20.9.0)
# -----------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Set build environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    VITE_APP_VERSION=${BUILD_VERSION:-1.0.0}

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && npm install -g npm@latest \
    && npm config set cache /root/.npm \
    && npm config set registry https://registry.npmjs.org/

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production \
    && npm audit fix \
    && npm cache clean --force

# Copy source code with appropriate permissions
COPY --chown=node:node . .

# Build production bundle with optimization flags
RUN npm run build -- --mode production --sourcemap false \
    && npm prune --production

# -----------------------------
# Stage 2: Production stage
# Base image: nginx:1.25-alpine (v1.25.3)
# -----------------------------
FROM nginx:1.25-alpine

# Create non-root user for nginx
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Install required packages
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx nginx-security-headers.conf /etc/nginx/security-headers.conf

# Create required directories with correct permissions
RUN mkdir -p /var/cache/nginx \
    /var/run \
    /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    /var/run \
    /usr/share/nginx/html \
    && chmod -R 755 /var/cache/nginx \
    /var/run \
    /usr/share/nginx/html

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Configure security headers
RUN echo 'add_header X-Frame-Options "DENY";' >> /etc/nginx/security-headers.conf \
    && echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/security-headers.conf \
    && echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/security-headers.conf \
    && echo 'add_header Referrer-Policy "strict-origin-when-cross-origin";' >> /etc/nginx/security-headers.conf \
    && echo 'add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\'' data:; connect-src '\''self'\'' https://api.whatsapp.com;";' >> /etc/nginx/security-headers.conf \
    && echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";' >> /etc/nginx/security-headers.conf

# Configure nginx with security optimizations
RUN echo 'client_body_timeout 10s;' >> /etc/nginx/nginx.conf \
    && echo 'client_header_timeout 10s;' >> /etc/nginx/nginx.conf \
    && echo 'keepalive_timeout 65s;' >> /etc/nginx/nginx.conf \
    && echo 'server_tokens off;' >> /etc/nginx/nginx.conf

# Enable gzip compression
RUN echo 'gzip on;' >> /etc/nginx/nginx.conf \
    && echo 'gzip_comp_level 6;' >> /etc/nginx/nginx.conf \
    && echo 'gzip_types text/plain text/css application/javascript application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/nginx.conf

# Configure rate limiting
RUN echo 'limit_req_zone $binary_remote_addr zone=one:10m rate=100r/s;' >> /etc/nginx/nginx.conf \
    && echo 'limit_req zone=one burst=20 nodelay;' >> /etc/nginx/nginx.conf

# Add health check endpoint
RUN echo 'location /health { return 200 "healthy\n"; }' >> /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Set up volumes
VOLUME ["/var/cache/nginx", "/var/run"]

# Switch to non-root user
USER nginx

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]