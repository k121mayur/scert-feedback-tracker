import { pgTable, text, serial, integer, boolean, timestamp, varchar, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users/Teachers table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Teachers table
export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  teacherId: text("teacher_id"),
  teacherName: text("teacher_name").notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull(),
  payId: text("pay_id"),
  district: text("district"),
  serviceType: text("service_type"),
  trainingGroup: text("training_group"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    mobileIdx: index("idx_teachers_mobile").on(table.mobile),
    teacherIdIdx: index("idx_teachers_teacher_id").on(table.teacherId),
    districtIdx: index("idx_teachers_district").on(table.district),
  };
});

// Batches table
export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  batchName: text("batch_name").notNull().unique(),
  district: text("district").notNull(),
  coordinatorName: text("coordinator_name").notNull(),
  serviceType: text("service_type").notNull(),
  trainingGroup: text("training_group").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assessment schedules table
export const assessmentSchedules = pgTable("assessment_schedules", {
  id: serial("id").primaryKey(),
  assessmentDate: date("assessment_date").notNull(),
  topicId: text("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    dateIdx: index("idx_assessment_date").on(table.assessmentDate),
    topicIdIdx: index("idx_assessment_topic_id").on(table.topicId),
    activeIdx: index("idx_assessment_active").on(table.isActive),
    dateTopicIdx: index("idx_assessment_date_topic").on(table.assessmentDate, table.topicId),
  };
});

// Batch teachers relation table
export const batchTeachers = pgTable("batch_teachers", {
  id: serial("id").primaryKey(),
  batchName: text("batch_name").notNull(),
  district: text("district").notNull(),
  teacherId: text("teacher_id"),
  teacherName: text("teacher_name").notNull(),
  teacherMobile: varchar("teacher_mobile", { length: 15 }).notNull(),
  serviceType: text("service_type"),
  trainingGroup: text("training_group"),
  topicId: text("topic_id"),
  registerId: text("register_id"),
  stopTime: timestamp("stop_time"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    // Critical indexes for high-load mobile lookups
    mobileIdx: index("idx_batch_teachers_mobile").on(table.teacherMobile),
    mobileTopicIdx: index("idx_batch_teachers_mobile_topic").on(table.teacherMobile, table.topicId),
    batchNameIdx: index("idx_batch_teachers_batch_name").on(table.batchName),
    districtIdx: index("idx_batch_teachers_district").on(table.district),
    teacherIdIdx: index("idx_batch_teachers_teacher_id").on(table.teacherId),
  };
});

// Questions table
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  topicId: text("topic_id").notNull(),
  question: text("question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctAnswer: varchar("correct_answer", { length: 1 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    topicIdIdx: index("idx_questions_topic_id").on(table.topicId),
    createdAtIdx: index("idx_questions_created_at").on(table.createdAt),
  };
});

