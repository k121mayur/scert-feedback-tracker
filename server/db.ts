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
  max: 2000, // Significantly increased for 40K concurrent users
  min: 500,  // Higher minimum to handle burst traffic
  idleTimeoutMillis: 10000, // Shorter idle timeout for faster connection recycling
  connectionTimeoutMillis: 2000, // Faster timeout for better error handling
  allowExitOnIdle: false,
  maxUses: 10000, // Increased connection lifecycle
  keepAlive: true,
  // Additional optimization for high-load scenarios
  statement_timeout: 5000, // 5 second query timeout
  query_timeout: 5000,
  application_name: 'teacher_assessment_app',
});

export const db = drizzle({ client: pool, schema });