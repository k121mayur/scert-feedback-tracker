import { redisClient } from './redis-alternative';
import { examQueue as memoryQueue } from './queue';

// Hybrid queue system - Memory-based Redis with fallback
export class HybridQueueManager {
  private useRedis = true;

  constructor() {
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      await redisClient.ping();
      this.useRedis = true;
      console.log('Queue system: Memory-Redis (enhanced)');
    } catch (error) {
      console.log('Memory-Redis unavailable, using basic memory queue');
      this.useRedis = false;
    }
  }

  async addExam(examData: any): Promise<string> {
    if (this.useRedis) {
      try {
        const examId = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await redisClient.lpush('exam_queue', JSON.stringify({ id: examId, data: examData, timestamp: Date.now() }));
        await redisClient.set(`exam_status_${examId}`, 'queued', { EX: 3600 });
        return examId;
      } catch (error) {
        console.error('Memory-Redis queue failed, falling back to basic memory:', error);
        this.useRedis = false;
      }
    }
    
    // Fallback to memory queue
    return memoryQueue.enqueue(examData);
  }

  async getExamStatus(examId: string) {
    if (this.useRedis) {
      try {
        const status = await redisClient.get(`exam_status_${examId}`);
        return { status: status || 'not_found' };
      } catch (error) {
        console.error('Memory-Redis status check failed, falling back to basic memory:', error);
        this.useRedis = false;
      }
    }
    
    // Fallback to memory queue
    return memoryQueue.getStatus(examId);
  }

  async getQueueStats() {
    if (this.useRedis) {
      try {
        const queueLength = await redisClient.llen('exam_queue');
        const stats = redisClient.getStats();
        return {
          queueLength,
          totalProcessed: 0,
          avgProcessingTime: 0,
          memoryUsage: stats.memoryUsage,
          totalKeys: stats.totalKeys
        };
      } catch (error) {
        console.error('Memory-Redis stats failed, falling back to basic memory:', error);
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