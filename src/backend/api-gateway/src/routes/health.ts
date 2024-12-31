// External dependencies
import { Router, Request, Response } from 'express'; // v4.18.x
import CircuitBreaker from 'opossum'; // v6.x.x
import os from 'os';

// Internal dependencies
import { ApiResponse } from '../types';

// Constants
const HEALTH_CHECK_PATH = '/health';
const CACHE_TTL = 30000; // 30 seconds cache for dependency checks
const DEPENDENCY_TIMEOUT = 5000; // 5 seconds timeout for dependency checks

// Interfaces
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
}

interface HealthStatus {
  status: string;
  timestamp: number;
  uptime: number;
  version: string;
  dependencies: Record<string, boolean>;
  metrics: SystemMetrics;
}

// Cache for dependency status
let dependencyStatusCache: Record<string, boolean> | null = null;
let lastCacheUpdate = 0;
let requestCounter = 0;
let lastRequestCount = 0;
let lastRequestTime = Date.now();

// Initialize router
const router = Router();

/**
 * Collects current system performance metrics
 * @returns {Promise<SystemMetrics>} Current system metrics
 */
async function getSystemMetrics(): Promise<SystemMetrics> {
  // Calculate CPU usage
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  // Calculate memory usage
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  // Calculate request rate (requests per second)
  const currentTime = Date.now();
  const timeDiff = (currentTime - lastRequestTime) / 1000;
  const requestDiff = requestCounter - lastRequestCount;
  const requestRate = requestDiff / timeDiff;

  // Update request tracking
  lastRequestCount = requestCounter;
  lastRequestTime = currentTime;

  return {
    cpuUsage: Math.round(cpuUsage * 100) / 100,
    memoryUsage: Math.round(memoryUsage * 100) / 100,
    requestRate: Math.round(requestRate * 100) / 100
  };
}

/**
 * Checks dependency health with circuit breaker pattern
 * @returns {Promise<Record<string, boolean>>} Status of each dependency
 */
const checkDependencies = new CircuitBreaker(async () => {
  // Skip cache check if within TTL
  if (dependencyStatusCache && (Date.now() - lastCacheUpdate) < CACHE_TTL) {
    return dependencyStatusCache;
  }

  const dependencies: Record<string, boolean> = {
    database: false,
    redis: false,
    messageService: false,
    contactService: false,
    templateService: false
  };

  try {
    // Check PostgreSQL connection
    // Note: Actual implementation would use dependency injection
    dependencies.database = true;

    // Check Redis connection
    dependencies.redis = true;

    // Check microservices health
    const services = ['messageService', 'contactService', 'templateService'];
    await Promise.all(services.map(async (service) => {
      try {
        // Implement actual health check calls to each service
        dependencies[service] = true;
      } catch (error) {
        dependencies[service] = false;
      }
    }));

    // Update cache
    dependencyStatusCache = dependencies;
    lastCacheUpdate = Date.now();

    return dependencies;
  } catch (error) {
    throw new Error('Dependency check failed');
  }
}, {
  timeout: DEPENDENCY_TIMEOUT,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

/**
 * Health check endpoint handler
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function checkHealth(req: Request, res: Response): Promise<void> {
  requestCounter++;

  try {
    // Get system metrics
    const metrics = await getSystemMetrics();

    // Check dependencies
    const dependencies = await checkDependencies.fire();

    // Determine overall status
    const isHealthy = Object.values(dependencies).every(status => status);

    // Compile health status
    const healthStatus: HealthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies,
      metrics
    };

    // Send response
    const response: ApiResponse<HealthStatus> = {
      success: true,
      data: healthStatus,
      error: null,
      metadata: {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id']?.toString() || 'unknown',
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    // Handle errors
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: 9001,
        message: 'Health check failed',
        details: null,
        timestamp: new Date()
      },
      metadata: {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id']?.toString() || 'unknown',
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    res.status(500).json(response);
  }
}

// Configure health check route
router.get(HEALTH_CHECK_PATH, checkHealth);

export default router;