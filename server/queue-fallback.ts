import { QueueManager } from './redis-queue';
import { examQueue as memoryQueue } from './queue';

// Hybrid queue system - Redis with in-memory fallback
export class HybridQueueManager {
  private useRedis = false;

  constructor() {
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      this.useRedis = await QueueManager.healthCheck();
      console.log(`Queue system: ${this.useRedis ? 'Redis (scalable)' : 'Memory (fallback)'}`);
    } catch (error) {
      console.log('Redis unavailable, using memory queue fallback');
      this.useRedis = false;
    }
  }

  async addExam(examData: any): Promise<string> {
    if (this.useRedis) {
      try {
        return await QueueManager.addExam(examData);
      } catch (error) {
        console.error('Redis queue failed, falling back to memory:', error);
        this.useRedis = false;
      }
    }
    
    // Fallback to memory queue
    return memoryQueue.enqueue(examData);
  }

  async getExamStatus(examId: string) {
    if (this.useRedis) {
      try {
        return await QueueManager.getExamStatus(examId);
      } catch (error) {
        console.error('Redis status check failed, falling back to memory:', error);
        this.useRedis = false;
      }
    }
    
    // Fallback to memory queue
    return memoryQueue.getStatus(examId);
  }

  async getQueueStats() {
    if (this.useRedis) {
      try {
        return await QueueManager.getQueueStats();
      } catch (error) {
        console.error('Redis stats failed, falling back to memory:', error);
        this.useRedis = false;
      }
    }
    
    // Fallback to memory queue
    return memoryQueue.getStats();
  }

  isUsingRedis(): boolean {
    return this.useRedis;
  }
}

export const hybridQueue = new HybridQueueManager();