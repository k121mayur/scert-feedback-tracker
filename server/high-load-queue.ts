import { EventEmitter } from 'events';
import { InsertExamAnswer, InsertTrainerFeedback, InsertExamResult } from '@shared/schema';
import { storage } from './storage';

interface QueueItem {
  id: string;
  type: 'exam_submission' | 'feedback_submission' | 'exam_answers';
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
}

interface BatchProcessingStats {
  processed: number;
  failed: number;
  queued: number;
  avgProcessingTime: number;
}

class HighLoadSubmissionQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxWorkers = 20; // Increased for 30K concurrent users
  private activeWorkers = 0;
  private maxRetries = 3;
  private batchSize = 50; // Process in larger batches
  private processingStats: BatchProcessingStats = {
    processed: 0,
    failed: 0,
    queued: 0,
    avgProcessingTime: 0
  };

  constructor() {
    super();
    this.startProcessing();
  }

  // Enqueue exam result submission
  enqueueExamSubmission(examResult: InsertExamResult, examAnswers: InsertExamAnswer[]): string {
    const id = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: QueueItem = {
      id,
      type: 'exam_submission',
      data: { examResult, examAnswers },
      timestamp: Date.now(),
      retryCount: 0,
      priority: 'high' // Exam submissions are high priority
    };

    this.queue.push(queueItem);
    this.processingStats.queued++;
    this.emit('enqueued', { id, type: 'exam_submission' });
    
    return id;
  }

  // Enqueue feedback submission
  enqueueFeedbackSubmission(feedback: InsertTrainerFeedback[]): string {
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: QueueItem = {
      id,
      type: 'feedback_submission',
      data: { feedback },
      timestamp: Date.now(),
      retryCount: 0,
      priority: 'normal'
    };

    this.queue.push(queueItem);
    this.processingStats.queued++;
    this.emit('enqueued', { id, type: 'feedback_submission' });
    
    return id;
  }

  private startProcessing() {
    if (this.processing) return;
    this.processing = true;

    // Process items every 100ms for high throughput
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private async processQueue() {
    if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    // Sort queue by priority and timestamp
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp;
    });

    // Process in batches for efficiency
    const batch = this.queue.splice(0, Math.min(this.batchSize, this.queue.length));
    if (batch.length === 0) return;

    this.activeWorkers++;
    this.processBatch(batch).finally(() => {
      this.activeWorkers--;
    });
  }

  private async processBatch(batch: QueueItem[]) {
    const startTime = Date.now();
    const results = await Promise.allSettled(
      batch.map(item => this.processItem(item))
    );

    let processed = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        processed++;
        this.emit('processed', { id: batch[index].id, success: true });
      } else {
        failed++;
        const item = batch[index];
        
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          item.timestamp = Date.now() + (item.retryCount * 5000); // Exponential backoff
          this.queue.push(item); // Re-queue for retry
        } else {
          this.emit('failed', { id: item.id, error: result.reason });
        }
      }
    });

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.processingStats.processed += processed;
    this.processingStats.failed += failed;
    this.processingStats.queued -= batch.length;
    this.processingStats.avgProcessingTime = 
      (this.processingStats.avgProcessingTime + processingTime) / 2;
  }

  private async processItem(item: QueueItem): Promise<void> {
    switch (item.type) {
      case 'exam_submission':
        await this.processExamSubmission(item.data);
        break;
      case 'feedback_submission':
        await this.processFeedbackSubmission(item.data);
        break;
      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  private async processExamSubmission(data: { examResult: InsertExamResult; examAnswers: InsertExamAnswer[] }) {
    try {
      // Submit exam result first
      await storage.submitExamResult(data.examResult);
      
      // Then submit all answers in batch
      if (data.examAnswers.length > 0) {
        await storage.submitExamAnswers(data.examAnswers);
      }
    } catch (error) {
      console.error('Exam submission processing failed:', error);
      throw error;
    }
  }

  private async processFeedbackSubmission(data: { feedback: InsertTrainerFeedback[] }) {
    try {
      if (data.feedback.length > 0) {
        await storage.submitTrainerFeedback(data.feedback);
      }
    } catch (error) {
      console.error('Feedback submission processing failed:', error);
      throw error;
    }
  }

  // Get queue status for monitoring
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers,
      isProcessing: this.processing,
      stats: this.processingStats,
      highPriorityItems: this.queue.filter(item => item.priority === 'high').length,
      oldestItemAge: this.queue.length > 0 ? 
        Date.now() - Math.min(...this.queue.map(item => item.timestamp)) : 0
    };
  }

  // Adjust worker count based on load
  adjustWorkerCount(load: 'low' | 'medium' | 'high') {
    switch (load) {
      case 'low':
        this.maxWorkers = 10;
        this.batchSize = 25;
        break;
      case 'medium':
        this.maxWorkers = 20;
        this.batchSize = 50;
        break;
      case 'high':
        this.maxWorkers = 30;
        this.batchSize = 100;
        break;
    }
  }

  // Clear queue (emergency use)
  clearQueue() {
    const clearedItems = this.queue.length;
    this.queue = [];
    this.processingStats.queued = 0;
    return clearedItems;
  }
}

export const highLoadQueue = new HighLoadSubmissionQueue();

// Auto-adjust worker count based on queue length
setInterval(() => {
  const status = highLoadQueue.getStatus();
  
  if (status.queueLength > 1000) {
    highLoadQueue.adjustWorkerCount('high');
  } else if (status.queueLength > 500) {
    highLoadQueue.adjustWorkerCount('medium');
  } else {
    highLoadQueue.adjustWorkerCount('low');
  }
}, 30000); // Check every 30 seconds