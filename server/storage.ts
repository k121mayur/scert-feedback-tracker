import { db } from "./autoscale-db";
import { eq, and, gte, sql, desc, count, avg } from "drizzle-orm";
import { cache, questionCache, assessmentCache, feedbackCache, getCacheKey } from "./cache";
import {
  users, teachers, batches, batchTeachers, questions, feedbackQuestions,
  examResults, examAnswers, trainerFeedback, topicFeedback, assessmentSchedules,
  type User, type InsertUser,
  type Teacher, type InsertTeacher,
  type Batch, type InsertBatch,
  type BatchTeacher, type InsertBatchTeacher,
  type Question, type InsertQuestion,
  type FeedbackQuestion, type InsertFeedbackQuestion,
  type ExamResult, type InsertExamResult,
  type ExamAnswer, type InsertExamAnswer,
  type TrainerFeedback, type InsertTrainerFeedback,
  type TopicFeedback, type InsertTopicFeedback,
  type AssessmentSchedule, type InsertAssessmentSchedule,
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Teacher management
  getTeacher(id: number): Promise<Teacher | undefined>;
  getTeacherByMobile(mobile: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: number, updates: Partial<InsertTeacher>): Promise<Teacher | undefined>;
  checkPaymentId(payId: string): Promise<boolean>;

  // Assessment schedule management
  getAssessmentsByDate(date: string): Promise<AssessmentSchedule[]>;
  getAllAssessmentDates(): Promise<string[]>;
  createAssessmentSchedule(schedule: InsertAssessmentSchedule): Promise<AssessmentSchedule>;

  // Batch management
  getAllBatches(): Promise<Batch[]>;
  getBatch(batchName: string): Promise<Batch | undefined>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  deleteBatch(batchName: string): Promise<boolean>;
  getBatchTeachers(batchName: string): Promise<BatchTeacher[]>;

  // Batch teacher management
  getBatchTeacherByMobile(mobile: string): Promise<BatchTeacher | undefined>;
  createBatchTeacher(batchTeacher: InsertBatchTeacher): Promise<BatchTeacher>;

  // Question management
  getQuestionsByTopic(topicId: string, limit?: number): Promise<Question[]>;
  getRandomQuestionsByTopic(topicId: string, count: number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;

  // Feedback questions
  getAllFeedbackQuestions(): Promise<FeedbackQuestion[]>;
  createFeedbackQuestion(feedbackQuestion: InsertFeedbackQuestion): Promise<FeedbackQuestion>;

  // Exam management
  checkExamExists(mobile: string, topicId: string, date: string): Promise<boolean>;
  checkTopicExists(topicName: string, mobile: string): Promise<boolean>;
  submitExamResult(result: InsertExamResult): Promise<ExamResult>;
  submitExamAnswers(answers: InsertExamAnswer[]): Promise<ExamAnswer[]>;
  getExamResult(mobile: string, topicId: string, date?: string): Promise<ExamResult | undefined>;
  getExamsByMobile(mobile: string): Promise<ExamResult[]>;

  // Feedback management
  submitTrainerFeedback(feedback: InsertTrainerFeedback[]): Promise<TrainerFeedback[]>;
  createTopicFeedback(topicFeedback: InsertTopicFeedback): Promise<TopicFeedback>;

  // Analytics
  getExamStats(): Promise<{
    totalExams: number;
    averageScore: number;
    passRate: number;
  }>;
  getFeedbackStats(): Promise<{
    totalFeedback: number;
    averageRating: number;
    satisfactionRate: number;
  }>;

  // Teacher feedback management
  getTeacherFeedback(mobile: string): Promise<any[]>;

  // System statistics
  getSystemStats(): Promise<{
    totalTeachers: number;
    totalDistricts: number;
    totalBatches: number;
    totalSubjects: number;
    totalQuestions: number;
    totalAssessmentDates: number;
  }>;

  // Assessment control
  getAssessmentControlDates(): Promise<{ date: string; isActive: boolean; topics: { id: string; name: string; isActive: boolean; }[]; }[]>;
  getAssessmentControlTopics(): Promise<{ id: string; name: string; isActive: boolean; }[]>;
  updateAssessmentDateStatus(date: string, isActive: boolean): Promise<void>;
  updateTopicActiveStatus(topicId: string, isActive: boolean): Promise<void>;
  updateDateTopicAssociation(date: string, topicId: string, isActive: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTeacher(id: number): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher || undefined;
  }

  async getTeacherByMobile(mobile: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.mobile, mobile));
    return teacher || undefined;
  }

  async createTeacher(teacher: InsertTeacher): Promise<Teacher> {
    const [newTeacher] = await db.insert(teachers).values(teacher).returning();
    return newTeacher;
  }

  async updateTeacher(id: number, updates: Partial<InsertTeacher>): Promise<Teacher | undefined> {
    const [updatedTeacher] = await db
      .update(teachers)
      .set(updates)
      .where(eq(teachers.id, id))
      .returning();
    return updatedTeacher || undefined;
  }

  async checkPaymentId(payId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: count() })
      .from(teachers)
      .where(eq(teachers.payId, payId));
    return (result?.count || 0) > 0;
  }

  async getAssessmentsByDate(date: string): Promise<AssessmentSchedule[]> {
    try {
      const activeAssessments = await db.select().from(assessmentSchedules)
        .where(and(eq(assessmentSchedules.assessmentDate, date), eq(assessmentSchedules.isActive, true)));
      
      // If no active assessments found for this date, return empty array to prevent fallback to all topics
      if (activeAssessments.length === 0) {
        console.log(`No active assessments configured for date: ${date}`);
        return [];
      }
      
      return activeAssessments;
    } catch (error) {
      console.error(`Error fetching assessments for date ${date}:`, error);
      return [];
    }
  }

  async getAllAssessmentDates(): Promise<string[]> {
    const cacheKey = getCacheKey.assessmentDates();
    const cached = assessmentCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Use optimized database connection for autoscale
      const result = await db.select({ date: assessmentSchedules.assessmentDate })
        .from(assessmentSchedules)
        .where(eq(assessmentSchedules.isActive, true))
        .groupBy(assessmentSchedules.assessmentDate)
        .orderBy(assessmentSchedules.assessmentDate)
        .limit(50); // Performance limit for 40K users
      
      const dates = result.map(r => r.date);
      assessmentCache.set(cacheKey, dates, 900); // 15 minute cache
      return dates;
    } catch (error) {
      console.error('Database timeout for assessment dates:', error);
      // Return empty array to prevent app crash
      return [];
    }
  }

  async createAssessmentSchedule(schedule: InsertAssessmentSchedule): Promise<AssessmentSchedule> {
    const [newSchedule] = await db.insert(assessmentSchedules).values(schedule).returning();
    return newSchedule;
  }

  async getAllBatches(): Promise<Batch[]> {
    return await db
      .select()
      .from(batches)
      .orderBy(desc(batches.createdAt));
  }

  async getBatch(batchName: string): Promise<Batch | undefined> {
    const [batch] = await db.select().from(batches).where(eq(batches.batchName, batchName));
    return batch || undefined;
  }

  async createBatch(batch: InsertBatch): Promise<Batch> {
    const [newBatch] = await db.insert(batches).values(batch).returning();
    return newBatch;
  }

  async deleteBatch(batchName: string): Promise<boolean> {
    const result = await db.delete(batches).where(eq(batches.batchName, batchName));
    return (result.rowCount || 0) > 0;
  }

  async getBatchTeachers(batchName: string): Promise<BatchTeacher[]> {
    return await db
      .select()
      .from(batchTeachers)
      .where(eq(batchTeachers.batchName, batchName));
  }

  async getBatchTeacherByMobile(mobile: string): Promise<BatchTeacher | undefined> {
    const [batchTeacher] = await db
      .select()
      .from(batchTeachers)
      .where(
        and(
          eq(batchTeachers.teacherMobile, mobile),
          gte(batchTeachers.stopTime, new Date())
        )
      );
    return batchTeacher || undefined;
  }

  async createBatchTeacher(batchTeacher: InsertBatchTeacher): Promise<BatchTeacher> {
    const [newBatchTeacher] = await db.insert(batchTeachers).values(batchTeacher).returning();
    return newBatchTeacher;
  }

  async getQuestionsByTopic(topicId: string, limit: number = 10): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.topicId, topicId))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  async getRandomQuestionsByTopic(topicId: string, count: number): Promise<Question[]> {
    const cacheKey = getCacheKey.randomQuestions(topicId, count);
    const cached = questionCache.get<Question[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // SIMPLIFIED: Use offset-based random selection for reliability
    try {
      // Get all questions for the topic first
      const allQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.topicId, topicId));
      
      if (allQuestions.length === 0) {
        return [];
      }
      
      // Use JavaScript shuffle for reliable random selection
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const result = shuffled.slice(0, Math.min(count, allQuestions.length));
      
      // Cache for shorter time since it's random
      questionCache.set(cacheKey, result, 300); // 5 minutes
      return result;
    } catch (error) {
      console.error("Error in getRandomQuestionsByTopic:", error);
      // Fallback to simple ORDER BY RANDOM() if optimization fails
      const result = await db
        .select()
        .from(questions)
        .where(eq(questions.topicId, topicId))
        .orderBy(sql`RANDOM()`)
        .limit(count);
      
      return result;
    }
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getAvailableTopicsForDate(date: string): Promise<{ id: string; name: string; }[]> {
    try {
      const activeTopics = await db.select({
        id: assessmentSchedules.topicId,
        name: assessmentSchedules.topicName
      })
      .from(assessmentSchedules)
      .where(
        and(
          eq(assessmentSchedules.assessmentDate, date),
          eq(assessmentSchedules.isActive, true)
        )
      )
      .orderBy(assessmentSchedules.topicId);

      return activeTopics;
    } catch (error) {
      console.error("Error fetching available topics for date:", error);
      return [];
    }
  }

  async getQuestionsForAssessmentDate(date: string, topicId: string, count: number = 10): Promise<Question[]> {
    try {
      // First check if this topic is available for the specified date
      const topicAvailable = await db.select()
        .from(assessmentSchedules)
        .where(
          and(
            eq(assessmentSchedules.assessmentDate, date),
            eq(assessmentSchedules.topicId, topicId),
            eq(assessmentSchedules.isActive, true)
          )
        )
        .limit(1);

      if (topicAvailable.length === 0) {
        console.log(`Topic ${topicId} not available for date ${date}`);
        return [];
      }

      // Get random questions for this topic
      return await this.getRandomQuestionsByTopic(topicId, count);
    } catch (error) {
      console.error("Error fetching questions for assessment date:", error);
      return [];
    }
  }

  async getAllFeedbackQuestions(): Promise<FeedbackQuestion[]> {
    const cacheKey = getCacheKey.feedbackQuestions();
    const cached = feedbackCache.get<FeedbackQuestion[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await db.select().from(feedbackQuestions);
    feedbackCache.set(cacheKey, result);
    return result;
  }

  async createFeedbackQuestion(feedbackQuestion: InsertFeedbackQuestion): Promise<FeedbackQuestion> {
    const [newFeedbackQuestion] = await db.insert(feedbackQuestions).values(feedbackQuestion).returning();
    return newFeedbackQuestion;
  }

  async checkTopicExists(topicName: string, mobile: string): Promise<boolean> {
    const [result] = await db
      .select({ count: count() })
      .from(topicFeedback)
      .where(
        and(
          eq(topicFeedback.topicName, topicName),
          eq(topicFeedback.mobile, mobile)
        )
      );
    return (result?.count || 0) > 0;
  }

  async submitExamResult(result: InsertExamResult): Promise<ExamResult> {
    const [newResult] = await db.insert(examResults).values(result).returning();
    return newResult;
  }

  async submitExamAnswers(answers: InsertExamAnswer[]): Promise<ExamAnswer[]> {
    const newAnswers = await db.insert(examAnswers).values(answers).returning();
    return newAnswers;
  }

  async checkExamExists(mobile: string, topicId: string, date: string): Promise<boolean> {
    const cacheKey = getCacheKey.examExists(mobile, topicId, date);
    const cached = cache.get<boolean>(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const [result] = await db
      .select({ count: count() })
      .from(examResults)
      .where(
        and(
          eq(examResults.mobile, mobile),
          eq(examResults.topicId, topicId),
          eq(examResults.assessmentDate, date)
        )
      );
    
    const exists = (result?.count || 0) > 0;
    cache.set(cacheKey, exists, 600); // 10 minutes
    return exists;
  }

  async getExamResult(mobile: string, topicId: string, date?: string): Promise<ExamResult | undefined> {
    let whereCondition = and(
      eq(examResults.mobile, mobile),
      eq(examResults.topicId, topicId)
    );
    
    if (date) {
      whereCondition = and(whereCondition, eq(examResults.assessmentDate, date));
    }

    const [result] = await db
      .select()
      .from(examResults)
      .where(whereCondition);
    return result || undefined;
  }

  async getExamsByMobile(mobile: string): Promise<ExamResult[]> {
    return await db
      .select()
      .from(examResults)
      .where(eq(examResults.mobile, mobile))
      .orderBy(desc(examResults.submittedAt));
  }

  async submitTrainerFeedback(feedback: InsertTrainerFeedback[]): Promise<TrainerFeedback[]> {
    const newFeedback = await db.insert(trainerFeedback).values(feedback).returning();
    return newFeedback;
  }

  async createTopicFeedback(feedbackData: InsertTopicFeedback): Promise<TopicFeedback> {
    const [newTopicFeedback] = await db.insert(topicFeedback).values(feedbackData).returning();
    return newTopicFeedback;
  }

  async getExamStats(): Promise<{
    totalExams: number;
    averageScore: number;
    passRate: number;
  }> {
    const [totalExamsResult] = await db
      .select({ count: count() })
      .from(examResults);

    const [avgScoreResult] = await db
      .select({
        avgScore: sql<number>`AVG(CAST(correct_count AS FLOAT) / CAST(total_questions AS FLOAT) * 100)`
      })
      .from(examResults);

    const [passRateResult] = await db
      .select({
        passRate: sql<number>`AVG(CASE WHEN CAST(correct_count AS FLOAT) / CAST(total_questions AS FLOAT) >= 0.6 THEN 1.0 ELSE 0.0 END) * 100`
      })
      .from(examResults);

    return {
      totalExams: totalExamsResult?.count || 0,
      averageScore: Math.round((avgScoreResult?.avgScore || 0) * 10) / 10,
      passRate: Math.round((passRateResult?.passRate || 0) * 10) / 10,
    };
  }

  async getFeedbackStats(): Promise<{
    totalFeedback: number;
    averageRating: number;
    satisfactionRate: number;
  }> {
    const [totalFeedbackResult] = await db
      .select({ count: count() })
      .from(trainerFeedback);

    // This is a simplified calculation - in a real scenario, you'd need to parse feedback ratings
    return {
      totalFeedback: totalFeedbackResult?.count || 0,
      averageRating: 4.2, // Placeholder - would need proper rating calculation
      satisfactionRate: 89.7, // Placeholder - would need proper satisfaction calculation
    };
  }

  async getTeacherFeedback(mobile: string): Promise<any[]> {
    try {
      const feedbackRecords = await db
        .select({
          id: trainerFeedback.id,
          topicName: trainerFeedback.topicId,
          feedbackQue: trainerFeedback.feedbackQue,
          feedback: trainerFeedback.feedback,
          batchName: trainerFeedback.batchName,
          district: trainerFeedback.district,
          createdAt: trainerFeedback.submittedAt,
        })
        .from(trainerFeedback)
        .where(eq(trainerFeedback.mobile, mobile))
        .orderBy(desc(trainerFeedback.submittedAt));

      return feedbackRecords;
    } catch (error) {
      console.error("Error fetching teacher feedback:", error);
      return [];
    }
  }

  async getSystemStats(): Promise<{
    totalTeachers: number;
    totalDistricts: number;
    totalBatches: number;
    totalSubjects: number;
    totalQuestions: number;
    totalAssessmentDates: number;
  }> {
    try {
      const [teachersCount] = await db.select({ count: count() }).from(teachers);
      const [batchesCount] = await db.select({ count: count() }).from(batches);
      const [questionsCount] = await db.select({ count: count() }).from(questions);
      const [assessmentDatesCount] = await db.select({ count: count() }).from(assessmentSchedules);
      
      // Get unique districts from teachers table
      const districts = await db.selectDistinct({ district: teachers.district }).from(teachers);
      
      // Get unique subjects from questions table
      const subjects = await db.selectDistinct({ topicId: questions.topicId }).from(questions);

      return {
        totalTeachers: teachersCount?.count || 0,
        totalDistricts: districts.length || 0,
        totalBatches: batchesCount?.count || 0,
        totalSubjects: subjects.length || 0,
        totalQuestions: questionsCount?.count || 0,
        totalAssessmentDates: assessmentDatesCount?.count || 0,
      };
    } catch (error) {
      console.error("Error fetching system stats:", error);
      return {
        totalTeachers: 0,
        totalDistricts: 0,
        totalBatches: 0,
        totalSubjects: 0,
        totalQuestions: 0,
        totalAssessmentDates: 0,
      };
    }
  }

  async getAssessmentControlDates(): Promise<{ date: string; isActive: boolean; topics: { id: string; name: string; isActive: boolean; }[]; }[]> {
    try {
      // Get all unique dates from assessment schedules
      const dates = await db.selectDistinct({ 
        date: assessmentSchedules.assessmentDate 
      }).from(assessmentSchedules);

      // Get all unique topics from questions
      const allTopics = await db.selectDistinct({ 
        topicId: questions.topicId,
        topicName: questions.topic
      }).from(questions).orderBy(questions.topicId);

      // Build the result structure
      const result = [];
      
      for (const dateItem of dates) {
        const dateStr = dateItem.date;
        
        // Check if this date is generally active (if any schedule for this date is active)
        const activeDateCheck = await db.select({
          isActive: assessmentSchedules.isActive
        }).from(assessmentSchedules)
        .where(eq(assessmentSchedules.assessmentDate, dateStr))
        .limit(1);

        const isDateActive = activeDateCheck.length > 0 ? activeDateCheck[0].isActive : true;

        // Get topic associations for this date
        const dateTopics = await db.select({
          topicId: assessmentSchedules.topicId,
          topicName: assessmentSchedules.topicName,
          isActive: assessmentSchedules.isActive
        }).from(assessmentSchedules)
        .where(eq(assessmentSchedules.assessmentDate, dateStr));

        // Create a map of existing topic associations
        const topicMap = new Map();
        dateTopics.forEach(topic => {
          topicMap.set(topic.topicId, {
            id: topic.topicId,
            name: `${topic.topicId}: ${topic.topicName}`,
            isActive: topic.isActive
          });
        });

        // Include all available topics, marking those not associated as inactive
        const topics = allTopics.map(topic => {
          return topicMap.get(topic.topicId) || {
            id: topic.topicId,
            name: `${topic.topicId}: ${topic.topicName || topic.topicId}`,
            isActive: false
          };
        });

        result.push({
          date: dateStr,
          isActive: isDateActive,
          topics: topics
        });
      }

      return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error("Error fetching assessment control dates:", error);
      return [];
    }
  }

  async getAssessmentControlTopics(): Promise<{ id: string; name: string; isActive: boolean; }[]> {
    try {
      const topics = await db.selectDistinct({
        id: questions.topicId,
        name: questions.topic
      })
      .from(questions)
      .orderBy(questions.topicId);
      
      return topics.map(topic => ({
        id: topic.id,
        name: topic.name || topic.id,
        isActive: true // Default to active - can be enhanced later for global topic control
      }));
    } catch (error) {
      console.error("Error fetching assessment control topics:", error);
      return [];
    }
  }

  async updateAssessmentDateStatus(date: string, isActive: boolean): Promise<void> {
    try {
      await db.update(assessmentSchedules)
        .set({ isActive })
        .where(eq(assessmentSchedules.assessmentDate, date));
    } catch (error) {
      console.error(`Error updating date status for ${date}:`, error);
      throw error;
    }
  }

  async updateTopicActiveStatus(topicId: string, isActive: boolean): Promise<void> {
    try {
      await db.update(assessmentSchedules)
        .set({ isActive })
        .where(eq(assessmentSchedules.topicId, topicId));
      
      console.log(`Topic ${topicId} active status updated to ${isActive}`);
    } catch (error) {
      console.error(`Error updating topic status for ${topicId}:`, error);
      throw error;
    }
  }

  async updateDateTopicAssociation(date: string, topicId: string, isActive: boolean): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        // Check if association exists
        const existing = await db.select()
          .from(assessmentSchedules)
          .where(
            and(
              eq(assessmentSchedules.assessmentDate, date),
              eq(assessmentSchedules.topicId, topicId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing association
          await db.update(assessmentSchedules)
            .set({ isActive })
            .where(
              and(
                eq(assessmentSchedules.assessmentDate, date),
                eq(assessmentSchedules.topicId, topicId)
              )
            );
        } else if (isActive) {
          // Create new association only if activating
          // Get topic name from questions table
          const topicInfo = await db.select({
            name: questions.topic
          })
          .from(questions)
          .where(eq(questions.topicId, topicId))
          .limit(1);

          const topicName = topicInfo.length > 0 ? topicInfo[0].name : topicId;

          await db.insert(assessmentSchedules).values({
            assessmentDate: date,
            topicId: topicId,
            topicName: topicName,
            isActive: true
          });
        }
        
        console.log(`Date-Topic association updated: ${date} - ${topicId} -> ${isActive}`);
        return; // Success, exit retry loop
        
      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} failed for ${date}-${topicId}:`, error);
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to update topic association after ${maxRetries} attempts`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

export const storage = new DatabaseStorage();
