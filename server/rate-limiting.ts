import { Request, Response, NextFunction } from 'express';
import { redisClient } from './redis-alternative';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Rate limiting specifically designed for 40K concurrent teacher assessments
export class AdvancedRateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  // Create middleware for different types of requests
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.config.keyGenerator ? 
          this.config.keyGenerator(req) : 
          `rate_limit_${req.ip}`;

        const current = await this.getCurrentRequests(key);
        
        if (current >= this.config.maxRequests) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'बहुत अधिक अनुरोध। कृपया कुछ समय प्रतीक्षा करें।',
            retryAfter: Math.ceil(this.config.windowMs / 1000),
            currentLimit: this.config.maxRequests,
            windowMs: this.config.windowMs
          });
        }

        await this.incrementCounter(key);
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': (this.config.maxRequests - current - 1).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + this.config.windowMs).toISOString()
        });

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // In case of rate limiter failure, allow the request to proceed
        next();
      }
    };
  }

  private async getCurrentRequests(key: string): Promise<number> {
    const count = await redisClient.get(key);
    return count ? parseInt(count) : 0;
  }

  private async incrementCounter(key: string): Promise<void> {
    const current = await redisClient.get(key);
    if (current) {
      await redisClient.set(key, (parseInt(current) + 1).toString());
    } else {
      await redisClient.set(key, '1', { EX: Math.ceil(this.config.windowMs / 1000) });
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const assessmentRateLimiter = new AdvancedRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per IP
  keyGenerator: (req) => `assessment_${req.ip}`,
  skipSuccessfulRequests: false
});

export const authRateLimiter = new AdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // 20 login attempts per 15 minutes per IP
  keyGenerator: (req) => `auth_${req.ip}`,
  skipSuccessfulRequests: true
});

export const submissionRateLimiter = new AdvancedRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10, // 10 exam submissions per 5 minutes per IP
  keyGenerator: (req) => `submission_${req.ip}`,
  skipSuccessfulRequests: false
});

export const globalRateLimiter = new AdvancedRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // 200 requests per minute per IP (generous for normal use)
  keyGenerator: (req) => `global_${req.ip}`
});

// DDoS protection middleware
export const ddosProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /bot|crawler|spider/i,
    /curl|wget|python-requests/i,
    /automated|script/i
  ];

  const userAgent = req.get('User-Agent') || '';
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

  if (isSuspicious) {
    console.log(`Suspicious request from ${req.ip}: ${userAgent}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Automated requests are not allowed'
    });
  }

  next();
};

// Fair resource allocation for peak times
export const fairResourceAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check current system load
    const activeConnections = await redisClient.get('active_connections') || '0';
    const connectionCount = parseInt(activeConnections);

    // If system is under heavy load, implement queuing
    if (connectionCount > 35000) { // 87.5% of 40K capacity
      const queuePosition = await redisClient.llen('connection_queue');
      
      if (queuePosition > 1000) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'सिस्टम अत्यधिक व्यस्त है। कृपया बाद में पुनः प्रयास करें।',
          queuePosition,
          estimatedWaitTime: Math.ceil(queuePosition / 10) // Assuming 10 users processed per second
        });
      }

      // Add to queue
      await redisClient.lpush('connection_queue', `${req.ip}_${Date.now()}`);
    }

    // Track active connection
    await redisClient.set('active_connections', (connectionCount + 1).toString(), { EX: 300 });

    // Cleanup on response end
    res.on('finish', async () => {
      const current = await redisClient.get('active_connections') || '1';
      await redisClient.set('active_connections', Math.max(0, parseInt(current) - 1).toString(), { EX: 300 });
    });

    next();
  } catch (error) {
    console.error('Fair resource allocation error:', error);
    next();
  }
};

// Health check for rate limiting system
export const rateLimitHealthCheck = async (): Promise<boolean> => {
  try {
    await redisClient.set('health_check', 'ok', { EX: 10 });
    const result = await redisClient.get('health_check');
    return result === 'ok';
  } catch (error) {
    console.error('Rate limit health check failed:', error);
    return false;
  }
};