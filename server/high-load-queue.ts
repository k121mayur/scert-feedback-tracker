import { redisClient } from './redis-alternative';
import { storage } from './storage';

interface ExamSubmission {
  examId: string;
  mobile: string;
  topic_id: string;
  topic_name: string;
  assessment_date: string;
  batch_name: string;
  district: string;
  questions: string[];
  answers: string[];
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

interface QueueMetrics {
  totalQueued: number;
  processing: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
  currentLoad: number;
}

export class HighLoadQueueManager {
  private processingItems = new Set<string>();
  private metrics: QueueMetrics = {
    totalQueued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    averageProcessingTime: 0,
    currentLoad: 0
  };
  private processingTimes: number[] = [];
  private maxConcurrentProcessing = 100; // For 40K concurrent users
  private batchSize = 50;

  async shouldUseQueue(currentLoad: number): Promise<boolean> {
    // Use immediate processing for low load, queue for high load
    const concurrentExams = this.processingItems.size;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    
    // Queue if we have high concurrent load or memory pressure
    return concurrentExams > 10 || memoryUsage > 200 || currentLoad > 0.7;
  }

  async addToQueue(examData: ExamSubmission): Promise<string> {
    const queueKey = `exam_queue:${examData.priority}`;
    await redisClient.lpush(queueKey, JSON.stringify(examData));
    
    // Set processing status
    await redisClient.set(`exam_status_${examData.examId}`, 'queued', { EX: 3600 });
    
    this.metrics.totalQueued++;
    return examData.examId;
  }

  async processImmediately(examData: ExamSubmission): Promise<any> {
    const startTime = Date.now();
    this.processingItems.add(examData.examId);
    this.metrics.processing++;

    try {
      // Set processing status
      await redisClient.set(`exam_status_${examData.examId}`, 'processing', { EX: 3600 });

      // Get questions for validation
      const questions = await storage.getRandomQuestionsByTopic(examData.topic_id, 5);
      if (questions.length === 0) {
        throw new Error(`No questions found for topic ${examData.topic_id}`);
      }

      // Calculate results
      const correctAnswers = questions.map(q => q.correctAnswer || 'A');
      const correctCount = examData.answers.filter((answer, index) => 
        answer === correctAnswers[index]
      ).length;
      const wrongCount = examData.answers.filter((answer, index) => 
        answer !== correctAnswers[index] && answer !== null
      ).length;
      const unansweredCount = examData.answers.filter(answer => answer === null).length;
      const totalQuestions = questions.length;
      const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      // Save exam result
      const examResult = await storage.submitExamResult({
        mobile: examData.mobile,
        topicId: examData.topic_id,
        topicName: examData.topic_name,
        assessmentDate: examData.assessment_date,
        batchName: examData.batch_name || 'General',
        district: examData.district || 'General',
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions
      });

      // Save individual answers with proper schema alignment
      const answerData = [];
      for (let i = 0; i < examData.answers.length && i < questions.length; i++) {
        answerData.push({
          mobile: examData.mobile,
          topicId: examData.topic_id,
          question: questions[i].question,
          selectedAnswer: examData.answers[i],
          correctAnswer: correctAnswers[i],
          isCorrect: examData.answers[i] === correctAnswers[i]
        });
      }

      if (answerData.length > 0) {
        await storage.submitExamAnswers(answerData);
      }

      // Update status to completed
      await redisClient.set(`exam_status_${examData.examId}`, 'completed', { EX: 3600 });
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      return {
        examId: examResult.id,
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions,
        percentage
      };

    } catch (error) {
      console.error(`Error processing exam ${examData.examId}:`, error);
      await redisClient.set(`exam_status_${examData.examId}`, 'failed', { EX: 3600 });
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      
      throw error;
    } finally {
      this.processingItems.delete(examData.examId);
      this.metrics.processing--;
    }
  }

  async processFeedbackImmediately(feedbackData: any): Promise<void> {
    const startTime = Date.now();
    const feedbackId = feedbackData.id || `feedback_${feedbackData.data.mobile_no}_${Date.now()}`;
    
    try {
      this.processingItems.add(feedbackId);
      this.metrics.processing++;
      
      // Update status to processing
      await redisClient.set(`feedback_status_${feedbackId}`, 'processing', { EX: 3600 });

      // Prepare feedback entries for database insertion
      const feedbackEntries = feedbackData.data.questions.map((question: string, index: number) => ({
        topicId: feedbackData.data.topic_name,
        mobile: feedbackData.data.mobile_no,
        feedbackQue: question,
        feedback: feedbackData.data.feedback_answers[index],
        batchName: feedbackData.data.batch_name,
        district: feedbackData.data.district
      }));

      // Submit feedback to database
      await storage.submitTrainerFeedback(feedbackEntries);

      // Create topic feedback record to prevent duplicates
      await storage.createTopicFeedback({
        topicName: feedbackData.data.topic_name,
        mobile: feedbackData.data.mobile_no
      });

      // Update status to completed
      await redisClient.set(`feedback_status_${feedbackId}`, 'completed', { EX: 3600 });

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      console.log(`Feedback processing completed: ${feedbackId}`);
      
    } catch (error) {
      console.error('Error processing feedback immediately:', error);
      await redisClient.set(`feedback_status_${feedbackId}`, 'failed', { EX: 3600 });
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      
      throw error;
    } finally {
      this.processingItems.delete(feedbackId);
      this.metrics.processing--;
    }
  }

