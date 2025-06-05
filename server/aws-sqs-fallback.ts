/**
 * AWS SQS Fallback Queue System for Replit Hosting
 * Distributes queue processing load between local memory and AWS SQS for 40K users
 */

import AWS from 'aws-sdk';

interface QueueConfig {
  useAWSSQS: boolean;
  localQueueLimit: number;
  sqsQueueUrl?: string;
  batchSize: number;
  visibilityTimeout: number;
  messageRetentionPeriod: number;
}

interface QueueMetrics {
  localMessages: number;
  sqsMessages: number;
  processedMessages: number;
  failedMessages: number;
  failoverCount: number;
  totalMessages: number;
}

interface QueueMessage {
  id: string;
  type: 'exam' | 'feedback' | 'bulk_import';
  data: any;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  retryCount: number;
}

export class AWSSQSFallbackManager {
  private sqs: AWS.SQS | null = null;
  private localQueue: Map<string, QueueMessage> = new Map();
  private processingQueue: Set<string> = new Set();
  private config: QueueConfig;
  private metrics: QueueMetrics;
  private isSQSHealthy = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      useAWSSQS: process.env.AWS_SQS_ENABLED === 'true',
      localQueueLimit: 5000, // Switch to SQS after 5000 local messages
      sqsQueueUrl: process.env.AWS_SQS_QUEUE_URL,
      batchSize: 10,
      visibilityTimeout: 300, // 5 minutes
      messageRetentionPeriod: 1209600 // 14 days
    };

    this.metrics = {
      localMessages: 0,
      sqsMessages: 0,
      processedMessages: 0,
      failedMessages: 0,
      failoverCount: 0,
      totalMessages: 0
    };

    this.initializeAWSSQS();
    this.startQueueProcessor();
  }

  private async initializeAWSSQS(): Promise<void> {
    if (!this.config.useAWSSQS) {
      console.log('AWS SQS not configured - using local queue only');
      return;
    }

    try {
      // Configure AWS SDK
      AWS.config.update({
        region: process.env.AWS_REGION || 'ap-south-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });

      this.sqs = new AWS.SQS({
        apiVersion: '2012-11-05',
        httpOptions: {
          timeout: 10000,
          connectTimeout: 5000
        }
      });

      // Test SQS connection
      if (this.config.sqsQueueUrl) {
        await this.testSQSConnection();
      }

    } catch (error) {
      console.error('AWS SQS initialization failed:', error);
      this.isSQSHealthy = false;
    }
  }

  private async testSQSConnection(): Promise<void> {
    if (!this.sqs || !this.config.sqsQueueUrl) return;

    try {
      const result = await this.sqs.getQueueAttributes({
        QueueUrl: this.config.sqsQueueUrl,
        AttributeNames: ['ApproximateNumberOfMessages']
      }).promise();

      this.isSQSHealthy = true;
      console.log('AWS SQS connection successful');
    } catch (error) {
      console.error('AWS SQS connection test failed:', error);
      this.isSQSHealthy = false;
    }
  }

  private shouldUseSQS(): boolean {
    return (
      this.config.useAWSSQS &&
      this.isSQSHealthy &&
      (this.localQueue.size > this.config.localQueueLimit || this.metrics.totalMessages > 10000)
    );
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async addMessage(type: 'exam' | 'feedback' | 'bulk_import', data: any, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string> {
    const messageId = this.generateMessageId();
    const message: QueueMessage = {
      id: messageId,
      type,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.metrics.totalMessages++;

    try {
      if (this.shouldUseSQS()) {
        await this.sendToSQS(message);
        this.metrics.sqsMessages++;
      } else {
        this.localQueue.set(messageId, message);
        this.metrics.localMessages++;
      }

      return messageId;
    } catch (error) {
      console.error('Failed to add message:', error);
      
      // Fallback to local queue
      this.localQueue.set(messageId, message);
      this.metrics.localMessages++;
      this.metrics.failoverCount++;
      
      return messageId;
    }
  }

  private async sendToSQS(message: QueueMessage): Promise<void> {
    if (!this.sqs || !this.config.sqsQueueUrl) {
      throw new Error('SQS not configured');
    }

    const sqsMessage = {
      QueueUrl: this.config.sqsQueueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        Type: {
          DataType: 'String',
          StringValue: message.type
        },
        Priority: {
          DataType: 'String',
          StringValue: message.priority
        },
        Timestamp: {
          DataType: 'Number',
          StringValue: message.timestamp.toString()
        }
      },
      MessageGroupId: message.type, // For FIFO queues
      MessageDeduplicationId: message.id
    };

    await this.sqs.sendMessage(sqsMessage).promise();
  }

  private startQueueProcessor(): void {
    this.processingInterval = setInterval(async () => {
      await this.processLocalQueue();
      await this.processSQSQueue();
    }, 1000); // Process every second
  }

  private async processLocalQueue(): Promise<void> {
    const messagesToProcess = Array.from(this.localQueue.entries())
      .filter(([id, _]) => !this.processingQueue.has(id))
      .slice(0, this.config.batchSize);

    for (const [messageId, message] of messagesToProcess) {
      try {
        this.processingQueue.add(messageId);
        await this.processMessage(message);
        
        this.localQueue.delete(messageId);
        this.processingQueue.delete(messageId);
        this.metrics.processedMessages++;
        
      } catch (error) {
        console.error(`Failed to process local message ${messageId}:`, error);
        this.processingQueue.delete(messageId);
        
        message.retryCount++;
        if (message.retryCount < 3) {
          // Retry later
          this.localQueue.set(messageId, message);
        } else {
          // Remove failed message
          this.localQueue.delete(messageId);
          this.metrics.failedMessages++;
        }
      }
    }
  }

  private async processSQSQueue(): Promise<void> {
    if (!this.isSQSHealthy || !this.sqs || !this.config.sqsQueueUrl) return;

    try {
      const result = await this.sqs.receiveMessage({
        QueueUrl: this.config.sqsQueueUrl,
        MaxNumberOfMessages: this.config.batchSize,
        VisibilityTimeout: this.config.visibilityTimeout,
        WaitTimeSeconds: 1 // Short polling
      }).promise();

      if (result.Messages) {
        for (const sqsMessage of result.Messages) {
          try {
            const message: QueueMessage = JSON.parse(sqsMessage.Body || '{}');
            await this.processMessage(message);
            
            // Delete message from SQS after successful processing
            await this.sqs.deleteMessage({
              QueueUrl: this.config.sqsQueueUrl!,
              ReceiptHandle: sqsMessage.ReceiptHandle!
            }).promise();
            
            this.metrics.processedMessages++;
            
          } catch (error) {
            console.error('Failed to process SQS message:', error);
            this.metrics.failedMessages++;
          }
        }
      }
    } catch (error) {
      console.error('SQS processing error:', error);
      this.isSQSHealthy = false;
    }
  }

  private async processMessage(message: QueueMessage): Promise<void> {
    switch (message.type) {
      case 'exam':
        await this.processExamSubmission(message.data);
        break;
      case 'feedback':
        await this.processFeedbackSubmission(message.data);
        break;
      case 'bulk_import':
        await this.processBulkImport(message.data);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  private async processExamSubmission(data: any): Promise<void> {
    // Process exam submission
    console.log('Processing exam submission:', data.examId);
    
    // Insert exam results into database
    // This would use your database manager
    // await awsRDSFallback.executeWrite(insertExamQuery);
  }

  private async processFeedbackSubmission(data: any): Promise<void> {
    // Process feedback submission
    console.log('Processing feedback submission:', data.teacherMobile);
    
    // Insert feedback into database
    // await awsRDSFallback.executeWrite(insertFeedbackQuery);
  }

  private async processBulkImport(data: any): Promise<void> {
    // Process bulk data import
    console.log('Processing bulk import:', data.type);
    
    // Handle bulk operations
    // This could be teacher imports, question imports, etc.
  }

  async getQueueStatus(): Promise<any> {
    const sqsStatus = await this.getSQSQueueAttributes();
    
    return {
      local: {
        messages: this.localQueue.size,
        processing: this.processingQueue.size,
        limit: this.config.localQueueLimit
      },
      sqs: {
        healthy: this.isSQSHealthy,
        enabled: this.config.useAWSSQS,
        ...sqsStatus
      },
      metrics: this.metrics,
      strategy: this.shouldUseSQS() ? 'sqs-primary' : 'local-primary'
    };
  }

  private async getSQSQueueAttributes(): Promise<any> {
    if (!this.isSQSHealthy || !this.sqs || !this.config.sqsQueueUrl) {
      return { messages: 0, inFlight: 0 };
    }

    try {
      const result = await this.sqs.getQueueAttributes({
        QueueUrl: this.config.sqsQueueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible'
        ]
      }).promise();

      return {
        messages: parseInt(result.Attributes?.ApproximateNumberOfMessages || '0'),
        inFlight: parseInt(result.Attributes?.ApproximateNumberOfMessagesNotVisible || '0')
      };
    } catch (error) {
      console.error('Failed to get SQS attributes:', error);
      return { messages: 0, inFlight: 0 };
    }
  }

  async purgeQueues(): Promise<void> {
    // Clear local queue
    this.localQueue.clear();
    this.processingQueue.clear();

    // Purge SQS queue if available
    if (this.isSQSHealthy && this.sqs && this.config.sqsQueueUrl) {
      try {
        await this.sqs.purgeQueue({
          QueueUrl: this.config.sqsQueueUrl
        }).promise();
      } catch (error) {
        console.error('Failed to purge SQS queue:', error);
      }
    }
  }

  async close(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process remaining local messages
    while (this.localQueue.size > 0) {
      await this.processLocalQueue();
    }
  }
}

// Global SQS fallback manager instance
export const awsSQSFallback = new AWSSQSFallbackManager();