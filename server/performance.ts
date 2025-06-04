import express from 'express';
import compression from 'compression';
import helmet from 'helmet';

// Performance middleware for high-load scenarios
export const setupPerformanceMiddleware = (app: express.Application) => {
  // Enable compression for better bandwidth utilization
  app.use(compression({
    level: 6, // Balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Security headers with performance optimizations
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    hsts: false, // Let Replit handle HTTPS
  }));

  // Request timeout for handling overload
  app.use((req, res, next) => {
    req.setTimeout(30000); // 30 second timeout
    res.setTimeout(30000);
    next();
  });

  // Rate limiting headers for monitoring
  app.use((req, res, next) => {
    res.setHeader('X-RateLimit-Limit', '1000');
    res.setHeader('X-RateLimit-Remaining', '999');
    next();
  });

  // Disable unnecessary headers
  app.disable('x-powered-by');
  app.disable('etag');
};

// Response optimization utilities
export const optimizeResponse = {
  // Cache-Control headers for static content
  cacheStatic: (res: express.Response, maxAge: number = 3600) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  },

  // No-cache headers for dynamic content
  noCacheDynamic: (res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },

  // JSON response with optimized headers
  jsonResponse: (res: express.Response, data: any, statusCode: number = 200) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(statusCode).json(data);
  }
};

// Memory monitoring for high-load scenarios
export const monitorMemory = () => {
  const used = process.memoryUsage();
  console.log(`Memory Usage: RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
  
  // Garbage collection if memory usage is high
  if (used.heapUsed > 512 * 1024 * 1024) { // 512MB threshold
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection due to high memory usage');
    }
  }
};

// Performance metrics collection
export const performanceMetrics = {
  requestCount: 0,
  responseTime: [] as number[],
  
  recordRequest: (startTime: number) => {
    performanceMetrics.requestCount++;
    const duration = Date.now() - startTime;
    performanceMetrics.responseTime.push(duration);
    
    // Keep only last 1000 measurements
    if (performanceMetrics.responseTime.length > 1000) {
      performanceMetrics.responseTime = performanceMetrics.responseTime.slice(-1000);
    }
  },
  
  getStats: () => ({
    totalRequests: performanceMetrics.requestCount,
    averageResponseTime: performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / performanceMetrics.responseTime.length || 0,
    p95ResponseTime: performanceMetrics.responseTime.sort()[Math.floor(performanceMetrics.responseTime.length * 0.95)] || 0
  })
};