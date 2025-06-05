import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@shared/schema';

interface DatabaseCluster {
  primary: ReturnType<typeof drizzle>;
  readReplicas: ReturnType<typeof drizzle>[];
  getReadDatabase(): ReturnType<typeof drizzle>;
  getWriteDatabase(): ReturnType<typeof drizzle>;
  healthCheck(): Promise<boolean>;
}

class ProductionDatabaseCluster implements DatabaseCluster {
  public primary: ReturnType<typeof drizzle>;
  public readReplicas: ReturnType<typeof drizzle>[] = [];
  private replicaIndex = 0;

  constructor() {
    // Primary database for writes
    const primaryPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4000, // 50% of total for writes
      min: 50,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 3000,
      application_name: 'maharashtra_primary_db'
    });

    this.primary = drizzle({ client: primaryPool, schema });

    // Read replicas for query distribution
    this.setupReadReplicas();
  }

  private setupReadReplicas() {
    // Replica 1: Assessment queries
    const assessmentReplicaPool = new Pool({
      connectionString: process.env.DATABASE_URL, // Same URL for now, can be different replica
      max: 2000,
      min: 25,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
      application_name: 'maharashtra_assessment_replica'
    });

    // Replica 2: Teacher data queries
    const teacherReplicaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2000,
      min: 25,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
      application_name: 'maharashtra_teacher_replica'
    });

    this.readReplicas = [
      drizzle({ client: assessmentReplicaPool, schema }),
      drizzle({ client: teacherReplicaPool, schema })
    ];
  }

  getReadDatabase(): ReturnType<typeof drizzle> {
    // Round-robin load balancing
    const replica = this.readReplicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.readReplicas.length;
    return replica;
  }

  getWriteDatabase(): ReturnType<typeof drizzle> {
    return this.primary;
  }

  // Intelligent database selection based on query type
  getOptimalDatabase(operation: 'teacher_lookup' | 'questions' | 'assessment' | 'write'): ReturnType<typeof drizzle> {
    switch (operation) {
      case 'write':
        return this.primary;
      case 'teacher_lookup':
        return this.readReplicas[1] || this.primary; // Teacher replica
      case 'questions':
      case 'assessment':
        return this.readReplicas[0] || this.primary; // Assessment replica
      default:
        return this.getReadDatabase();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check primary
      await this.primary.execute('SELECT 1');
      
      // Check all replicas
      for (const replica of this.readReplicas) {
        await replica.execute('SELECT 1');
      }
      
      return true;
    } catch (error) {
      console.error('Database cluster health check failed:', error);
      return false;
    }
  }

  getClusterStats() {
    return {
      primaryConnections: 4000,
      replicaConnections: 4000,
      totalConnections: 8000,
      activeReplicas: this.readReplicas.length,
      loadBalancing: 'round-robin'
    };
  }
}

export const dbCluster = new ProductionDatabaseCluster();

// Optimized database access functions for 30K users
export const getTeacherDatabase = () => dbCluster.getOptimalDatabase('teacher_lookup');
export const getQuestionsDatabase = () => dbCluster.getOptimalDatabase('questions');
export const getAssessmentDatabase = () => dbCluster.getOptimalDatabase('assessment');
export const getWriteDatabase = () => dbCluster.getOptimalDatabase('write');