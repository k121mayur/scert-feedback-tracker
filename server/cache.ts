import NodeCache from 'node-cache';

// In-memory cache for high-frequency data
export const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Better performance
  maxKeys: 10000, // Limit memory usage
});

// Specialized caches for different data types
export const questionCache = new NodeCache({
  stdTTL: 3600, // 1 hour for questions (rarely change)
  checkperiod: 300,
  useClones: false,
  maxKeys: 5000,
});

export const assessmentCache = new NodeCache({
  stdTTL: 1800, // 30 minutes for assessment schedules
  checkperiod: 120,
  useClones: false,
  maxKeys: 1000,
});

export const feedbackCache = new NodeCache({
  stdTTL: 3600, // 1 hour for feedback questions
  checkperiod: 300,
  useClones: false,
  maxKeys: 100,
});

// Cache key generators
export const getCacheKey = {
  questions: (topicId: string) => `questions:${topicId}`,
  randomQuestions: (topicId: string, count: number) => `random_questions:${topicId}:${count}`,
  assessmentDates: () => 'assessment_dates',
  assessmentsByDate: (date: string) => `assessments:${date}`,
  feedbackQuestions: () => 'feedback_questions',
  examExists: (mobile: string, topicId: string, date: string) => `exam_exists:${mobile}:${topicId}:${date}`,
  topicExists: (topicName: string, mobile: string) => `topic_exists:${topicName}:${mobile}`,
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