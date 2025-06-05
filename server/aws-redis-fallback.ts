/**
 * AWS Redis Fallback System for Replit Hosting
 * Distributes load between local memory and AWS Redis for 40K concurrent users
 */

import Redis from 'ioredis';
import { NodeCache } from 'node-cache';

interface FallbackConfig {
  useAWSRedis: boolean;
  maxLocalCacheSize: number;
  redisConnectionString?: string;
  fallbackThreshold: number;
  healthCheckInterval: number;
}

interface CacheEntry {
  value: any;
  timestamp: number;
  source: 'local' | 'redis';
}

export class AWSRedisFallbackManager {
  private localCache: NodeCache;
  private redisClient: Redis | null = null;
  private config: FallbackConfig;
  private isRedisHealthy = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private loadMetrics = {
    localHits: 0,
    redisHits: 0,
    totalRequests: 0,
    failoverCount: 0
  };

  constructor() {
    this.config = {
      useAWSRedis: process.env.AWS_REDIS_ENABLED === 'true',
      maxLocalCacheSize: 10000, // Limit local cache for memory management
      redisConnectionString: process.env.AWS_REDIS_URL,
      fallbackThreshold: 1000, // Switch to Redis after 1000 concurrent requests
      healthCheckInterval: 30000 // 30 seconds
    };

    this.localCache = new NodeCache({
      stdTTL: 600, // 10 minutes default TTL
      maxKeys: this.config.maxLocalCacheSize,
      deleteOnExpire: true,
      checkperiod: 120 // Check for expired keys every 2 minutes
    });

    this.initializeRedisConnection();
    this.startHealthMonitoring();
  }

