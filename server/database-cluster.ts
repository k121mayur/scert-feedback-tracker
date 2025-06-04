import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for optimal performance
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
neonConfig.fetchConnectionCache = true;

// Database cluster configuration
interface DatabaseCluster {
  primary: Pool;
  readReplicas: Pool[];
  getReadConnection(): Pool;
  getWriteConnection(): Pool;
  healthCheck(): Promise<boolean>;
}

class ScalableDatabase implements DatabaseCluster {
  public primary: Pool;
  public readReplicas: Pool[] = [];
  private currentReplicaIndex = 0;

  constructor() {
    // Primary database for writes
    this.primary = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 50, // Distributed across autoscale machines
      min: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      maxUses: 7500,
      keepAlive: true,
      statement_timeout: 15000,
      query_timeout: 15000,
      application_name: 'teacher_assessment_primary',
    });

    // Initialize read replicas if available
    this.initializeReadReplicas();

    // Setup connection monitoring
    this.setupConnectionMonitoring();
  }

  private initializeReadReplicas() {
    // Read Replica 1 (Mumbai region)
    if (process.env.READ_REPLICA_1_URL) {
      const replica1 = new Pool({
        connectionString: process.env.READ_REPLICA_1_URL,
        max: 40,
        min: 8,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
        maxUses: 7500,
        keepAlive: true,
        statement_timeout: 15000,
        query_timeout: 15000,
        application_name: 'teacher_assessment_replica1',
      });
      this.readReplicas.push(replica1);
      console.log('Read Replica 1 (Mumbai) initialized');
    }

    // Read Replica 2 (Pune region)
    if (process.env.READ_REPLICA_2_URL) {
      const replica2 = new Pool({
        connectionString: process.env.READ_REPLICA_2_URL,
        max: 40,
        min: 8,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
        maxUses: 7500,
        keepAlive: true,
        statement_timeout: 15000,
        query_timeout: 15000,
        application_name: 'teacher_assessment_replica2',
      });
      this.readReplicas.push(replica2);
      console.log('Read Replica 2 (Pune) initialized');
    }

    // Read Replica 3 (Backup)
    if (process.env.READ_REPLICA_3_URL) {
      const replica3 = new Pool({
        connectionString: process.env.READ_REPLICA_3_URL,
        max: 30,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
        maxUses: 7500,
        keepAlive: true,
        statement_timeout: 15000,
        query_timeout: 15000,
        application_name: 'teacher_assessment_replica3',
      });
      this.readReplicas.push(replica3);
      console.log('Read Replica 3 (Backup) initialized');
    }

    if (this.readReplicas.length === 0) {
      console.log('No read replicas configured, using primary for all operations');
    } else {
      console.log(`Database cluster initialized with ${this.readReplicas.length} read replicas`);
    }
  }

  private setupConnectionMonitoring() {
    // Monitor primary database
    this.primary.on('error', (err) => {
      console.error('Primary database pool error:', err);
    });

    this.primary.on('connect', () => {
      console.log('Primary database pool connected');
    });

    // Monitor read replicas
    this.readReplicas.forEach((replica, index) => {
      replica.on('error', (err) => {
        console.error(`Read replica ${index + 1} pool error:`, err);
      });

      replica.on('connect', () => {
        console.log(`Read replica ${index + 1} pool connected`);
      });
    });
  }

  // Get read connection with load balancing
  getReadConnection(): Pool {
    if (this.readReplicas.length === 0) {
      return this.primary;
    }

    // Round-robin load balancing
    const replica = this.readReplicas[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.readReplicas.length;
    
    return replica;
  }

  // Get write connection (always primary)
  getWriteConnection(): Pool {
    return this.primary;
  }

  // Geographic-based replica selection
  getReadConnectionByRegion(district?: string): Pool {
    if (this.readReplicas.length === 0) {
      return this.primary;
    }

    // Mumbai region districts
    const mumbaiDistricts = ['Mumbai', 'Thane', 'Raigad', 'Mumbai Suburban'];
    // Pune region districts  
    const puneDistricts = ['Pune', 'Satara', 'Sangli', 'Kolhapur'];

    if (district && mumbaiDistricts.includes(district) && this.readReplicas[0]) {
      return this.readReplicas[0]; // Mumbai replica
    }

    if (district && puneDistricts.includes(district) && this.readReplicas[1]) {
      return this.readReplicas[1]; // Pune replica
    }

    // Default to round-robin
    return this.getReadConnection();
  }

  // Health check for all connections
  async healthCheck(): Promise<boolean> {
    try {
      // Check primary
      await this.primary.query('SELECT 1');
      
      // Check replicas
      const replicaChecks = this.readReplicas.map(async (replica) => {
        try {
          await replica.query('SELECT 1');
          return true;
        } catch (error) {
          console.error('Replica health check failed:', error);
          return false;
        }
      });

      const replicaResults = await Promise.all(replicaChecks);
      const healthyReplicas = replicaResults.filter(result => result).length;
      
      console.log(`Database cluster health: Primary OK, ${healthyReplicas}/${this.readReplicas.length} replicas healthy`);
      return true;
    } catch (error) {
      console.error('Primary database health check failed:', error);
      return false;
    }
  }

  // Get cluster statistics
  getClusterStats() {
    return {
      primary: {
        totalCount: this.primary.totalCount,
        idleCount: this.primary.idleCount,
        waitingCount: this.primary.waitingCount,
      },
      replicas: this.readReplicas.map((replica, index) => ({
        index: index + 1,
        totalCount: replica.totalCount,
        idleCount: replica.idleCount,
        waitingCount: replica.waitingCount,
      })),
      totalReplicas: this.readReplicas.length,
    };
  }
}

// Initialize database cluster
export const dbCluster = new ScalableDatabase();

// Create Drizzle instances for different operations
export const primaryDb = drizzle({ client: dbCluster.primary, schema });
export const readDb = drizzle({ client: dbCluster.getReadConnection(), schema });

// Helper function to get appropriate database instance
export const getDatabase = (operation: 'read' | 'write', district?: string) => {
  if (operation === 'write') {
    return drizzle({ client: dbCluster.getWriteConnection(), schema });
  } else {
    return drizzle({ client: dbCluster.getReadConnectionByRegion(district), schema });
  }
};

// Connection pool health monitoring
setInterval(async () => {
  await dbCluster.healthCheck();
}, 60000); // Check every minute

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down database cluster...');
  await dbCluster.primary.end();
  await Promise.all(dbCluster.readReplicas.map(replica => replica.end()));
});

