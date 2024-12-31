# Contact Service

A high-performance, scalable microservice for managing WhatsApp contacts and groups with comprehensive features for enterprise contact management.

## Features

- **Contact Management**
  - CRUD operations with validation
  - Bulk import/export capabilities
  - Advanced contact search and filtering
  - Version control and soft delete support
  - Real-time activity tracking

- **Group Management**
  - Dynamic group creation and management
  - Member limit enforcement (256 per group)
  - Bulk operations support
  - Activity history tracking

- **Performance Optimizations**
  - Redis caching with TTL management
  - Connection pooling for database and cache
  - Optimistic locking for concurrent operations
  - Batch processing for bulk operations

- **Security**
  - JWT-based authentication
  - Role-based access control
  - Rate limiting per endpoint
  - Data encryption at rest and in transit

- **Monitoring & Observability**
  - Prometheus metrics integration
  - OpenTelemetry tracing
  - Comprehensive logging
  - Health check endpoints

## Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7.2+
- Docker and Docker Compose
- SSL certificates for secure communication

### Dependencies

```plaintext
fastapi==0.104.0
sqlalchemy==2.0.0
pydantic==2.0.0
redis==5.0.0
prometheus-fastapi-instrumentator==6.1.0
uvicorn==0.24.0
```

## Configuration

Environment variables required for service configuration:

```plaintext
# Service Configuration
SERVICE_NAME=contact-service
ENVIRONMENT=production
LOG_LEVEL=INFO

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_contacts
DB_USER=contact_service
DB_PASSWORD=<secure-password>
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<secure-password>
REDIS_SSL=true

# Security
JWT_SECRET=<your-jwt-secret>
CORS_ORIGINS=["https://app.example.com"]
```

## API Documentation

### Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```plaintext
Authorization: Bearer <your-jwt-token>
```

### Rate Limiting

| Endpoint | Rate Limit |
|----------|------------|
| Create Contact | 50/minute |
| Bulk Operations | 10/minute |
| Other Operations | 100/minute |

### Core Endpoints

#### Contacts

```plaintext
POST /api/v1/contacts          # Create contact
GET /api/v1/contacts/{id}      # Get contact
PUT /api/v1/contacts/{id}      # Update contact
DELETE /api/v1/contacts/{id}   # Delete contact
POST /api/v1/contacts/bulk     # Bulk import
GET /api/v1/contacts/search    # Search contacts
```

#### Groups

```plaintext
POST /api/v1/groups           # Create group
GET /api/v1/groups/{id}       # Get group
PUT /api/v1/groups/{id}       # Update group
DELETE /api/v1/groups/{id}    # Delete group
POST /api/v1/groups/{id}/members # Add members
```

## Deployment

### Docker Deployment

```bash
# Build the image
docker build -t contact-service:latest .

# Run the container
docker run -d \
  --name contact-service \
  -p 8000:8000 \
  --env-file .env \
  contact-service:latest
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/contact-service/

# Scale deployment
kubectl scale deployment contact-service --replicas=3
```

## Monitoring

### Health Check

```plaintext
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-10-20T10:00:00Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### Metrics

Prometheus metrics available at:
```plaintext
GET /metrics
```

Key metrics:
- `contact_http_requests_total`
- `contact_request_duration_seconds`
- `contact_operations_total`
- `contact_cache_hits_total`

## Performance Guidelines

- Maximum contacts per request: 1000
- Maximum concurrent requests: 100
- Response time target: < 200ms
- Cache TTL: 15 minutes
- Database connection pool: 10 connections
- Maximum group size: 256 members

## Security Guidelines

- All data is encrypted at rest using AES-256
- TLS 1.3 required for all connections
- Regular security audits
- Automated vulnerability scanning
- Access logs retention: 90 days

## Development

### Local Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start service
uvicorn app.main:app --reload
```

### Testing

```bash
# Run unit tests
pytest tests/unit

# Run integration tests
pytest tests/integration

# Run load tests
locust -f tests/load/locustfile.py
```

## Support

For issues and feature requests, please contact:
- Email: support@example.com
- Slack: #contact-service-support

## License

Copyright (c) 2023 WhatsApp Web Enhancement