import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupPerformanceMiddleware, performanceMetrics, monitorMemory } from "./performance";
import { 
  connectionPoolingMiddleware, 
  memoryManagementMiddleware, 
  deploymentRateLimiter, 
  healthCheckEndpoint,
  setupGracefulShutdown 
} from "./deployment-optimizations";
import {
  globalRateLimiter,
  ddosProtection,
  fairResourceAllocation
} from "./rate-limiting";
import { queueProcessor } from "./queue-processor";
import { connectionOptimizer } from "./connection-optimizer";
import { loadTestOptimizer } from "./load-test-optimizer";

const app = express();

// Production deployment middleware stack with enhanced rate limiting
app.use(ddosProtection);
app.use(fairResourceAllocation);
app.use(globalRateLimiter.middleware());
app.use(connectionPoolingMiddleware);
app.use(memoryManagementMiddleware);
app.use(deploymentRateLimiter);

// High-performance middleware setup for 40k concurrent users
setupPerformanceMiddleware(app);

// Socket optimization and connection tracking for load testing
app.use((req, res, next) => {
  const connectionId = `${req.ip}-${Date.now()}-${Math.random()}`;
  connectionOptimizer.trackConnectionStart(connectionId);
  
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=120, max=1000');
  
  res.on('finish', () => {
    connectionOptimizer.trackConnectionEnd(connectionId, res.statusCode < 400);
  });
  
  res.on('error', () => {
    connectionOptimizer.trackConnectionEnd(connectionId, false);
  });
  
  next();
});

// Health check endpoint for load balancers
app.get('/health', healthCheckEndpoint);

// Request timing middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    performanceMetrics.recordRequest(startTime);
  });
  
  next();
});

// Optimized payload limits for load testing
app.use(express.json({ 
  limit: '100kb', // Reduced payload size to prevent memory bloat
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: false, 
  limit: '100kb',
  parameterLimit: 20 // Limit URL parameters
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Node.js process optimization for high concurrent load
process.setMaxListeners(0); // Remove event emitter limits

// Increase UV thread pool size for I/O operations
process.env.UV_THREADPOOL_SIZE = '128';

// Optimize garbage collection for high throughput
if (typeof global.gc === 'function') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 800 * 1024 * 1024 && global.gc) { // 800MB
      global.gc();
    }
  }, 30000); // Every 30 seconds
}

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  
  // Production server optimizations for high load and load testing
  server.keepAliveTimeout = 120000; // Increased to 2 minutes
  server.headersTimeout = 125000; // Slightly higher than keepAlive
  server.maxConnections = 10000; // Increased from 1000 to 10000 for load testing
  server.timeout = 60000; // Increased to 1 minute
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    backlog: 2048, // Increased backlog for high load testing
  }, () => {
    log(`serving on port ${port} with production optimizations`);
    
    // Start memory monitoring
    monitorMemory();
    
    // Start queue processor for exam submissions
    queueProcessor.startProcessing();
    
    // Apply load testing optimizations
    loadTestOptimizer.applyOptimizations();
    
    // Start connection optimization monitoring
    connectionOptimizer.on('metrics', (metrics) => {
      if (metrics.connectionErrors > 50) {
        log(`High connection errors detected: ${metrics.connectionErrors}`);
      }
      if (metrics.averageResponseTime > 2000) {
        log(`High response times detected: ${metrics.averageResponseTime}ms`);
      }
    });
    
    // Monitor load test optimizations
    loadTestOptimizer.on('metrics', (metrics) => {
      if (metrics.errorRate > 0.1) {
        log(`High load test error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
      }
    });
    
    // Setup graceful shutdown
    setupGracefulShutdown(server);
    
    // Log server configuration
    log(`Max connections: ${server.maxConnections}`);
    log(`Keep-alive timeout: ${server.keepAliveTimeout}ms`);
    log(`Connection backlog: 2048`);
    log(`Queue processor started`);
    log(`Production deployment ready`);
  });
})();
