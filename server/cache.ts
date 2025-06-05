import NodeCache from 'node-cache';

// Enhanced in-memory cache for 40K concurrent users
export const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 30, // More frequent cleanup for high-load
  useClones: false, // Better performance, critical for 40K users
  maxKeys: 100000, // Significantly increased for high concurrency
  deleteOnExpire: true, // Automatic cleanup
  errorOnMissing: false,
});

// Specialized caches optimized for high-load
export const questionCache = new NodeCache({
  stdTTL: 7200, // 2 hours for questions (longer cache for stability)
  checkperiod: 120,
  useClones: false,
  maxKeys: 50000, // 10x increase for question caching
  deleteOnExpire: true,
});

export const assessmentCache = new NodeCache({
  stdTTL: 900, // 15 minutes for assessment schedules
  checkperiod: 60,
  useClones: false,
  maxKeys: 10000, // Increased for date-based caching
  deleteOnExpire: true,
});

export const feedbackCache = new NodeCache({
  stdTTL: 3600, // 1 hour for feedback questions
  checkperiod: 300,
  useClones: false,
  maxKeys: 1000, // Moderate increase
  deleteOnExpire: true,
});

// Session cache for exam state management
export const sessionCache = new NodeCache({
  stdTTL: 1800, // 30 minutes for active exam sessions
  checkperiod: 60,
  useClones: false,
  maxKeys: 50000, // Support for concurrent exam sessions
  deleteOnExpire: true,
});

// Enhanced cache key generators for high-load optimization
export const getCacheKey = {
  questions: (topicId: string) => `q:${topicId}`,
  randomQuestions: (topicId: string, count: number) => `rq:${topicId}:${count}`,
  assessmentDates: () => 'ad',
  assessmentsByDate: (date: string) => `abd:${date}`,
  feedbackQuestions: () => 'fq',
  examExists: (mobile: string, topicId: string, date: string) => `ee:${mobile}:${topicId}:${date}`,
  topicExists: (topicName: string, mobile: string) => `te:${topicName}:${mobile}`,
  examSession: (mobile: string, topicId: string) => `es:${mobile}:${topicId}`,
  teacherStats: (mobile: string) => `ts:${mobile}`,
  batchTeachers: (batchName: string) => `bt:${batchName}`,
  systemStats: () => 'ss',
  examAnswers: (mobile: string, topicId: string) => `ea:${mobile}:${topicId}`,
};

// Cache statistics for monitoring
export const getCacheStats = () => ({
  main: cache.getStats(),
  questions: questionCache.getStats(),
  assessments: assessmentCache.getStats(),
  feedback: feedbackCache.getStats(),
});

// Cache warming functions
export const warmCache = async () => {
  console.log('Warming up cache for high-load performance...');
  // These will be called on server startup
};