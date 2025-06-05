import { pool, db } from './db';
import { cache, questionCache, assessmentCache } from './cache';

interface LoadMetrics {
  connectionUtilization: number;
  queryLatency: number;
  memoryUsage: number;
  queueDepth: number;
  errorRate: number;
}

interface OptimizationConfig {
  enableQueryCache: boolean;
  batchProcessing: boolean;
  connectionPoolScaling: boolean;
  queryOptimization: boolean;
}

export class ThirtyKLoadOptimizer {
  private config: OptimizationConfig = {
    enableQueryCache: true,
    batchProcessing: true,
    connectionPoolScaling: true,
    queryOptimization: true
  };

  private loadMetrics: LoadMetrics = {
    connectionUtilization: 0,
    queryLatency: 0,
    memoryUsage: 0,
    queueDepth: 0,
    errorRate: 0
  };

  // Optimized question retrieval for 30K concurrent requests
  async getOptimizedQuestions(topicId: string, count: number = 5) {
    const cacheKey = `questions_optimized_${topicId}_${count}`;
    const cached = questionCache.get(cacheKey);
    
    if (cached && this.config.enableQueryCache) {
      return cached;
    }

    try {
      // Use index-optimized query for high concurrency
      const result = await db.execute(
        `SELECT id, topic_id, topic, question, option_a, option_b, option_c, option_d, correct_option
         FROM questions 
         WHERE topic_id = $1 
         ORDER BY id 
         OFFSET floor(random() * (SELECT COUNT(*) FROM questions WHERE topic_id = $1))
         LIMIT $2`,
        [topicId, count]
      );

      questionCache.set(cacheKey, result.rows, 300); // 5 minute cache
      return result.rows;
    } catch (error) {
      console.error('Optimized question retrieval failed:', error);
      throw error;
    }
  }

