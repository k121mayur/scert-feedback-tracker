import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hybridQueue } from "./queue-fallback";
import { dataReconciliation } from "./data-reconciliation";
import { productionImporter } from "./import-service";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse";
import { assessmentCache, cache, getCacheKey } from "./cache";

// Rate limiting middleware for high-load scenarios
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    const current = rateLimitStore.get(clientId);
    if (!current || current.resetTime < windowStart) {
      rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (current.count >= maxRequests) {
      return res.status(429).json({ 
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
    
    current.count++;
    next();
  };
};

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Get available assessment dates
  app.get("/api/assessment-dates", async (req, res) => {
    try {
      const dates = await storage.getAllAssessmentDates();
      res.json(dates);
    } catch (error) {
      console.error("Error fetching assessment dates:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get assessments for a specific date
  app.get("/api/assessments-by-date/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const assessments = await storage.getAssessmentsByDate(date);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Check if exam exists for date/topic/mobile
  app.get("/api/check-exam-exists/:mobile/:topicId/:date", async (req, res) => {
    try {
      const { mobile, topicId, date } = req.params;
      
      // AUTHENTICATE: Check if teacher exists in authentic database
      const teacher = await storage.getTeacherByMobile(mobile);
      if (!teacher) {
        return res.status(403).json({ 
          message: "Teacher not registered. Please contact administrator for registration.",
          authenticated: false
        });
      }
      
      const exists = await storage.checkExamExists(mobile, topicId, date);
      res.json({ exists, authenticated: true });
    } catch (error) {
      console.error("Error checking exam existence:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get questions for new exam format (OPTIMIZED for 40K users)
  app.get("/api/exam-questions/:topicId", rateLimit(5, 60000), async (req, res) => {
    try {
      const { topicId } = req.params;
      const { mobile } = req.query;
      
      if (!mobile) {
        return res.json({ status: "error", message: "Mobile number required for authentication" });
      }
      
      // AUTHENTICATE: Check if teacher exists in authentic database
      const teacher = await storage.getTeacherByMobile(mobile as string);
      if (!teacher) {
        return res.json({ 
          status: "error", 
          message: "Teacher not registered. Please contact administrator for registration." 
        });
      }
      
      // Use optimized random question selection
      const questions = await storage.getRandomQuestionsByTopic(topicId, 5);
      
      if (questions.length === 0) {
        return res.json({ status: "error", message: "No questions available for this topic" });
      }

      // Minimize payload size for better performance
      res.json({
        status: "success",
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          option_a: q.optionA,
          option_b: q.optionB,
          option_c: q.optionC,
          option_d: q.optionD
        }))
      });
    } catch (error) {
      console.error("Error fetching exam questions:", error);
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

  // Get topic data by mobile number
  app.get("/api/topic-by-mobile/:mobile", async (req, res) => {
    try {
      const mobile = req.params.mobile;
      
      if (!mobile || mobile.length !== 10) {
        return res.status(400).json({ success: false, message: "Invalid mobile number" });
      }

      // AUTHENTICATE: Check if teacher exists in authentic database
      const teacher = await storage.getTeacherByMobile(mobile);
      if (!teacher) {
        return res.json({ 
          success: false, 
          message: "Teacher not registered. Please contact administrator for registration." 
        });
      }

      const batchTeacher = await storage.getBatchTeacherByMobile(mobile);
      
      if (!batchTeacher) {
        return res.json({ success: false, message: "Question paper is no longer active" });
      }

      res.json({
        success: true,
        topic_id: batchTeacher.topicId,
        batch_name: batchTeacher.batchName,
        district: batchTeacher.district
      });
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get questions for exam (OPTIMIZED for 40K users)
  app.get("/api/questions/:topicId/:mobile", rateLimit(5, 60000), async (req, res) => {
    try {
      const { topicId, mobile } = req.params;
      
      // AUTHENTICATE: Check if teacher exists in authentic database first
      const teacher = await storage.getTeacherByMobile(mobile);
      if (!teacher) {
        return res.json({ 
          status: "error", 
          message: "Teacher not registered. Please contact administrator for registration." 
        });
      }
      
      // Optimized batch teacher lookup with caching
      const batchTeacher = await storage.getBatchTeacherByMobile(mobile);
      if (!batchTeacher || batchTeacher.topicId !== topicId) {
        return res.json({ status: "error", message: "Invalid access or exam expired" });
      }

      // Cached duplicate check
      const existingResult = await storage.getExamResult(mobile, topicId);
      if (existingResult) {
        return res.json({ status: "error", message: "Exam already attempted" });
      }

      // Use optimized question retrieval
      const questions = await storage.getQuestionsByTopic(topicId, 10);
      
      if (questions.length === 0) {
        return res.json({ status: "error", message: "No questions available for this topic" });
      }

      res.json({
        status: "success",
        questions: questions.map(q => ({
          question: q.question,
          option_a: q.optionA,
          option_b: q.optionB,
          option_c: q.optionC,
          option_d: q.optionD
        }))
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ status: "error", message: "Server error" });
    }
  });

  // Submit exam answers (ASYNC processing for 40K users)
  app.post("/api/submit-exam", rateLimit(10, 60000), async (req, res) => {
    try {
      const examSchema = z.object({
        topic_id: z.string(),
        topic_name: z.string(),
        mobile: z.string().length(10),
        assessment_date: z.string(),
        batch_name: z.string().optional().default("General"),
        district: z.string().optional().default("General"),
        questions: z.array(z.string()),
        answers: z.array(z.string().nullable())
      });

      const data = examSchema.parse(req.body);
      
      // Quick duplicate check with cache
      const existingResult = await storage.checkExamExists(data.mobile, data.topic_id, data.assessment_date);
      if (existingResult) {
        return res.status(400).json({ message: "Exam already submitted for this date" });
      }

      // Direct processing for immediate response (single user scenario)
      // Queue system activated only under high load (>1000 concurrent users)
      
      try {
        // Calculate results immediately
        const questions = await storage.getQuestionsByTopic(data.topic_id);
        const correctAnswers = questions.map(q => q.correctAnswer);
        
        let correctCount = 0;
        let wrongCount = 0;
        let unansweredCount = 0;

        data.answers.forEach((answer, index) => {
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

        // Save exam result directly
        const examResult = await storage.addExamResult({
          mobile: data.mobile,
          topicId: data.topic_id,
          topicName: data.topic_name,
          assessmentDate: data.assessment_date,
          batchName: data.batch_name || 'General',
          district: data.district || 'General',
          correctCount,
          wrongCount,
          unansweredCount,
          totalQuestions,
          percentage,
          submittedAt: new Date()
        });

        // Save individual answers
        const answerData = [];
        for (let i = 0; i < data.answers.length && i < questions.length; i++) {
          answerData.push({
            mobile: data.mobile,
            topicId: data.topic_id,
            question: questions[i].question,
            selectedAnswer: data.answers[i],
            correctAnswer: correctAnswers[i] || 'A', // Ensure non-null value
            isCorrect: data.answers[i] === correctAnswers[i]
          });
        }
        
        if (answerData.length > 0) {
          await storage.submitExamAnswers(answerData);
        }

        // Return immediate success with results
        res.json({
          success: true,
          processing: false,
          results: {
            correctCount,
            wrongCount,
            unansweredCount,
            totalQuestions,
            percentage: Math.round(percentage * 100) / 100
          },
          message: "Exam completed successfully!",
          examId: examResult.id
        });

      } catch (error) {
        console.error("Direct processing failed, falling back to queue:", error);
        
        // Fallback to queue system if direct processing fails
        const examId = await hybridQueue.addExam(data);
        
        res.json({
          success: true,
          processing: true,
          examId: examId,
          message: "Exam submitted for processing. Check status using the exam ID.",
          statusEndpoint: `/api/exam-status/${examId}`,
          queueType: 'fallback'
        });
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Check exam processing status
  app.get("/api/exam-status/:examId", async (req, res) => {
    try {
      const { examId } = req.params;
      const status = await hybridQueue.getExamStatus(examId);
      
      if (!status) {
        return res.status(404).json({ message: "Exam ID not found" });
      }

      res.json(status);
    } catch (error) {
      console.error("Error checking exam status:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get feedback questions
  app.get("/api/feedback-questions", async (req, res) => {
    try {
      const questions = await storage.getAllFeedbackQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error fetching feedback questions:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Check if topic feedback exists
  app.get("/api/check-topic-feedback", async (req, res) => {
    try {
      const { topic, mobile } = req.query;
      
      if (!topic || !mobile) {
        return res.status(400).json({ message: "Topic and mobile are required" });
      }

      const exists = await storage.checkTopicExists(topic as string, mobile as string);
      res.json(exists ? "exists" : "not_exists");
    } catch (error) {
      console.error("Error checking topic feedback:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Submit feedback
  app.post("/api/submit-feedback", async (req, res) => {
    try {
      console.log('Received feedback submission request body:', req.body);
      
      const feedbackSchema = z.object({
        topic_name: z.string().optional(),
        mobile_no: z.string().min(10),
        batch_name: z.string().optional(),
        district: z.string().optional(),
        questions: z.array(z.string()),
        feedback_answers: z.array(z.string())
      });

      const parsedData = feedbackSchema.parse(req.body);
      
      // Provide defaults for optional fields
      const data = {
        topic_name: parsedData.topic_name || "General",
        mobile_no: parsedData.mobile_no,
        batch_name: parsedData.batch_name || "General",
        district: parsedData.district || "General",
        questions: parsedData.questions,
        feedback_answers: parsedData.feedback_answers
      };

      // Check if feedback already exists
      const exists = await storage.checkTopicExists(data.topic_name, data.mobile_no);
      if (exists) {
        return res.status(400).json({ message: "Feedback already submitted" });
      }

      // Prepare feedback entries
      const feedbackEntries = data.questions.map((question, index) => ({
        topicId: data.topic_name,
        mobile: data.mobile_no,
        feedbackQue: question,
        feedback: data.feedback_answers[index],
        batchName: data.batch_name,
        district: data.district
      }));

      // Submit feedback
      await storage.submitTrainerFeedback(feedbackEntries);

      // Create topic feedback record to prevent duplicates
      await storage.createTopicFeedback({
        topicName: data.topic_name,
        mobile: data.mobile_no
      });

      res.json("success");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Get all batches
  app.get("/api/admin/batches", async (req, res) => {
    try {
      const batches = await storage.getAllBatches();
      res.json(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Get teacher by mobile number
  app.get("/api/admin/teacher-by-mobile/:mobile", async (req, res) => {
    try {
      const { mobile } = req.params;
      const teacher = await storage.getTeacherByMobile(mobile);
      
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      
      res.json(teacher);
    } catch (error) {
      console.error("Error fetching teacher:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Get teacher's exam records
  app.get("/api/admin/teacher-exams/:mobile", async (req, res) => {
    try {
      const { mobile } = req.params;
      const exams = await storage.getExamsByMobile(mobile);
      res.json(exams);
    } catch (error) {
      console.error("Error fetching teacher exams:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Get teacher's feedback records
  app.get("/api/admin/teacher-feedback/:mobile", async (req, res) => {
    try {
      const { mobile } = req.params;
      const feedback = await storage.getTeacherFeedback(mobile);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching teacher feedback:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Enhanced admin credentials for production security
      if (username === "admin" && password === "TeacherPortal@2025#Secure") {
        res.json({ success: true, message: "Login successful" });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Admin: Create new teacher
  app.post("/api/admin/teachers", async (req, res) => {
    try {
      const teacherSchema = z.object({
        teacherId: z.string(),
        teacherName: z.string(),
        mobile: z.string().length(10),
        payId: z.string(),
        district: z.string(),
        serviceType: z.string(),
        trainingGroup: z.string()
      });

      const validatedData = teacherSchema.parse(req.body);
      
      // Check if teacher with this mobile already exists
      const existingTeacher = await storage.getTeacherByMobile(validatedData.mobile);
      if (existingTeacher) {
        return res.status(409).json({ message: "Teacher with this mobile number already exists" });
      }

      const teacher = await storage.createTeacher(validatedData);
      res.json(teacher);
    } catch (error) {
      console.error("Error creating teacher:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  // Admin: Update teacher
  app.put("/api/admin/teachers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const teacherSchema = z.object({
        teacherName: z.string(),
        mobile: z.string().length(10),
        payId: z.string().optional(),
        district: z.string()
      });

      const validatedData = teacherSchema.parse(req.body);
      const teacher = await storage.updateTeacher(parseInt(id), validatedData);
      
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      res.json(teacher);
    } catch (error) {
      console.error("Error updating teacher:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  // Assessment Control: Get available dates with their assigned topics
  app.get("/api/admin/assessment-control/dates", async (req, res) => {
    try {
      const datesWithTopics = await storage.getAssessmentControlDates();
      res.json(datesWithTopics);
    } catch (error) {
      console.error("Error fetching assessment control dates:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Assessment Control: Get available topics
  app.get("/api/admin/assessment-control/topics", async (req, res) => {
    try {
      const topics = await storage.getAssessmentControlTopics();
      res.json(topics);
    } catch (error) {
      console.error("Error fetching assessment control topics:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Assessment Control: Update date status and topic associations
  app.put("/api/admin/assessment-control/dates", async (req, res) => {
    try {
      const datesSchema = z.object({
        dates: z.array(z.object({
          date: z.string(),
          isActive: z.boolean(),
          topics: z.array(z.object({
            id: z.string(),
            name: z.string(),
            isActive: z.boolean()
          }))
        }))
      });

      const { dates } = datesSchema.parse(req.body);
      
      // Update each date's status and topic associations with batch processing
      for (const dateItem of dates) {
        await storage.updateAssessmentDateStatus(dateItem.date, dateItem.isActive);
        
        // Process topics in smaller batches to avoid connection timeouts
        const batchSize = 10;
        const topics = dateItem.topics;
        
        for (let i = 0; i < topics.length; i += batchSize) {
          const batch = topics.slice(i, i + batchSize);
          
          // Process batch with delay to prevent overwhelming the database
          const batchPromises = batch.map(async (topic, index) => {
            // Small delay between operations
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            return storage.updateDateTopicAssociation(dateItem.date, topic.id, topic.isActive);
          });
          
          await Promise.all(batchPromises);
          console.log(`Processed batch ${Math.floor(i/batchSize) + 1} for date ${dateItem.date}`);
        }
      }

      // Clear assessment-related caches to ensure changes are reflected immediately
      assessmentCache.flushAll();
      cache.del(getCacheKey.assessmentDates());
      
      console.log("Assessment date and topic settings updated and cache cleared");
      res.json({ success: true, message: "Assessment settings updated successfully" });
    } catch (error) {
      console.error("Error updating assessment settings:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  // Assessment Control: Update topic status
  app.put("/api/admin/assessment-control/topics", async (req, res) => {
    try {
      const topicsSchema = z.object({
        topics: z.array(z.object({
          id: z.string(),
          name: z.string(),
          isActive: z.boolean()
        }))
      });

      const { topics } = topicsSchema.parse(req.body);
      
      // Update each topic's status
      for (const topic of topics) {
        await storage.updateTopicActiveStatus(topic.id, topic.isActive);
      }

      // Clear assessment-related caches to ensure changes are reflected immediately
      assessmentCache.flushAll();
      cache.del(getCacheKey.assessmentDates());
      
      console.log("Topic settings updated and cache cleared");
      res.json({ success: true, message: "Topic settings updated successfully" });
    } catch (error) {
      console.error("Error updating assessment topic settings:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  });

  // Admin: Get batch teachers
  app.get("/api/admin/batches/:batchName/teachers", async (req, res) => {
    try {
      const { batchName } = req.params;
      const teachers = await storage.getBatchTeachers(batchName);
      res.json(teachers);
    } catch (error) {
      console.error("Error fetching batch teachers:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Create batch
  app.post("/api/admin/batches", async (req, res) => {
    try {
      const batchSchema = z.object({
        batchName: z.string(),
        district: z.string(),
        coordinatorName: z.string(),
        serviceType: z.string(),
        trainingGroup: z.string()
      });

      const data = batchSchema.parse(req.body);
      const batch = await storage.createBatch(data);
      res.json(batch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Delete batch
  app.delete("/api/admin/batches/:batchName", async (req, res) => {
    try {
      const { batchName } = req.params;
      const success = await storage.deleteBatch(batchName);
      
      if (success) {
        res.json({ message: "Batch deleted successfully" });
      } else {
        res.status(404).json({ message: "Batch not found" });
      }
    } catch (error) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Get batch teachers
  app.get("/api/admin/batches/:batchName/teachers", async (req, res) => {
    try {
      const { batchName } = req.params;
      const teachers = await storage.getBatchTeachers(batchName);
      res.json(teachers);
    } catch (error) {
      console.error("Error fetching batch teachers:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Upload and verify CSV
  app.post("/api/admin/verify-csv", upload.single("csvFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString();
      const records: any[] = [];

      // Parse CSV
      await new Promise((resolve, reject) => {
        parse(csvData, { columns: true }, (err: any, output: any) => {
          if (err) reject(err);
          else {
            records.push(...output);
            resolve(output);
          }
        });
      });

      // Verify payment IDs
      const verifiedRecords = await Promise.all(
        records.map(async (record) => {
          const paymentId = record.pay_id || record.payment_id || "";
          const exists = paymentId ? await storage.checkPaymentId(paymentId) : false;
          
          return {
            ...record,
            exists: exists ? "Yes" : "No"
          };
        })
      );

      res.json({
        success: true,
        data: verifiedRecords,
        summary: {
          total: verifiedRecords.length,
          verified: verifiedRecords.filter(r => r.exists === "Yes").length,
          unverified: verifiedRecords.filter(r => r.exists === "No").length
        }
      });
    } catch (error) {
      console.error("Error processing CSV:", error);
      res.status(500).json({ message: "Error processing CSV file" });
    }
  });

  // Admin: Bulk import teachers from CSV
  app.post("/api/admin/bulk-import-teachers", upload.single("csvFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString();
      const records: any[] = [];

      // Parse CSV
      await new Promise((resolve, reject) => {
        parse(csvData, { columns: true, skip_empty_lines: true }, (err: any, output: any) => {
          if (err) reject(err);
          else {
            records.push(...output);
            resolve(output);
          }
        });
      });

      console.log(`Starting bulk import of ${records.length} teacher records`);

      let importedBatches = 0;
      let importedTeachers = 0;
      let importedBatchTeachers = 0;
      let skippedRecords = 0;
      let errors: string[] = [];

      // Track unique batches and teachers to avoid duplicates
      const processedBatches = new Set<string>();
      const processedTeachers = new Set<string>();

      // Process records in batches for better performance
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            const district = record.District?.trim();
            const batchName = record['batch Name']?.trim() || record['Batch Name']?.trim();
            const serviceType = record['Service type']?.trim();
            const trainingGroup = record['Training group']?.trim();
            const teacherId = record['Teacher ID']?.trim();
            const teacherName = record['Teacher name']?.trim();
            const phoneNumber = record['Phone number']?.trim();

            // Skip records with missing essential data
            if (!district || !batchName || !teacherName || !phoneNumber) {
              skippedRecords++;
              continue;
            }

            // Create batch if not already processed
            if (!processedBatches.has(batchName)) {
              const existingBatch = await storage.getBatch(batchName);
              if (!existingBatch) {
                await storage.createBatch({
                  batchName,
                  district,
                  coordinatorName: "System Import",
                  serviceType: serviceType || "Selection Grade",
                  trainingGroup: trainingGroup || "Primary"
                });
                importedBatches++;
              }
              processedBatches.add(batchName);
            }

            // Create teacher if not already processed
            if (!processedTeachers.has(phoneNumber)) {
              const existingTeacher = await storage.getTeacherByMobile(phoneNumber);
              if (!existingTeacher) {
                await storage.createTeacher({
                  teacherName,
                  mobile: phoneNumber,
                  district,
                  teacherId: teacherId === 'null' || !teacherId ? null : teacherId,
                  serviceType: serviceType || "Selection Grade",
                  trainingGroup: trainingGroup || "Primary"
                });
                importedTeachers++;
              }
              processedTeachers.add(phoneNumber);
            }

            // Create batch teacher relationship
            const existingBatchTeacher = await storage.getBatchTeacherByMobile(phoneNumber);
            if (!existingBatchTeacher) {
              await storage.createBatchTeacher({
                teacherName,
                teacherMobile: phoneNumber,
                batchName,
                district,
                serviceType: serviceType || "Selection Grade",
                trainingGroup: trainingGroup || "Primary",
                teacherId: teacherId === 'null' || !teacherId ? null : teacherId,
                topicId: undefined,
                stopTime: undefined
              });
              importedBatchTeachers++;
            }

          } catch (error: any) {
            errors.push(`Record ${i + 1}: ${error.message}`);
            skippedRecords++;
          }
        }

        // Progress logging for large imports
        if (i % 1000 === 0) {
          console.log(`Processed ${Math.min(i + batchSize, records.length)} / ${records.length} records`);
        }
      }

      console.log(`Bulk import completed: ${importedTeachers} teachers, ${importedBatches} batches, ${importedBatchTeachers} batch relationships`);

      res.json({
        success: true,
        message: "Teacher bulk import completed successfully",
        summary: {
          totalRecords: records.length,
          importedTeachers,
          importedBatches,
          importedBatchTeachers,
          skippedRecords,
          errors: errors.slice(0, 10)
        }
      });

    } catch (error) {
      console.error("Error in teacher bulk import:", error);
      res.status(500).json({ message: "Error processing teacher bulk import" });
    }
  });

  // Admin: Get statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const examStats = await storage.getExamStats();
      const feedbackStats = await storage.getFeedbackStats();
      const systemStats = await storage.getSystemStats();

      res.json({
        examStats,
        feedbackStats,
        systemStats
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Data reconciliation endpoints
  app.get("/api/admin/data-reconciliation", async (req: Request, res: Response) => {
    try {
      const report = await dataReconciliation.performFullReconciliation();
      res.json(report);
    } catch (error) {
      console.error("Error performing data reconciliation:", error);
      res.status(500).json({ error: "Failed to perform data reconciliation" });
    }
  });

  app.get("/api/admin/data-reconciliation/status", async (req: Request, res: Response) => {
    try {
      const lastReport = await dataReconciliation.getLastReconciliationReport();
      res.json({ 
        hasReport: !!lastReport,
        lastRun: lastReport?.timestamp || null,
        status: lastReport?.overallStatus || 'UNKNOWN'
      });
    } catch (error) {
      console.error("Error getting reconciliation status:", error);
      res.status(500).json({ error: "Failed to get reconciliation status" });
    }
  });

  // Production data import endpoint
  app.post("/api/admin/import-production-data", async (req: Request, res: Response) => {
    try {
      console.log("Starting production data import...");
      await productionImporter.importCompleteDataset('./attached_assets/batch_teachers_1749097105409.csv');
      
      // Clear caches after import
      cache.flushAll();
      assessmentCache.flushAll();
      
      res.json({ 
        success: true, 
        message: "Production data imported successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error importing production data:", error);
      res.status(500).json({ error: "Failed to import production data" });
    }
  });

  // Database performance monitoring endpoints for 40K users
  app.get("/api/admin/performance/connections", async (req: Request, res: Response) => {
    try {
      const { getConnectionStats } = await import("./db");
      const stats = await getConnectionStats();
      res.json(stats);
    } catch (error) {
      console.error("Connection stats error:", error);
      res.status(500).json({ error: "Failed to get connection stats" });
    }
  });

  app.get("/api/admin/performance/queries", async (req: Request, res: Response) => {
    try {
      const { analyzeQueryPerformance } = await import("./db");
      const queries = await analyzeQueryPerformance();
      res.json(queries);
    } catch (error) {
      console.error("Query performance error:", error);
      res.status(500).json({ error: "Failed to analyze query performance" });
    }
  });

  app.get("/api/admin/performance/indexes", async (req: Request, res: Response) => {
    try {
      const { getIndexUsageStats } = await import("./db");
      const indexes = await getIndexUsageStats();
      res.json(indexes);
    } catch (error) {
      console.error("Index stats error:", error);
      res.status(500).json({ error: "Failed to get index usage stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
