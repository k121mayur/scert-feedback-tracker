/**
 * AWS RDS Fallback Database System for Replit Hosting
 * Distributes database load between primary Replit DB and AWS RDS for 40K users
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

interface DatabaseConfig {
  primary: {
    url: string;
    maxConnections: number;
  };
  fallback: {
    url?: string;
    maxConnections: number;
    enabled: boolean;
  };
  loadBalancing: {
    writeThreshold: number;
    readDistribution: number; // 0-100, percentage for primary DB
    failoverDelay: number;
  };
}

interface DatabaseMetrics {
  primaryConnections: number;
  fallbackConnections: number;
  primaryLatency: number;
  fallbackLatency: number;
  failoverCount: number;
  readQueries: number;
  writeQueries: number;
  totalQueries: number;
}

export class AWSRDSFallbackManager {
  private primaryPool: Pool;
  private fallbackPool: Pool | null = null;
  private primaryDb: any;
  private fallbackDb: any;
  private config: DatabaseConfig;
  private metrics: DatabaseMetrics;
  private isPrimaryHealthy = true;
  private isFallbackHealthy = false;
  private lastHealthCheck = Date.now();
  private healthCheckInterval = 30000; // 30 seconds

  constructor() {
    this.config = {
      primary: {
        url: process.env.DATABASE_URL!,
        maxConnections: 300 // Conservative for Replit
      },
      fallback: {
        url: process.env.AWS_RDS_URL,
        maxConnections: 500, // Higher for AWS RDS
        enabled: !!process.env.AWS_RDS_URL
      },
      loadBalancing: {
        writeThreshold: 1000, // Switch writes to RDS after 1000 concurrent writes
        readDistribution: 70, // 70% reads on primary, 30% on fallback
        failoverDelay: 5000 // 5 second delay before failover
      }
    };

    this.metrics = {
      primaryConnections: 0,
      fallbackConnections: 0,
      primaryLatency: 0,
      fallbackLatency: 0,
      failoverCount: 0,
      readQueries: 0,
      writeQueries: 0,
      totalQueries: 0
    };

    this.initializeDatabases();
    this.startHealthMonitoring();
  }

  private async initializeDatabases(): Promise<void> {
    try {
      // Initialize primary database (Replit)
      this.primaryPool = new Pool({ 
        connectionString: this.config.primary.url,
        max: this.config.primary.maxConnections,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000
      });
      
      this.primaryDb = drizzle({ client: this.primaryPool, schema });
      console.log('Primary database (Replit) initialized');

      // Initialize fallback database (AWS RDS) if configured
      if (this.config.fallback.enabled && this.config.fallback.url) {
        this.fallbackPool = new Pool({
          connectionString: this.config.fallback.url,
          max: this.config.fallback.maxConnections,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 10000
        });
        
        this.fallbackDb = drizzle({ client: this.fallbackPool, schema });
        this.isFallbackHealthy = await this.testConnection(this.fallbackDb);
        
        if (this.isFallbackHealthy) {
          console.log('AWS RDS fallback database initialized');
        } else {
          console.warn('AWS RDS fallback database connection failed');
        }
      }

    } catch (error) {
      console.error('Database initialization error:', error);
      this.isPrimaryHealthy = false;
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthChecks();
      this.optimizeLoadDistribution();
    }, this.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const startTime = Date.now();

    // Check primary database health
    try {
      const primaryStart = Date.now();
      await this.primaryDb.execute('SELECT 1');
      this.metrics.primaryLatency = Date.now() - primaryStart;
      this.isPrimaryHealthy = this.metrics.primaryLatency < 1000; // Healthy if < 1s
    } catch (error) {
      console.error('Primary database health check failed:', error);
      this.isPrimaryHealthy = false;
      this.metrics.failoverCount++;
    }

    // Check fallback database health
    if (this.fallbackDb) {
      try {
        const fallbackStart = Date.now();
        await this.fallbackDb.execute('SELECT 1');
        this.metrics.fallbackLatency = Date.now() - fallbackStart;
        this.isFallbackHealthy = this.metrics.fallbackLatency < 2000; // More lenient for AWS
      } catch (error) {
        console.error('Fallback database health check failed:', error);
        this.isFallbackHealthy = false;
      }
    }

    this.lastHealthCheck = Date.now();
  }

  private async testConnection(db: any): Promise<boolean> {
    try {
      await db.execute('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  private optimizeLoadDistribution(): void {
    const currentLoad = this.metrics.totalQueries;
    
    // Adjust read distribution based on load and health
    if (currentLoad > 5000 && this.isFallbackHealthy) {
      this.config.loadBalancing.readDistribution = 50; // 50/50 split under high load
    } else if (this.isPrimaryHealthy) {
      this.config.loadBalancing.readDistribution = 70; // Prefer primary when healthy
    } else if (this.isFallbackHealthy) {
      this.config.loadBalancing.readDistribution = 20; // Fallback to AWS RDS
    }
  }

  private shouldUseFallbackForReads(): boolean {
    if (!this.isFallbackHealthy) return false;
    if (!this.isPrimaryHealthy) return true;
    
    const random = Math.random() * 100;
    return random > this.config.loadBalancing.readDistribution;
  }

  private shouldUseFallbackForWrites(): boolean {
    if (!this.isFallbackHealthy) return false;
    if (!this.isPrimaryHealthy) return true;
    
    return this.metrics.writeQueries > this.config.loadBalancing.writeThreshold;
  }

  async executeRead(query: any): Promise<any> {
    this.metrics.totalQueries++;
    this.metrics.readQueries++;

    const useRDS = this.shouldUseFallbackForReads();
    
    try {
      if (useRDS && this.fallbackDb) {
        this.metrics.fallbackConnections++;
        return await this.fallbackDb.execute(query);
      } else {
        this.metrics.primaryConnections++;
        return await this.primaryDb.execute(query);
      }
    } catch (error) {
      console.error('Read query failed:', error);
      
      // Fallback logic
      if (!useRDS && this.fallbackDb && this.isFallbackHealthy) {
        console.log('Falling back to AWS RDS for read');
        this.metrics.failoverCount++;
        return await this.fallbackDb.execute(query);
      } else if (useRDS && this.isPrimaryHealthy) {
        console.log('Falling back to primary DB for read');
        this.metrics.failoverCount++;
        return await this.primaryDb.execute(query);
      }
      
      throw error;
    }
  }

  async executeWrite(query: any): Promise<any> {
    this.metrics.totalQueries++;
    this.metrics.writeQueries++;

    const useRDS = this.shouldUseFallbackForWrites();
    
    try {
      if (useRDS && this.fallbackDb) {
        this.metrics.fallbackConnections++;
        const result = await this.fallbackDb.execute(query);
        
        // Replicate to primary if possible (eventual consistency)
        if (this.isPrimaryHealthy) {
          try {
            await this.primaryDb.execute(query);
          } catch (syncError) {
            console.warn('Primary DB sync failed:', syncError);
          }
        }
        
        return result;
      } else {
        this.metrics.primaryConnections++;
        const result = await this.primaryDb.execute(query);
        
        // Replicate to fallback if possible
        if (this.isFallbackHealthy && this.fallbackDb) {
          try {
            await this.fallbackDb.execute(query);
          } catch (syncError) {
            console.warn('Fallback DB sync failed:', syncError);
          }
        }
        
        return result;
      }
    } catch (error) {
      console.error('Write query failed:', error);
      
      // Fallback logic for writes
      if (!useRDS && this.fallbackDb && this.isFallbackHealthy) {
        console.log('Falling back to AWS RDS for write');
        this.metrics.failoverCount++;
        return await this.fallbackDb.execute(query);
      } else if (useRDS && this.isPrimaryHealthy) {
        console.log('Falling back to primary DB for write');
        this.metrics.failoverCount++;
        return await this.primaryDb.execute(query);
      }
      
      throw error;
    }
  }

  // High-level database operations with automatic load balancing
  getPrimaryDB() {
    return this.primaryDb;
  }

  getFallbackDB() {
    return this.fallbackDb;
  }

  getOptimalDB(operationType: 'read' | 'write') {
    if (operationType === 'read') {
      if (this.shouldUseFallbackForReads() && this.fallbackDb) {
        return this.fallbackDb;
      }
      return this.primaryDb;
    } else {
      if (this.shouldUseFallbackForWrites() && this.fallbackDb) {
        return this.fallbackDb;
      }
      return this.primaryDb;
    }
  }

  getConnectionStats() {
    return {
      primary: {
        healthy: this.isPrimaryHealthy,
        connections: this.metrics.primaryConnections,
        latency: this.metrics.primaryLatency,
        totalConnections: this.primaryPool ? this.primaryPool.totalCount : 0,
        idleConnections: this.primaryPool ? this.primaryPool.idleCount : 0
      },
      fallback: {
        healthy: this.isFallbackHealthy,
        connections: this.metrics.fallbackConnections,
        latency: this.metrics.fallbackLatency,
        totalConnections: this.fallbackPool ? this.fallbackPool.totalCount : 0,
        idleConnections: this.fallbackPool ? this.fallbackPool.idleCount : 0,
        enabled: this.config.fallback.enabled
      },
      distribution: {
        readDistribution: this.config.loadBalancing.readDistribution,
        writeThreshold: this.config.loadBalancing.writeThreshold,
        currentReadQueries: this.metrics.readQueries,
        currentWriteQueries: this.metrics.writeQueries
      },
      metrics: this.metrics,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  async syncDatabases(): Promise<void> {
    if (!this.isFallbackHealthy || !this.isPrimaryHealthy) {
      console.log('Cannot sync - one or both databases are unhealthy');
      return;
    }

    try {
      console.log('Starting database synchronization...');
      
      // This is a simplified sync - in production you'd want more sophisticated replication
      const tables = ['teachers', 'questions', 'feedback', 'examResults', 'districts', 'batches'];
      
      for (const table of tables) {
        try {
          // Get recent changes from primary
          const recentData = await this.primaryDb.execute(
            `SELECT * FROM ${table} WHERE updated_at > NOW() - INTERVAL '1 hour'`
          );
          
          // Upsert to fallback (simplified - real implementation would need conflict resolution)
          if (recentData.length > 0) {
            console.log(`Syncing ${recentData.length} records from ${table}`);
            // Implementation would depend on your specific schema and requirements
          }
        } catch (error) {
          console.error(`Sync failed for table ${table}:`, error);
        }
      }
      
      console.log('Database synchronization completed');
    } catch (error) {
      console.error('Database synchronization failed:', error);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.primaryPool) {
        await this.primaryPool.end();
      }
      
      if (this.fallbackPool) {
        await this.fallbackPool.end();
      }
      
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }
}

// Global database manager instance
export const awsRDSFallback = new AWSRDSFallbackManager();