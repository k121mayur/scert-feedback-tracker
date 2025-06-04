import Bull from 'bull';
import Redis from 'ioredis';
import { storage } from './storage';
import { sessionCache } from './cache';

// Redis configuration for scalable queue system
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
});

// Create exam processing queue with Redis backend
export const examQueue = new Bull('exam-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3, // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
  settings: {
    stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 1, // Mark job as failed after 1 stall
  }
});

// Circuit breaker for Redis queue
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold = 10;
  private readonly timeout = 30000; // 30 seconds

  canProcess(): boolean {
    const now = Date.now();
    
    if (this.state === 'OPEN') {
      if (now - this.lastFailure > this.timeout) {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker transitioning to HALF_OPEN');
        return true;
      }
      return false;
    }
    
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('Circuit breaker CLOSED - system recovered');
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.log(`Circuit breaker OPEN - too many failures (${this.failures})`);
    }
  }

  getState() {
    return this.state;
  }
}

const circuitBreaker = new CircuitBreaker();

// Process exam submissions with scalable worker
examQueue.process('process-exam', 10, async (job) => {
  const { data } = job.data;
  const examId = job.id;

  // Check circuit breaker
  if (!circuitBreaker.canProcess()) {
    throw new Error('Circuit breaker is OPEN - system overloaded');
  }

  try {
    // Update status to processing
    sessionCache.set(`exam_status_${examId}`, { 
      status: 'processing', 
      startedAt: new Date().toISOString(),
      workerId: process.pid
    }, 1800);

    // Get questions with correct answers
    const questions = await storage.getRandomQuestionsByTopic(data.topic_id, 5);
    
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    
    const examAnswers = questions.map((question, index) => {
      const selectedAnswer = data.answers[index];
      const isCorrect = selectedAnswer === question.correctAnswer;
      
      if (!selectedAnswer) {
        unansweredCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }
      
      return {
        mobile: data.mobile,
        topicId: data.topic_id,
        question: question.question,
        selectedAnswer: selectedAnswer || null,
        correctAnswer: question.correctAnswer,
        isCorrect
      };
    });

    // Submit exam result
    const examResult = await storage.submitExamResult({
      mobile: data.mobile,
      topicId: data.topic_id,
      topicName: data.topic_name,
      assessmentDate: data.assessment_date,
      batchName: data.batch_name,
      district: data.district,
      correctCount,
      wrongCount,
      unansweredCount,
      totalQuestions: questions.length
    });

    // Submit individual answers
    await storage.submitExamAnswers(examAnswers);

    // Update status to completed
    const result = {
      status: 'completed',
      result: {
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions: questions.length,
        examId: examResult.id,
        mobile: data.mobile,
        topicId: data.topic_id,
        topicName: data.topic_name,
        assessmentDate: data.assessment_date,
        batch: data.batch_name,
        district: data.district
      },
      processedAt: new Date().toISOString(),
      workerId: process.pid
    };

    sessionCache.set(`exam_status_${examId}`, result, 3600);
    circuitBreaker.recordSuccess();
    
    return result;

  } catch (error) {
    circuitBreaker.recordFailure();
    console.error(`Failed to process exam ${examId}:`, error);
    
    // Update status to failed
    sessionCache.set(`exam_status_${examId}`, { 
      status: 'failed', 
      error: error instanceof Error ? error.message : 'Unknown error',
      processedAt: new Date().toISOString(),
      workerId: process.pid,
      circuitBreakerState: circuitBreaker.getState()
    }, 3600);
    
    throw error;
  }
});

// Queue management functions
export const QueueManager = {
  // Add exam to queue
  async addExam(examData: any): Promise<string> {
    const job = await examQueue.add('process-exam', { data: examData }, {
      priority: 1, // Normal priority
      delay: 0,
    });
    
    const examId = `exam_${job.id}`;
    
    // Set initial status
    sessionCache.set(`exam_status_${examId}`, { 
      status: 'queued', 
      queuedAt: new Date().toISOString(),
      jobId: job.id
    }, 1800);
    
    return examId;
  },

  // Get exam status
  async getExamStatus(examId: string) {
    const cachedStatus = sessionCache.get(`exam_status_${examId}`);
    if (cachedStatus) {
      return {
        ...cachedStatus,
        queueStats: await this.getQueueStats(),
        circuitBreakerState: circuitBreaker.getState()
      };
    }
    
    // Try to find job in queue
    const jobId = examId.replace('exam_', '');
    try {
      const job = await examQueue.getJob(jobId);
      if (job) {
        return {
          status: await job.getState(),
          progress: job.progress(),
          queueStats: await this.getQueueStats(),
          circuitBreakerState: circuitBreaker.getState()
        };
      }
    } catch (error) {
      console.error('Error getting job status:', error);
    }
    
    return { 
      status: 'not_found',
      queueStats: await this.getQueueStats(),
      circuitBreakerState: circuitBreaker.getState()
    };
  },

  // Get queue statistics
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        examQueue.getWaiting(),
        examQueue.getActive(),
        examQueue.getCompleted(),
        examQueue.getFailed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length,
        circuitBreakerState: circuitBreaker.getState()
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
        circuitBreakerState: circuitBreaker.getState(),
        error: 'Stats unavailable'
      };
    }
  },

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down queue gracefully...');
  await examQueue.close();
  redis.disconnect();
});

export { redis };