  // Batch authentication for multiple mobile numbers
  async batchAuthenticateTeachers(mobileNumbers: string[]) {
    if (mobileNumbers.length === 0) return [];

    const cacheResults = [];
    const uncachedMobiles = [];

    // Check cache first
    for (const mobile of mobileNumbers) {
      const cacheKey = `teacher_auth_${mobile}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        cacheResults.push(cached);
      } else {
        uncachedMobiles.push(mobile);
      }
    }

    if (uncachedMobiles.length === 0) {
      return cacheResults;
    }

    try {
      // Batch query for uncached mobiles
      const placeholders = uncachedMobiles.map((_, i) => `$${i + 1}`).join(',');
      const result = await db.execute(
        `SELECT teacher_mobile, teacher_name, batch_name, district, service_type, training_group
         FROM batch_teachers 
         WHERE teacher_mobile IN (${placeholders})`,
        uncachedMobiles
      );

      // Cache results
      result.rows.forEach(teacher => {
        const cacheKey = `teacher_auth_${teacher.teacher_mobile}`;
        cache.set(cacheKey, teacher, 1800); // 30 minute cache
      });

      return [...cacheResults, ...result.rows];
    } catch (error) {
      console.error('Batch teacher authentication failed:', error);
      throw error;
    }
  }

  // Monitor system load and adjust optimizations
  async monitorAndOptimize() {
    try {
      // Get current connection stats
      const connectionStats = await this.getConnectionStats();
      const memoryStats = process.memoryUsage();
      
      this.loadMetrics.connectionUtilization = (connectionStats.totalConnections / 8000) * 100;
      this.loadMetrics.memoryUsage = memoryStats.heapUsed / 1024 / 1024; // MB

      // Auto-adjust cache settings based on load
      if (this.loadMetrics.connectionUtilization > 70) {
        // High load: aggressive caching
        questionCache.options.stdTTL = 600; // 10 minutes
        cache.options.stdTTL = 1800; // 30 minutes
        this.config.enableQueryCache = true;
      } else if (this.loadMetrics.connectionUtilization < 30) {
        // Low load: reduce caching
        questionCache.options.stdTTL = 300; // 5 minutes
        cache.options.stdTTL = 900; // 15 minutes
      }

      // Log critical metrics
      if (this.loadMetrics.connectionUtilization > 80) {
        console.warn(`High connection utilization: ${this.loadMetrics.connectionUtilization.toFixed(1)}%`);
      }

      if (this.loadMetrics.memoryUsage > 1500) {
        console.warn(`High memory usage: ${this.loadMetrics.memoryUsage.toFixed(1)}MB`);
      }

    } catch (error) {
      console.error('Load monitoring failed:', error);
    }
  }

  private async getConnectionStats() {
    return {
      totalConnections: pool.totalCount || 0,
      idleConnections: pool.idleCount || 0,
      waitingClients: pool.waitingCount || 0
    };
  }

  // Preload critical data for high-traffic periods
  async preloadCriticalData() {
    try {
      console.log('Preloading critical data for 30K user scenario...');

      // Preload assessment schedules
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `assessment_schedule_${today}`;
      
      const schedules = await db.execute(
        `SELECT assessment_date, topic_id, topic_name, is_active 
         FROM assessment_schedules 
         WHERE assessment_date >= $1 AND is_active = true 
         ORDER BY assessment_date`,
        [today]
      );

      assessmentCache.set(cacheKey, schedules.rows, 3600); // 1 hour cache

      // Preload popular questions by topic
      const popularTopics = await db.execute(
        `SELECT topic_id, COUNT(*) as usage_count 
         FROM exam_results 
         WHERE submitted_at >= NOW() - INTERVAL '7 days'
         GROUP BY topic_id 
         ORDER BY usage_count DESC 
         LIMIT 10`
      );

      for (const topic of popularTopics.rows) {
        await this.getOptimizedQuestions(topic.topic_id, 10);
      }

      console.log(`Preloaded data for ${popularTopics.rows.length} popular topics`);

    } catch (error) {
      console.error('Critical data preloading failed:', error);
    }
  }

  // Emergency load shedding for extreme situations
  async emergencyLoadShedding() {
    console.warn('Activating emergency load shedding...');

    // Reduce cache TTLs to free memory
    questionCache.options.stdTTL = 60; // 1 minute
    cache.options.stdTTL = 300; // 5 minutes
    assessmentCache.options.stdTTL = 180; // 3 minutes

    // Clear less critical caches
    cache.keys().forEach(key => {
      if (key.includes('stats') || key.includes('analytics')) {
        cache.del(key);
      }
    });

    // Enable strict query optimization
    this.config.queryOptimization = true;
    this.config.batchProcessing = true;

    console.log('Emergency optimizations activated');
  }

  // Get comprehensive load report
  getLoadReport() {
    return {
      timestamp: new Date().toISOString(),
      loadMetrics: this.loadMetrics,
      configuration: this.config,
      cacheStats: {
        questionCache: {
          keys: questionCache.keys().length,
          hits: questionCache.getStats().hits,
          misses: questionCache.getStats().misses
        },
        mainCache: {
          keys: cache.keys().length,
          hits: cache.getStats().hits,
          misses: cache.getStats().misses
        }
      },
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations() {
    const recommendations = [];

    if (this.loadMetrics.connectionUtilization > 75) {
      recommendations.push('Consider implementing read replicas for query distribution');
    }

    if (this.loadMetrics.memoryUsage > 1200) {
      recommendations.push('Memory usage approaching limits, consider cache optimization');
    }

    if (this.loadMetrics.queryLatency > 100) {
      recommendations.push('Query latency high, review index usage and query optimization');
    }

    return recommendations;
  }
}

export const thirtyKOptimizer = new ThirtyKLoadOptimizer();

// Auto-monitor every 30 seconds during high load periods
setInterval(() => {
  thirtyKOptimizer.monitorAndOptimize();
}, 30000);

// Preload critical data on startup
thirtyKOptimizer.preloadCriticalData();