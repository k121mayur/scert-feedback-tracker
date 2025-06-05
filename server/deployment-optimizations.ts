import express, { Request, Response, NextFunction } from 'express';
import { getConnectionStats } from './db';
import { cache } from './cache';

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: new Date(this.lastFailureTime)
    };
  }
}

export const dbCircuitBreaker = new CircuitBreaker();

// Connection pool monitoring middleware
export function connectionPoolingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    
    // Log slow queries
    if (responseTime > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
    }

    // Monitor connection pool health
    try {
      const stats = await getConnectionStats();
      if (stats.utilizationPercent > 85) {
        console.warn(`High connection utilization: ${stats.utilizationPercent}%`);
      }
    } catch (error) {
      console.error('Failed to get connection stats:', error);
    }
  });

  next();
}

// Memory management middleware
export function memoryManagementMiddleware(req: Request, res: Response, next: NextFunction) {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

  // Clear caches if memory usage is high
  if (heapUsedMB > 1500) { // 1.5GB threshold
    console.warn(`High memory usage: ${heapUsedMB.toFixed(2)}MB - Clearing caches`);
    
    // Clear less critical caches
    cache.keys().forEach(key => {
      if (key.includes('stats') || key.includes('analytics')) {
        cache.del(key);
      }
    });
  }

  next();
}

// Rate limiting for deployment
export function deploymentRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientKey = req.ip || 'unknown';
  const rateLimitKey = `rate_limit_${clientKey}`;
  
  const requests = cache.get(rateLimitKey) || 0;
  const limit = 100; // 100 requests per minute

  if (requests >= limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    });
  }

  cache.set(rateLimitKey, requests + 1, 60); // 1 minute TTL
  next();
}

// Health check endpoint
export function healthCheckEndpoint(req: Request, res: Response) {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      database: 'unknown',
      cache: 'unknown',
      memory: 'unknown'
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      loadAverage: require('os').loadavg()
    }
  };

  // Check database health
  dbCircuitBreaker.execute(async () => {
    await getConnectionStats();
    healthCheck.services.database = 'healthy';
  }).catch(() => {
    healthCheck.services.database = 'unhealthy';
    healthCheck.status = 'degraded';
  });

  // Check cache health
  try {
    cache.set('health_check', 'ok', 10);
    const result = cache.get('health_check');
    healthCheck.services.cache = result === 'ok' ? 'healthy' : 'unhealthy';
    cache.del('health_check');
  } catch (error) {
    healthCheck.services.cache = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  healthCheck.services.memory = heapUsedMB < 1500 ? 'healthy' : 'warning';

  if (heapUsedMB > 2000) {
    healthCheck.services.memory = 'critical';
    healthCheck.status = 'unhealthy';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 
                    healthCheck.status === 'degraded' ? 207 : 503;

  res.status(statusCode).json(healthCheck);
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any) {
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Graceful shutdown initiated...`);
    
    server.close(() => {
      console.log('HTTP server closed');
      
      // Close database connections
      // db.end() would be called here if available
      
      // Clear all timers and intervals
      cache.flushAll();
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}