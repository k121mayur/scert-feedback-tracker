import { EventEmitter } from 'events';
import { storage } from './storage';
import { sessionCache } from './cache';

// Simple in-memory queue for async processing
class ExamQueue extends EventEmitter {
  private queue: Array<{ id: string; data: any; timestamp: number }> = [];
  private processing = false;
  private workers = 0;
  private maxWorkers = 10; // Configurable based on server capacity

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
      timestamp: Date.now()
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

  // Process next item in queue
  private async processNext() {
    if (this.workers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.workers++;
    
    try {
      await this.processExamSubmission(item);
    } catch (error) {
      console.error(`Failed to process exam ${item.id}:`, error);
      // Update status to failed
      sessionCache.set(`exam_status_${item.id}`, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date().toISOString()
      }, 3600);
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