  async addFeedbackToQueue(feedbackData: any, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    const queueKey = `feedback_queue:${priority}`;
    const feedbackId = `feedback_${feedbackData.mobile_no}_${Date.now()}`;
    
    const queueItem = {
      id: feedbackId,
      data: feedbackData,
      timestamp: Date.now(),
      priority,
      type: 'feedback'
    };

    await redisClient.lpush(queueKey, JSON.stringify(queueItem));
    await redisClient.set(`feedback_status_${feedbackId}`, 'queued', { EX: 3600 });
    
    this.metrics.queued++;
    console.log(`Added feedback to ${priority} priority queue: ${feedbackId}`);
  }

  async getQueueLength(): Promise<number> {
    const examQueues = ['exam_queue:high', 'exam_queue:normal', 'exam_queue:low'];
    const feedbackQueues = ['feedback_queue:high', 'feedback_queue:normal', 'feedback_queue:low'];
    
    let totalLength = 0;
    for (const queue of [...examQueues, ...feedbackQueues]) {
      totalLength += await redisClient.llen(queue);
    }
    return totalLength;
  }

  async processBatchFromQueue(): Promise<void> {
    const examQueues = ['exam_queue:high', 'exam_queue:normal', 'exam_queue:low'];
    const feedbackQueues = ['feedback_queue:high', 'feedback_queue:normal', 'feedback_queue:low'];
    
    // Process exam queues first (higher priority)
    for (const queueKey of examQueues) {
      const items = await redisClient.rpop(queueKey, this.batchSize);
      if (!items || items.length === 0) continue;

      const promises = items.map(async (item) => {
        try {
          const examData: ExamSubmission = JSON.parse(item);
          return await this.processImmediately(examData);
        } catch (error) {
          console.error('Error processing queued exam:', error);
          this.metrics.failed++;
        }
      });

      await Promise.allSettled(promises);
      break; // Process one queue at a time, prioritizing high -> normal -> low
    }

    // Process feedback queues if capacity allows
    if (this.processingItems.size < this.maxConcurrentProcessing) {
      for (const queueKey of feedbackQueues) {
        const items = await redisClient.rpop(queueKey, this.batchSize);
        if (!items || items.length === 0) continue;

        const promises = items.map(async (item) => {
          try {
            const feedbackData = JSON.parse(item);
            return await this.processFeedbackImmediately(feedbackData);
          } catch (error) {
            console.error('Error processing queued feedback:', error);
            this.metrics.failed++;
          }
        });

        await Promise.allSettled(promises);
        break;
      }
    }
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    this.processingTimes.push(processingTime);
    
    // Keep only last 100 processing times for average calculation
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    if (success) {
      this.metrics.completed++;
    } else {
      this.metrics.failed++;
    }

    this.metrics.currentLoad = this.processingItems.size / this.maxConcurrentProcessing;
  }

  async getQueueStatus(examId: string): Promise<any> {
    const status = await redisClient.get(`exam_status_${examId}`);
    
    if (status === 'queued') {
      // Estimate position in queue
      const queues = ['exam_queue:high', 'exam_queue:normal', 'exam_queue:low'];
      let position = 0;
      
      for (const queueKey of queues) {
        const queueLength = await redisClient.llen(queueKey);
        const items = await redisClient.lrange(queueKey, 0, queueLength);
        
        const foundIndex = items.findIndex(item => {
          try {
            const data = JSON.parse(item);
            return data.examId === examId;
          } catch {
            return false;
          }
        });

        if (foundIndex !== -1) {
          return {
            status: 'queued',
            position: position + foundIndex + 1,
            estimatedWaitTime: Math.ceil((position + foundIndex) * this.metrics.averageProcessingTime / 1000) // seconds
          };
        }
        
        position += queueLength;
      }
    }

    return {
      status: status || 'not_found',
      position: status === 'processing' ? 0 : null,
      estimatedWaitTime: status === 'processing' ? 5 : null // 5 seconds for processing
    };
  }

  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can write to queue
      const testKey = `health_check_${Date.now()}`;
      await redisClient.set(testKey, 'test', { EX: 1 });
      await redisClient.del(testKey);
      return true;
    } catch (error) {
      console.error('Queue health check failed:', error);
      return false;
    }
  }

  // Start background queue processor
  startQueueProcessor(): void {
    setInterval(async () => {
      try {
        await this.processBatchFromQueue();
      } catch (error) {
        console.error('Queue processor error:', error);
      }
    }, 1000); // Process every second
  }
}

export const highLoadQueue = new HighLoadQueueManager();