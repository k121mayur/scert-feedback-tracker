import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for autoscale performance
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Autoscale-optimized connection pool (distributed across 3 machines)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 30, // 30 per machine × 3 machines = 90 total connections
  min: 5,  // Keep minimum connections for startup
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
  maxUses: 7500,
  keepAlive: true,
  statement_timeout: 15000,
  query_timeout: 15000,
  application_name: 'teacher_assessment_autoscale',
});

// Enhanced pool monitoring for autoscale
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', () => {
  console.log('Database pool connected');
});

export const db = drizzle({ client: pool, schema });

// Performance monitoring for autoscale machines
export const getConnectionStats = () => ({
  totalConnections: pool.totalCount,
  idleConnections: pool.idleCount,
  waitingConnections: pool.waitingCount,
  machineId: process.env.REPL_ID || 'unknown',
  timestamp: new Date().toISOString()
});

// Health check optimized for autoscale
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown for autoscale
process.on('SIGTERM', async () => {
  console.log('Shutting down database connections...');
  await pool.end();
});