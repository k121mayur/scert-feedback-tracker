import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@shared/schema';

interface ShardConfig {
  shardId: string;
  connectionString: string;
  districts: string[];
  capacity: number;
  isActive: boolean;
}

interface ShardingStrategy {
  type: 'district' | 'mobile_range' | 'hash';
  configuration: any;
}

export class DatabaseShardingManager {
  private shards: Map<string, ReturnType<typeof drizzle>> = new Map();
  private shardConfigs: ShardConfig[] = [];
  private strategy: ShardingStrategy;

  constructor() {
    this.strategy = {
      type: 'district',
      configuration: {
        // Maharashtra district-based sharding for 50K+ users
        shardMapping: {
          'shard_west': ['Mumbai', 'Pune', 'Nashik', 'Aurangabad', 'Kolhapur', 'Sangli', 'Satara', 'Solapur', 'Raigad'],
          'shard_central': ['Nagpur', 'Amravati', 'Akola', 'Buldhana', 'Washim', 'Yavatmal', 'Wardha', 'Bhandara', 'Gondia'],
          'shard_north': ['Dhule', 'Jalgaon', 'Nandurbar', 'Ahmednagar', 'Bid', 'Hingoli', 'Jalna', 'Latur', 'Osmanabad'],
          'shard_south': ['Ratnagiri', 'Sindhudurg', 'Thane', 'Palghar', 'Chandrapur', 'Gadchiroli', 'Nanded', 'Parbhani']
        }
      }
    };

    this.initializeShards();
  }

  private initializeShards() {
    // Initialize shard configurations
    this.shardConfigs = [
      {
        shardId: 'shard_west',
        connectionString: process.env.DATABASE_URL,
        districts: this.strategy.configuration.shardMapping.shard_west,
        capacity: 15000, // 15K users per shard
        isActive: true
      },
      {
        shardId: 'shard_central',
        connectionString: process.env.DATABASE_URL,
        districts: this.strategy.configuration.shardMapping.shard_central,
        capacity: 15000,
        isActive: true
      },
      {
        shardId: 'shard_north',
        connectionString: process.env.DATABASE_URL,
        districts: this.strategy.configuration.shardMapping.shard_north,
        capacity: 10000,
        isActive: true
      },
      {
        shardId: 'shard_south',
        connectionString: process.env.DATABASE_URL,
        districts: this.strategy.configuration.shardMapping.shard_south,
        capacity: 10000,
        isActive: true
      }
    ];

    // Create database connections for each shard
    this.shardConfigs.forEach(config => {
      if (config.isActive) {
        const pool = new Pool({
          connectionString: config.connectionString,
          max: 2000, // 2K connections per shard
          min: 50,
          idleTimeoutMillis: 15000,
          connectionTimeoutMillis: 3000,
          application_name: `maharashtra_${config.shardId}`
        });

        const db = drizzle({ client: pool, schema });
        this.shards.set(config.shardId, db);
      }
    });
  }

  // Get appropriate shard based on district
  getShardByDistrict(district: string): ReturnType<typeof drizzle> {
    for (const [shardId, districts] of Object.entries(this.strategy.configuration.shardMapping)) {
      if (districts.includes(district)) {
        const shard = this.shards.get(shardId);
        if (shard) return shard;
      }
    }

    // Default to first available shard if district not found
    return this.shards.values().next().value;
  }

  // Get shard based on mobile number hash
  getShardByMobileHash(mobile: string): ReturnType<typeof drizzle> {
    const hash = this.calculateMobileHash(mobile);
    const shardIndex = hash % this.shards.size;
    const shardIds = Array.from(this.shards.keys());
    return this.shards.get(shardIds[shardIndex])!;
  }

  // Teacher lookup across shards
  async findTeacherAcrossShards(mobile: string) {
    const promises = Array.from(this.shards.values()).map(async (shard) => {
      try {
        const result = await shard.select()
          .from(schema.batchTeachers)
          .where(schema.eq(schema.batchTeachers.teacherMobile, mobile))
          .limit(1);
        return result[0] || null;
      } catch (error) {
        console.error('Shard query failed:', error);
        return null;
      }
    });

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    return null;
  }

  // Batch insert across shards based on district
  async distributedBatchInsert(data: any[], table: string) {
    const shardBatches = new Map<string, any[]>();

    // Group data by shard
    data.forEach(item => {
      const district = item.district;
      const shardId = this.getShardIdByDistrict(district);
      
      if (!shardBatches.has(shardId)) {
        shardBatches.set(shardId, []);
      }
      shardBatches.get(shardId)!.push(item);
    });

    // Execute parallel inserts
    const insertPromises = Array.from(shardBatches.entries()).map(([shardId, batch]) => {
      const shard = this.shards.get(shardId);
      if (!shard) return Promise.resolve([]);

      return this.executeShardInsert(shard, table, batch);
    });

    const results = await Promise.allSettled(insertPromises);
    return results.flatMap(result => 
      result.status === 'fulfilled' ? result.value : []
    );
  }

  private async executeShardInsert(shard: ReturnType<typeof drizzle>, table: string, batch: any[]) {
    try {
      switch (table) {
        case 'exam_results':
          return await shard.insert(schema.examResults).values(batch).returning();
        case 'exam_answers':
          return await shard.insert(schema.examAnswers).values(batch).returning();
        case 'trainer_feedback':
          return await shard.insert(schema.trainerFeedback).values(batch).returning();
        default:
          throw new Error(`Unsupported table: ${table}`);
      }
    } catch (error) {
      console.error(`Shard insert failed for table ${table}:`, error);
      return [];
    }
  }

  private getShardIdByDistrict(district: string): string {
    for (const [shardId, districts] of Object.entries(this.strategy.configuration.shardMapping)) {
      if (districts.includes(district)) {
        return shardId;
      }
    }
    return 'shard_west'; // Default fallback
  }

  private calculateMobileHash(mobile: string): number {
    let hash = 0;
    for (let i = 0; i < mobile.length; i++) {
      const char = mobile.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Shard health monitoring
  async checkShardHealth(): Promise<{ [key: string]: boolean }> {
    const healthChecks = new Map<string, boolean>();

    for (const [shardId, shard] of this.shards.entries()) {
      try {
        await shard.execute('SELECT 1');
        healthChecks.set(shardId, true);
      } catch (error) {
        console.error(`Shard ${shardId} health check failed:`, error);
        healthChecks.set(shardId, false);
      }
    }

    return Object.fromEntries(healthChecks);
  }

  // Get sharding statistics
  getShardingStats() {
    return {
      totalShards: this.shards.size,
      activeShards: this.shardConfigs.filter(s => s.isActive).length,
      totalCapacity: this.shardConfigs.reduce((sum, s) => sum + s.capacity, 0),
      strategy: this.strategy.type,
      distribution: this.strategy.configuration.shardMapping
    };
  }

  // Rebalance data across shards (for future implementation)
  async rebalanceShards() {
    console.log('Shard rebalancing initiated...');
    // Implementation for data redistribution
    // This would be used when adding new shards or when load becomes uneven
  }
}

export const shardingManager = new DatabaseShardingManager();