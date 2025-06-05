import { EventEmitter } from 'events';

// Redis-compatible in-memory implementation for environments where Redis isn't available
class MemoryRedis extends EventEmitter {
  private store: Map<string, { value: any; expiry?: number }> = new Map();
  private isConnected = true;

  // Basic Redis commands
  async set(key: string, value: any, options?: { EX?: number }): Promise<string> {
    const expiry = options?.EX ? Date.now() + (options.EX * 1000) : undefined;
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    if (pattern === '*') {
      return Array.from(this.store.keys());
    }
    // Simple pattern matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    
    item.expiry = Date.now() + (seconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expiry) return -1;
    
    const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // List operations for queue functionality
  async lpush(key: string, ...values: any[]): Promise<number> {
    const item = this.store.get(key) || { value: [] };
    if (!Array.isArray(item.value)) item.value = [];
    
    item.value.unshift(...values);
    this.store.set(key, item);
    return item.value.length;
  }

  async rpop(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item || !Array.isArray(item.value) || item.value.length === 0) {
      return null;
    }
    
    return item.value.pop();
  }

  async llen(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item || !Array.isArray(item.value)) return 0;
    return item.value.length;
  }

  // Hash operations
  async hset(key: string, field: string, value: any): Promise<number> {
    const item = this.store.get(key) || { value: {} };
    if (typeof item.value !== 'object' || Array.isArray(item.value)) {
      item.value = {};
    }
    
    const isNew = !(field in item.value);
    item.value[field] = value;
    this.store.set(key, item);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<any> {
    const item = this.store.get(key);
    if (!item || typeof item.value !== 'object' || Array.isArray(item.value)) {
      return null;
    }
    return item.value[field] || null;
  }

  async hgetall(key: string): Promise<Record<string, any>> {
    const item = this.store.get(key);
    if (!item || typeof item.value !== 'object' || Array.isArray(item.value)) {
      return {};
    }
    return { ...item.value };
  }

  // Connection status
  async ping(): Promise<string> {
    return 'PONG';
  }

  // Cleanup expired keys
  private cleanupExpired() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiry && now > item.expiry) {
        this.store.delete(key);
      }
    }
  }

  // Stats for monitoring
  getStats() {
    this.cleanupExpired();
    return {
      totalKeys: this.store.size,
      memoryUsage: JSON.stringify(Array.from(this.store.entries())).length,
      connected: this.isConnected
    };
  }

  // Clear all data
  async flushall(): Promise<string> {
    this.store.clear();
    return 'OK';
  }
}

// Export singleton instance
export const redisClient = new MemoryRedis();

// Cleanup expired keys every 60 seconds
setInterval(() => {
  (redisClient as any).cleanupExpired();
}, 60000);