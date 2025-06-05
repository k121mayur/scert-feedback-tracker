import { Request, Response, NextFunction } from 'express';

// Circuit breaker for database connections
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
    return this.state;
  }
}

export const dbCircuitBreaker = new CircuitBreaker();

// Connection pooling middleware
export function connectionPoolingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Set connection headers for load balancing
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=30, max=100');
  
  // Request timeout handling
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Request timeout',
        timestamp: new Date().toISOString()
      });
    }
  }, 25000);
  
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
}

// Memory management for high load
export function memoryManagementMiddleware(req: Request, res: Response, next: NextFunction) {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // Memory pressure detection
  if (heapUsedMB > 450) { // 450MB threshold
    console.warn(`High memory usage: ${heapUsedMB}MB`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // If memory is critically high, reject new requests
    if (heapUsedMB > 500) {
      return res.status(503).json({
        error: 'Service temporarily unavailable - high memory usage',
        retryAfter: 30
      });
    }
  }
  
  next();
}

// Rate limiting per IP for deployment
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function deploymentRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100; // Per minute per IP
  
  const clientData = rateLimitMap.get(clientIP);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIP, {
      count: 1,
      resetTime: now + windowMs
    });
    return next();
  }
  
  if (clientData.count >= maxRequests) {
    res.setHeader('Retry-After', Math.ceil((clientData.resetTime - now) / 1000));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
  
  clientData.count++;
  next();
}

// Health check endpoint for load balancers
export function healthCheckEndpoint(req: Request, res: Response) {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024)
    },
    circuitBreaker: dbCircuitBreaker.getState()
  });
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any) {
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.log('Forcing shutdown after timeout...');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}