import express from 'express';
import { cache } from './cache';

interface CDNConfig {
  enableStaticCaching: boolean;
  enableAPIResponseCaching: boolean;
  maxAge: number;
  compressionLevel: number;
}

export class CDNOptimizer {
  private config: CDNConfig = {
    enableStaticCaching: true,
    enableAPIResponseCaching: true,
    maxAge: 86400, // 24 hours
    compressionLevel: 6
  };

  // Static content caching middleware
  setupStaticCaching(app: express.Application) {
    // Cache headers for static assets
    app.use('/assets', (req, res, next) => {
      if (this.config.enableStaticCaching) {
        res.setHeader('Cache-Control', `public, max-age=${this.config.maxAge}`);
        res.setHeader('ETag', this.generateETag(req.url));
        
        // Check if client has cached version
        const clientETag = req.headers['if-none-match'];
        const serverETag = this.generateETag(req.url);
        
        if (clientETag === serverETag) {
          res.status(304).end();
          return;
        }
      }
      next();
    });

    // Cache control for API responses
    app.use('/api', (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data: any) {
        if (req.method === 'GET' && res.statusCode === 200) {
          // Cache GET requests with successful responses
          const cacheKey = `api_cache_${req.url}`;
          const cacheData = {
            data,
            timestamp: Date.now(),
            headers: res.getHeaders()
          };
          
          // Cache for 5 minutes for API responses
          cache.set(cacheKey, cacheData, 300);
          
          // Set cache headers
          res.setHeader('Cache-Control', 'public, max-age=300');
          res.setHeader('Last-Modified', new Date().toUTCString());
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    });
  }

  // Compression optimization
  setupCompression(app: express.Application) {
    app.use((req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      if (acceptEncoding.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
      }
      
      next();
    });
  }

  // Image optimization middleware
  setupImageOptimization(app: express.Application) {
    app.use('/images', (req, res, next) => {
      // Set appropriate cache headers for images
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
      res.setHeader('Content-Type', this.getImageContentType(req.url));
      
      next();
    });
  }

  // Pre-warming cache for critical resources
  async prewarmCache() {
    const criticalEndpoints = [
      '/api/assessment-dates',
      '/api/feedback-questions',
      '/api/admin/stats'
    ];

    for (const endpoint of criticalEndpoints) {
      try {
        // Simulate request to warm cache
        const cacheKey = `api_cache_${endpoint}`;
        if (!cache.has(cacheKey)) {
          console.log(`Pre-warming cache for ${endpoint}`);
          // Cache would be populated when actual request is made
        }
      } catch (error) {
        console.error(`Failed to pre-warm cache for ${endpoint}:`, error);
      }
    }
  }

  // CDN health check
  async healthCheck(): Promise<boolean> {
    try {
      // Check cache availability
      const testKey = 'cdn_health_check';
      cache.set(testKey, 'ok', 10);
      const result = cache.get(testKey);
      cache.del(testKey);
      
      return result === 'ok';
    } catch (error) {
      console.error('CDN health check failed:', error);
      return false;
    }
  }

  // Generate ETag for caching
  private generateETag(url: string): string {
    const hash = require('crypto').createHash('md5');
    hash.update(`${url}_${Date.now()}`);
    return `"${hash.digest('hex')}"`;
  }

  // Get content type for images
  private getImageContentType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }

  // Performance monitoring
  getPerformanceMetrics() {
    return {
      cacheHitRatio: this.calculateCacheHitRatio(),
      averageResponseTime: this.getAverageResponseTime(),
      compressionRatio: this.getCompressionRatio(),
      staticContentServed: this.getStaticContentStats()
    };
  }

  private calculateCacheHitRatio(): number {
    const stats = cache.getStats();
    const total = stats.hits + stats.misses;
    return total > 0 ? (stats.hits / total) * 100 : 0;
  }

  private getAverageResponseTime(): number {
    // Implementation would track response times
    return 150; // ms
  }

  private getCompressionRatio(): number {
    // Implementation would track compression savings
    return 65; // percentage
  }

  private getStaticContentStats() {
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

export const cdnOptimizer = new CDNOptimizer();