// Feedback questions table
export const feedbackQuestions = pgTable("feedback_questions", {
  id: serial("id").primaryKey(),
  feedbackQues: text("feedback_ques").notNull(),
  option1: text("option1").notNull(),
  option2: text("option2").notNull(),
  option3: text("option3").notNull(),
  option4: text("option4").notNull(),
  option5: text("option5").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exam results table
export const examResults = pgTable("exam_results", {
  id: serial("id").primaryKey(),
  mobile: varchar("mobile", { length: 10 }).notNull(),
  topicId: text("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  assessmentDate: date("assessment_date").notNull(),
  batchName: text("batch_name").notNull(),
  district: text("district").notNull(),
  registerId: text("register_id"),
  correctCount: integer("correct_count").notNull().default(0),
  wrongCount: integer("wrong_count").notNull().default(0),
  unansweredCount: integer("unanswered_count").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(5),
  submittedAt: timestamp("submitted_at").defaultNow(),
}, (table) => {
  return {
    mobileIdx: index("idx_exam_results_mobile").on(table.mobile),
    topicIdIdx: index("idx_exam_results_topic_id").on(table.topicId),
    assessmentDateIdx: index("idx_exam_results_assessment_date").on(table.assessmentDate),
    mobileTopicDateIdx: index("idx_exam_results_mobile_topic_date").on(table.mobile, table.topicId, table.assessmentDate),
    submittedAtIdx: index("idx_exam_results_submitted_at").on(table.submittedAt),
  };
});

// Exam answers table
export const examAnswers = pgTable("exam_answers", {
  id: serial("id").primaryKey(),
  mobile: varchar("mobile", { length: 10 }).notNull(),
  topicId: text("topic_id").notNull(),
  question: text("question").notNull(),
  selectedAnswer: varchar("selected_answer", { length: 1 }),
  correctAnswer: varchar("correct_answer", { length: 1 }).notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  submittedAt: timestamp("submitted_at").defaultNow(),
}, (table) => {
  return {
    // Critical indexes for 40K concurrent users
    mobileTopicIdx: index("idx_exam_answers_mobile_topic").on(table.mobile, table.topicId),
    mobileIdx: index("idx_exam_answers_mobile").on(table.mobile),
    topicIdIdx: index("idx_exam_answers_topic_id").on(table.topicId),
    submittedAtIdx: index("idx_exam_answers_submitted_at").on(table.submittedAt),
  };
});

// Trainer feedback table
export const trainerFeedback = pgTable("trainer_feedback", {
  id: serial("id").primaryKey(),
  topicId: text("topic_id").notNull(),
  mobile: varchar("mobile", { length: 10 }).notNull(),
  feedbackQue: text("feedback_que").notNull(),
  feedback: text("feedback").notNull(),
  batchName: text("batch_name").notNull(),
  district: text("district").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
}, (table) => {
  return {
    // Indexes for feedback analytics and retrieval
    mobileIdx: index("idx_trainer_feedback_mobile").on(table.mobile),
    topicIdIdx: index("idx_trainer_feedback_topic_id").on(table.topicId),
    submittedAtIdx: index("idx_trainer_feedback_submitted_at").on(table.submittedAt),
  };
});

// Topic feedback table (for duplicate checking)
export const topicFeedback = pgTable("tot_feedback", {
  id: serial("id").primaryKey(),
  topicName: text("topic_name").notNull(),
  mobile: varchar("mobile", { length: 10 }).notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// Relations
export const teachersRelations = relations(teachers, ({ many }) => ({
  examResults: many(examResults),
  examAnswers: many(examAnswers),
  trainerFeedback: many(trainerFeedback),
}));

export const batchesRelations = relations(batches, ({ many }) => ({
  batchTeachers: many(batchTeachers),
}));

export const batchTeachersRelations = relations(batchTeachers, ({ one }) => ({
  batch: one(batches, {
    fields: [batchTeachers.batchName],
    references: [batches.batchName],
  }),
}));

export const questionsRelations = relations(questions, ({ many }) => ({
  examAnswers: many(examAnswers),
}));

export const examResultsRelations = relations(examResults, ({ one, many }) => ({
  teacher: one(teachers, {
    fields: [examResults.mobile],
    references: [teachers.mobile],
  }),
  answers: many(examAnswers),
}));

export const examAnswersRelations = relations(examAnswers, ({ one }) => ({
  examResult: one(examResults, {
    fields: [examAnswers.mobile, examAnswers.topicId],
    references: [examResults.mobile, examResults.topicId],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  createdAt: true,
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
});

export const insertBatchTeacherSchema = createInsertSchema(batchTeachers).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export const insertFeedbackQuestionSchema = createInsertSchema(feedbackQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertExamResultSchema = createInsertSchema(examResults).omit({
  id: true,
  submittedAt: true,
}).extend({
  assessmentDate: z.string(),
});

export const insertExamAnswerSchema = createInsertSchema(examAnswers).omit({
  id: true,
  submittedAt: true,
}).extend({
  selectedAnswer: z.string().nullable(),
});

export const insertTrainerFeedbackSchema = createInsertSchema(trainerFeedback).omit({
  id: true,
  submittedAt: true,
});

export const insertTopicFeedbackSchema = createInsertSchema(topicFeedback).omit({
  id: true,
  submittedAt: true,
});

export const insertAssessmentScheduleSchema = createInsertSchema(assessmentSchedules).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;

export type BatchTeacher = typeof batchTeachers.$inferSelect;
export type InsertBatchTeacher = z.infer<typeof insertBatchTeacherSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type FeedbackQuestion = typeof feedbackQuestions.$inferSelect;
export type InsertFeedbackQuestion = z.infer<typeof insertFeedbackQuestionSchema>;

export type ExamResult = typeof examResults.$inferSelect;
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;

export type ExamAnswer = typeof examAnswers.$inferSelect;
export type InsertExamAnswer = z.infer<typeof insertExamAnswerSchema>;

export type TrainerFeedback = typeof trainerFeedback.$inferSelect;
export type InsertTrainerFeedback = z.infer<typeof insertTrainerFeedbackSchema>;

export type TopicFeedback = typeof topicFeedback.$inferSelect;
export type InsertTopicFeedback = z.infer<typeof insertTopicFeedbackSchema>;

export type AssessmentSchedule = typeof assessmentSchedules.$inferSelect;
export type InsertAssessmentSchedule = z.infer<typeof insertAssessmentScheduleSchema>;
