// External imports
import express, { Application, Request, Response, NextFunction } from 'express'; // v4.18.x
import cors from 'cors'; // v2.8.x
import helmet from 'helmet'; // v7.0.x
import compression from 'compression'; // v1.7.x
import morgan from 'morgan'; // v1.10.x
import winston from 'winston'; // v3.10.x
import promClient from 'prom-client'; // v14.2.x

// Internal imports
import router from './routes';
import { authenticate, authorize } from './middleware/auth';
import rateLimitMiddleware from './middleware/rateLimit';
import { validateSchema } from './middleware/validation';
import { ServiceError, createErrorResponse } from './types';
import { config } from './config';

// Initialize Prometheus metrics
const metrics = {
  httpRequestDuration: new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status']
  }),
  httpRequestTotal: new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
  })
};

// Configure Winston logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.directory}/error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.directory}/combined.log` 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Creates and configures the Express application
 * @returns {Application} Configured Express application
 */
function createApp(): Application {
  const app: Application = express();

  // Basic middleware
  app.use(express.json({ limit: '16mb' }));
  app.use(express.urlencoded({ extended: true, limit: '16mb' }));
  app.use(compression());

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors({
    origin: config.server.cors.origin,
    methods: config.server.cors.methods,
    allowedHeaders: config.server.cors.allowedHeaders,
    exposedHeaders: config.server.cors.exposedHeaders,
    credentials: config.server.cors.credentials,
    maxAge: config.server.cors.maxAge
  }));

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Metrics middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      metrics.httpRequestDuration.observe(
        {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode
        },
        duration / 1000
      );
      metrics.httpRequestTotal.inc({
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode
      });
    });
    next();
  });

  // Request tracking
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = req.headers['x-request-id']?.toString() || 
             `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Mount metrics endpoint
  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      res.set('Content-Type', promClient.register.contentType);
      res.end(await promClient.register.metrics());
    } catch (error) {
      res.status(500).end(error instanceof Error ? error.message : 'Error collecting metrics');
    }
  });

  // Mount main router
  app.use('/', router);

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error handling request:', {
      error: err.message,
      stack: err.stack,
      requestId: req.id,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    const statusCode = err instanceof ServiceError ? err.code : 500;
    const serviceError = err instanceof ServiceError ? err : new ServiceError(
      9001,
      'Internal server error',
      {
        field: 'server',
        reason: err.message,
        value: undefined,
        context: { 
          requestId: req.id,
          path: req.path
        }
      }
    );

    res.status(statusCode).json(createErrorResponse(serviceError, {
      timestamp: Date.now(),
      requestId: req.id,
      version: config.server.apiVersion
    }));
  });

  return app;
}

/**
 * Starts the Express server
 * @param {Application} app - Configured Express application
 * @returns {Promise<void>}
 */
async function startServer(app: Application): Promise<void> {
  const port = config.server.port;

  // Create HTTP/HTTPS server based on configuration
  const server = config.server.ssl.enabled
    ? require('https').createServer({
        key: config.server.ssl.key,
        cert: config.server.ssl.cert,
        ca: config.server.ssl.ca
      }, app)
    : require('http').createServer(app);

  // Configure keep-alive
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Start server
  server.listen(port, () => {
    logger.info(`Server started on port ${port}`, {
      timestamp: new Date().toISOString(),
      environment: config.server.env,
      version: config.server.apiVersion
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');
    server.close(() => {
      logger.info('Server shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Create and export app instance
const app = createApp();
export default app;

// Start server if running directly
if (require.main === module) {
  startServer(app).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}