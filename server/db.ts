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

// Optimized connection pool for high-load (40k concurrent users)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 100, // Reduced to prevent overwhelming Neon
  min: 20,  // Reasonable minimum for startup
  idleTimeoutMillis: 30000, // Longer idle timeout for stability
  connectionTimeoutMillis: 10000, // Increased timeout for reliability
  allowExitOnIdle: true,
  maxUses: 7500, // Connection lifecycle
  keepAlive: true,
  // Query timeout optimizations
  statement_timeout: 15000, // 15 second query timeout
  query_timeout: 15000, // Match statement timeout
  application_name: 'teacher_assessment_scalable',
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