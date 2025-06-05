import { redisClient } from './redis-alternative';
import { storage } from './storage';

class QueueProcessor {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('Queue processor started');
    
    // Process queue every 2 seconds
    this.processingInterval = setInterval(async () => {
      await this.processQueueItems();
    }, 2000);
  }

  async stopProcessing() {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('Queue processor stopped');
  }

  private async processQueueItems() {
    try {
      // Get item from queue
      const queueItem = await redisClient.rpop('exam_queue');
      if (!queueItem) return;

      const { id, data } = JSON.parse(queueItem);
      
      console.log(`Processing exam: ${id}`);
      
      // Update status to processing
      await redisClient.set(`exam_status_${id}`, 'processing', { EX: 3600 });
      
      // Process the exam
      await this.processExam(id, data);
      
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  }

  private async processExam(examId: string, examData: any) {
    try {
      // Calculate results
      const questions = await storage.getQuestionsByTopic(examData.topic_id);
      const correctAnswers = questions.map(q => q.correctAnswer);
      
      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;

      examData.answers.forEach((answer: string | null, index: number) => {
        if (answer === null || answer === '') {
          unansweredCount++;
        } else if (answer === correctAnswers[index]) {
          correctCount++;
        } else {
          wrongCount++;
        }
      });

      const totalQuestions = questions.length;
      const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

      // Save exam result
      const examResult = await storage.saveExamResult({
        mobile: examData.mobile,
        topicId: examData.topic_id,
        topicName: examData.topic_name,
        assessmentDate: examData.assessment_date,
        batchName: examData.batch_name || 'General',
        district: examData.district || 'General',
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions,
        percentage,
        submittedAt: new Date()
      });

      // Save individual answers
      for (let i = 0; i < examData.answers.length; i++) {
        if (i < questions.length) {
          await storage.saveExamAnswer({
            examResultId: examResult.id,
            questionId: questions[i].id,
            selectedAnswer: examData.answers[i],
            correctAnswer: correctAnswers[i],
            isCorrect: examData.answers[i] === correctAnswers[i]
          });
        }
      }

      // Update status to completed
      await redisClient.set(`exam_status_${examId}`, 'completed', { EX: 3600 });
      
      console.log(`Exam ${examId} processed successfully`);
      
    } catch (error) {
      console.error(`Failed to process exam ${examId}:`, error);
      
      // Update status to failed
      await redisClient.set(`exam_status_${examId}`, 'failed', { EX: 3600 });
    }
  }

  async getQueueStats() {
    try {
      const queueLength = await redisClient.llen('exam_queue');
      return {
        queueLength,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      return {
        queueLength: 0,
        isProcessing: false
      };
    }
  }
}

export const queueProcessor = new QueueProcessor();