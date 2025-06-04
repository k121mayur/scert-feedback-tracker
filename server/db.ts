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
  max: 100, // Maximum pool size for high concurrency
  min: 20,  // Minimum connections to keep alive
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
  maxUses: 7500, // Connection lifecycle
  keepAlive: true,
});

export const db = drizzle({ client: pool, schema });