import { db } from "./db";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";
import {
  users, teachers, batches, batchTeachers, questions, feedbackQuestions,
  examResults, examAnswers, trainerFeedback, topicFeedback,
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
  checkPaymentId(payId: string): Promise<boolean>;

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
  createQuestion(question: InsertQuestion): Promise<Question>;

  // Feedback questions
  getAllFeedbackQuestions(): Promise<FeedbackQuestion[]>;
  createFeedbackQuestion(feedbackQuestion: InsertFeedbackQuestion): Promise<FeedbackQuestion>;

  // Exam management
  checkTopicExists(topicName: string, mobile: string): Promise<boolean>;
  submitExamResult(result: InsertExamResult): Promise<ExamResult>;
  submitExamAnswers(answers: InsertExamAnswer[]): Promise<ExamAnswer[]>;
  getExamResult(mobile: string, topicId: string): Promise<ExamResult | undefined>;

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

  async checkPaymentId(payId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: count() })
      .from(teachers)
      .where(eq(teachers.payId, payId));
    return (result?.count || 0) > 0;
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
    return result.rowCount > 0;
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

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async getAllFeedbackQuestions(): Promise<FeedbackQuestion[]> {
    return await db.select().from(feedbackQuestions);
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

  async getExamResult(mobile: string, topicId: string): Promise<ExamResult | undefined> {
    const [result] = await db
      .select()
      .from(examResults)
      .where(
        and(
          eq(examResults.mobile, mobile),
          eq(examResults.topicId, topicId)
        )
      );
    return result || undefined;
  }

  async submitTrainerFeedback(feedback: InsertTrainerFeedback[]): Promise<TrainerFeedback[]> {
    const newFeedback = await db.insert(trainerFeedback).values(feedback).returning();
    return newFeedback;
  }

  async createTopicFeedback(topicFeedback: InsertTopicFeedback): Promise<TopicFeedback> {
    const [newTopicFeedback] = await db.insert(topicFeedback).values(topicFeedback).returning();
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
}

export const storage = new DatabaseStorage();
