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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

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
  
  // Production server optimizations for high load
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.maxConnections = 1000;
  server.timeout = 30000;
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    backlog: 511, // Queue for pending connections
  }, () => {
    log(`serving on port ${port} with production optimizations`);
    
    // Start memory monitoring
    monitorMemory();
    
    // Setup graceful shutdown
    setupGracefulShutdown(server);
    
    // Log server configuration
    log(`Max connections: ${server.maxConnections}`);
    log(`Keep-alive timeout: ${server.keepAliveTimeout}ms`);
    log(`Connection backlog: 511`);
    log(`Production deployment ready`);
  });
})();
