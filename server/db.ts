import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool for extreme scale (8000 max connections)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 8000, // Maximum connections for extreme scale deployment
  min: 100,  // Higher minimum pool for immediate availability
  idleTimeoutMillis: 15000, // Faster idle timeout for connection recycling
  connectionTimeoutMillis: 3000, // Quick timeout for rapid failover
  allowExitOnIdle: true,
  maxUses: 15000, // Extended connection lifecycle for efficiency
  keepAlive: true,
  // Query timeout optimizations for extreme concurrency
  statement_timeout: 8000, // 8 second query timeout
  query_timeout: 6000, // 6 second individual query timeout
  application_name: 'maharashtra_teacher_assessment_8k_pool',
});

export const db = drizzle({ client: pool, schema });

// Add pool error handling for 40K user scalability
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', () => {
  console.log('Database pool connected');
});

// Health check function for circuit breaker
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Performance monitoring for extreme scale (8K max connections)
export async function getConnectionStats() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: 8000,
    utilizationPercent: Math.round((pool.totalCount / 8000) * 100),
    minConnections: 100,
    connectionHealth: pool.totalCount > 0 ? 'healthy' : 'warning'
  };
}

// Query performance analyzer
export async function analyzeQueryPerformance() {
  try {
    const result = await pool.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE query NOT LIKE '%pg_stat_statements%'
      ORDER BY mean_time DESC 
      LIMIT 10
    `);
    return result.rows;
  } catch (error) {
    console.log('Query performance analysis unavailable (pg_stat_statements not enabled)');
    return [];
  }
}

// Index usage monitoring
export async function getIndexUsageStats() {
  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE idx_scan > 0
      ORDER BY idx_scan DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Index usage stats error:', error);
    return [];
  }
}