  private async initializeRedisConnection(): Promise<void> {
    if (!this.config.useAWSRedis || !this.config.redisConnectionString) {
      console.log('AWS Redis not configured - using local cache only');
      return;
    }

    try {
      this.redisClient = new Redis(this.config.redisConnectionString, {
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      });

      this.redisClient.on('connect', () => {
        console.log('AWS Redis connected successfully');
        this.isRedisHealthy = true;
        this.connectionAttempts = 0;
      });

      this.redisClient.on('error', (error) => {
        console.error('AWS Redis connection error:', error.message);
        this.isRedisHealthy = false;
        this.connectionAttempts++;
      });

      this.redisClient.on('close', () => {
        console.log('AWS Redis connection closed');
        this.isRedisHealthy = false;
      });

      // Test connection
      await this.redisClient.connect();
      await this.redisClient.ping();
      
    } catch (error) {
      console.error('Failed to initialize AWS Redis:', error);
      this.isRedisHealthy = false;
      this.connectionAttempts++;
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.checkRedisHealth();
      this.optimizeLoadDistribution();
    }, this.config.healthCheckInterval);
  }

  private async checkRedisHealth(): Promise<void> {
    if (!this.redisClient) return;

    try {
      const start = Date.now();
      await this.redisClient.ping();
      const latency = Date.now() - start;
      
      this.isRedisHealthy = latency < 100; // Consider healthy if latency < 100ms
      
      if (!this.isRedisHealthy && this.connectionAttempts < this.maxConnectionAttempts) {
        await this.reconnectRedis();
      }
    } catch (error) {
      this.isRedisHealthy = false;
      console.error('Redis health check failed:', error);
    }
  }

  private async reconnectRedis(): Promise<void> {
    try {
      this.connectionAttempts++;
      await this.redisClient?.disconnect();
      await this.initializeRedisConnection();
    } catch (error) {
      console.error('Redis reconnection failed:', error);
    }
  }

  private shouldUseRedis(): boolean {
    return (
      this.config.useAWSRedis &&
      this.isRedisHealthy &&
      this.loadMetrics.totalRequests > this.config.fallbackThreshold
    );
  }

  private optimizeLoadDistribution(): void {
    const currentLoad = this.getCurrentLoad();
    
    // If load is high and Redis is available, prefer Redis
    if (currentLoad > 5000 && this.isRedisHealthy) {
      this.config.fallbackThreshold = 500; // Lower threshold under high load
    } else {
      this.config.fallbackThreshold = 1000; // Normal threshold
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    this.loadMetrics.totalRequests++;
    
    const serializedValue = JSON.stringify({
      value,
      timestamp: Date.now(),
      source: this.shouldUseRedis() ? 'redis' : 'local'
    });

    try {
      if (this.shouldUseRedis()) {
        await this.redisClient!.setex(key, ttl || 600, serializedValue);
        this.loadMetrics.redisHits++;
        
        // Also store in local cache for faster access
        this.localCache.set(key, value, ttl || 600);
        return true;
      } else {
        // Use local cache
        this.localCache.set(key, value, ttl || 600);
        this.loadMetrics.localHits++;
        return true;
      }
    } catch (error) {
      console.error('Cache set error:', error);
      // Fallback to local cache
      this.localCache.set(key, value, ttl || 600);
      this.loadMetrics.failoverCount++;
      return true;
    }
  }

  async get(key: string): Promise<any> {
    this.loadMetrics.totalRequests++;

    try {
      // Always check local cache first for speed
      const localValue = this.localCache.get(key);
      if (localValue !== undefined) {
        this.loadMetrics.localHits++;
        return localValue;
      }

      // If not in local cache and Redis is available, check Redis
      if (this.shouldUseRedis() && this.redisClient) {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          const parsed: CacheEntry = JSON.parse(redisValue);
          this.loadMetrics.redisHits++;
          
          // Store in local cache for future fast access
          this.localCache.set(key, parsed.value, 300); // 5 min local cache
          return parsed.value;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Cache get error:', error);
      // Fallback to local cache only
      this.loadMetrics.failoverCount++;
      return this.localCache.get(key);
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      // Delete from both caches
      this.localCache.del(key);
      
      if (this.isRedisHealthy && this.redisClient) {
        await this.redisClient.del(key);
      }
      
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async mget(keys: string[]): Promise<(any | null)[]> {
    const results: (any | null)[] = new Array(keys.length).fill(null);
    const redisKeys: string[] = [];
    const redisIndices: number[] = [];

    // Check local cache first
    for (let i = 0; i < keys.length; i++) {
      const localValue = this.localCache.get(keys[i]);
      if (localValue !== undefined) {
        results[i] = localValue;
        this.loadMetrics.localHits++;
      } else {
        redisKeys.push(keys[i]);
        redisIndices.push(i);
      }
    }

    // Check Redis for remaining keys
    if (redisKeys.length > 0 && this.shouldUseRedis() && this.redisClient) {
      try {
        const redisValues = await this.redisClient.mget(...redisKeys);
        
        for (let i = 0; i < redisValues.length; i++) {
          if (redisValues[i]) {
            const parsed: CacheEntry = JSON.parse(redisValues[i]!);
            const originalIndex = redisIndices[i];
            results[originalIndex] = parsed.value;
            this.loadMetrics.redisHits++;
            
            // Cache locally for future access
            this.localCache.set(redisKeys[i], parsed.value, 300);
          }
        }
      } catch (error) {
        console.error('Redis mget error:', error);
        this.loadMetrics.failoverCount++;
      }
    }

    return results;
  }

  getCurrentLoad(): number {
    return this.loadMetrics.totalRequests;
  }

  getLoadMetrics() {
    const totalHits = this.loadMetrics.localHits + this.loadMetrics.redisHits;
    const localHitRatio = totalHits > 0 ? (this.loadMetrics.localHits / totalHits) * 100 : 0;
    const redisHitRatio = totalHits > 0 ? (this.loadMetrics.redisHits / totalHits) * 100 : 0;

    return {
      ...this.loadMetrics,
      localHitRatio: Math.round(localHitRatio * 100) / 100,
      redisHitRatio: Math.round(redisHitRatio * 100) / 100,
      isRedisHealthy: this.isRedisHealthy,
      connectionAttempts: this.connectionAttempts,
      currentStrategy: this.shouldUseRedis() ? 'redis-primary' : 'local-primary'
    };
  }

  async preloadCriticalData(): Promise<void> {
    // Preload frequently accessed data for 40K user scenario
    const criticalKeys = [
      'questions:popular',
      'districts:list',
      'batches:active',
      'topics:all'
    ];

    for (const key of criticalKeys) {
      try {
        await this.get(key); // This will cache it locally if found in Redis
      } catch (error) {
        console.error(`Failed to preload ${key}:`, error);
      }
    }
  }

  async flush(): Promise<void> {
    try {
      this.localCache.flushAll();
      
      if (this.isRedisHealthy && this.redisClient) {
        await this.redisClient.flushall();
      }
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  async close(): Promise<void> {
    try {
      this.localCache.close();
      
      if (this.redisClient) {
        await this.redisClient.quit();
      }
    } catch (error) {
      console.error('Cache close error:', error);
    }
  }
}

// Global instance for the application
export const awsRedisFallback = new AWSRedisFallbackManager();