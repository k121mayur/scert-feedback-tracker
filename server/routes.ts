import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse";

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
      const exists = await storage.checkExamExists(mobile, topicId, date);
      res.json({ exists });
    } catch (error) {
      console.error("Error checking exam existence:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get questions for new exam format
  app.get("/api/exam-questions/:topicId", async (req, res) => {
    try {
      const { topicId } = req.params;
      const questions = await storage.getRandomQuestionsByTopic(topicId, 5);
      
      if (questions.length === 0) {
        return res.json({ status: "error", message: "No questions available for this topic" });
      }

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

  // Get questions for exam
  app.get("/api/questions/:topicId/:mobile", async (req, res) => {
    try {
      const { topicId, mobile } = req.params;
      
      // Check if teacher is eligible
      const batchTeacher = await storage.getBatchTeacherByMobile(mobile);
      if (!batchTeacher || batchTeacher.topicId !== topicId) {
        return res.json({ status: "error", message: "Invalid access or exam expired" });
      }

      // Check if already attempted
      const existingResult = await storage.getExamResult(mobile, topicId);
      if (existingResult) {
        return res.json({ status: "error", message: "Exam already attempted" });
      }

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

  // Submit exam answers
  app.post("/api/submit-exam", async (req, res) => {
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
      
      // Check if already submitted
      const existingResult = await storage.checkExamExists(data.mobile, data.topic_id, data.assessment_date);
      if (existingResult) {
        return res.status(400).json({ message: "Exam already submitted for this date" });
      }

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

      res.json({
        success: true,
        result: {
          correctCount,
          wrongCount,
          unansweredCount,
          totalQuestions: questions.length,
          examId: examResult.id
        }
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
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

  // Admin: Create new teacher
  app.post("/api/admin/teachers", async (req, res) => {
    try {
      const teacherSchema = z.object({
        teacherId: z.string(),
        teacherName: z.string(),
        mobile: z.string().length(10),
        payId: z.string(),
        district: z.string()
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

  const httpServer = createServer(app);
  return httpServer;
}
