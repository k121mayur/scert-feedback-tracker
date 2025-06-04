import { EventEmitter } from 'events';
import { storage } from './storage';
import { sessionCache } from './cache';
import { checkDatabaseHealth } from './db';

// Simple in-memory queue for async processing
class ExamQueue extends EventEmitter {
  private queue: Array<{ id: string; data: any; timestamp: number; retryCount: number }> = [];
  private processing = false;
  private workers = 0;
  private maxWorkers = 10; // Configurable based on server capacity
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds
  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    threshold: 10, // Trip after 10 failures
    timeout: 30000, // 30 seconds
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  };

  constructor() {
    super();
    this.startProcessing();
  }

  // Add exam submission to queue
  enqueue(examData: any): string {
    const id = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queueItem = {
      id,
      data: examData,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queueItem);
    this.emit('newItem', queueItem);
    
    // Store processing status in session cache
    sessionCache.set(`exam_status_${id}`, { status: 'queued', submittedAt: new Date().toISOString() }, 1800);
    
    return id;
  }

  // Start async processing workers
  private startProcessing() {
    setInterval(() => {
      if (this.queue.length > 0 && this.workers < this.maxWorkers) {
        this.processNext();
      }
    }, 100); // Check every 100ms for new items
  }

  // Check circuit breaker state
  private canProcess(): boolean {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'OPEN') {
      if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        console.log('Circuit breaker transitioning to HALF_OPEN');
        return true;
      }
      return false;
    }
    
    return true;
  }

  // Record processing result for circuit breaker
  private recordResult(success: boolean) {
    if (success) {
      this.circuitBreaker.failures = 0;
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        console.log('Circuit breaker CLOSED - system recovered');
      }
    } else {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'OPEN';
        console.log(`Circuit breaker OPEN - too many failures (${this.circuitBreaker.failures})`);
      }
    }
  }

  // Process next item in queue with retry and circuit breaker
  private async processNext() {
    if (this.workers >= this.maxWorkers || this.queue.length === 0 || !this.canProcess()) {
      return;
    }

    // Check database health before processing
    const isDbHealthy = await checkDatabaseHealth();
    if (!isDbHealthy) {
      console.log('Database unhealthy, skipping processing cycle');
      this.recordResult(false);
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.workers++;
    
    try {
      await this.processExamSubmission(item);
      this.recordResult(true);
    } catch (error) {
      console.error(`Failed to process exam ${item.id} (attempt ${item.retryCount + 1}):`, error);
      this.recordResult(false);
      
      // Retry logic
      if (item.retryCount < this.maxRetries && this.circuitBreaker.state !== 'OPEN') {
        item.retryCount++;
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, item.retryCount - 1);
        
        setTimeout(() => {
          this.queue.unshift(item); // Add back to front of queue
          console.log(`Retrying exam ${item.id} in ${delay}ms (attempt ${item.retryCount})`);
        }, delay);
        
        // Update status to retrying
        sessionCache.set(`exam_status_${item.id}`, { 
          status: 'retrying',
          retryCount: item.retryCount,
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 3600);
      } else {
        // Max retries exceeded or circuit breaker open
        sessionCache.set(`exam_status_${item.id}`, { 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: item.retryCount,
          circuitBreakerState: this.circuitBreaker.state,
          processedAt: new Date().toISOString()
        }, 3600);
      }
    } finally {
      this.workers--;
    }
  }

  // Process individual exam submission
  private async processExamSubmission(item: { id: string; data: any; timestamp: number }) {
    const { data } = item;
    
    // Update status to processing
    sessionCache.set(`exam_status_${item.id}`, { 
      status: 'processing', 
      startedAt: new Date().toISOString() 
    }, 1800);

    try {
      // Check if already submitted (duplicate prevention)
      const existingResult = await storage.checkExamExists(data.mobile, data.topic_id, data.assessment_date);
      if (existingResult) {
        sessionCache.set(`exam_status_${item.id}`, { 
          status: 'duplicate', 
          message: 'Exam already submitted',
          processedAt: new Date().toISOString()
        }, 3600);
        return;
      }

      // Get questions with correct answers for scoring
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

      // Update status to completed with all required data for feedback
      sessionCache.set(`exam_status_${item.id}`, { 
        status: 'completed',
        result: {
          correctCount,
          wrongCount,
          unansweredCount,
          totalQuestions: questions.length,
          examId: examResult.id,
          // Include exam metadata for feedback flow
          mobile: data.mobile,
          topicId: data.topic_id,
          topicName: data.topic_name,
          assessmentDate: data.assessment_date,
          batch: data.batch_name,
          district: data.district
        },
        processedAt: new Date().toISOString()
      }, 3600);

      console.log(`Successfully processed exam ${item.id} for mobile ${data.mobile}`);

    } catch (error) {
      console.error(`Error processing exam ${item.id}:`, error);
      throw error;
    }
  }

  // Get processing status
  getStatus(examId: string) {
    return sessionCache.get(`exam_status_${examId}`);
  }

  // Get queue statistics
  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.workers,
      maxWorkers: this.maxWorkers,
      oldestItem: this.queue.length > 0 ? this.queue[0].timestamp : null
    };
  }
}

export const examQueue = new ExamQueue();