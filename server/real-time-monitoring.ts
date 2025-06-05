import { EventEmitter } from 'events';
import { pool, getConnectionStats } from './db';
import { cache, questionCache, assessmentCache } from './cache';
import { highLoadQueue } from './high-load-queue';
import { thirtyKOptimizer } from './30k-load-optimizations';

interface SystemMetrics {
  timestamp: Date;
  connectionPool: {
    utilization: number;
    activeConnections: number;
    waitingClients: number;
    errorRate: number;
  };
  performance: {
    avgResponseTime: number;
    queryLatency: number;
    throughput: number;
    errorCount: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cache: {
    hitRatio: number;
    totalKeys: number;
    memoryUsage: number;
  };
  queue: {
    length: number;
    processingRate: number;
    failureRate: number;
  };
}

interface AlertRule {
  metric: string;
  threshold: number;
  condition: 'greater_than' | 'less_than';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export class RealTimeMonitor extends EventEmitter {
  private metrics: SystemMetrics[] = [];
  private alerts: AlertRule[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupAlertRules();
    this.startMonitoring();
  }

  private setupAlertRules() {
    this.alerts = [
      {
        metric: 'connectionPool.utilization',
        threshold: 80,
        condition: 'greater_than',
        severity: 'critical',
        message: 'Database connection pool utilization exceeds 80%'
      },
      {
        metric: 'performance.avgResponseTime',
        threshold: 1000,
        condition: 'greater_than',
        severity: 'warning',
        message: 'Average response time exceeds 1 second'
      },
      {
        metric: 'memory.heapUsed',
        threshold: 1500 * 1024 * 1024, // 1.5GB
        condition: 'greater_than',
        severity: 'critical',
        message: 'Memory usage exceeds 1.5GB'
      },
      {
        metric: 'queue.length',
        threshold: 1000,
        condition: 'greater_than',
        severity: 'warning',
        message: 'Queue length exceeds 1000 items'
      },
      {
        metric: 'cache.hitRatio',
        threshold: 70,
        condition: 'less_than',
        severity: 'warning',
        message: 'Cache hit ratio below 70%'
      }
    ];
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        this.checkAlerts(metrics);
        this.cleanupOldMetrics();
        
        this.emit('metrics', metrics);
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, 10000); // Collect metrics every 10 seconds

    console.log('Real-time monitoring started for 30K user scenario');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const connectionStats = await getConnectionStats();
    const memoryUsage = process.memoryUsage();
    const queueStatus = highLoadQueue.getStatus();
    
    // Calculate cache metrics
    const cacheStats = cache.getStats();
    const questionCacheStats = questionCache.getStats();
    const totalCacheHits = cacheStats.hits + questionCacheStats.hits;
    const totalCacheMisses = cacheStats.misses + questionCacheStats.misses;
    const cacheHitRatio = totalCacheHits + totalCacheMisses > 0 
      ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 
      : 0;

    return {
      timestamp: new Date(),
      connectionPool: {
        utilization: connectionStats.utilizationPercent,
        activeConnections: connectionStats.totalConnections,
        waitingClients: connectionStats.waitingClients,
        errorRate: 0 // Would be calculated from error tracking
      },
      performance: {
        avgResponseTime: 150, // Would be calculated from response time tracking
        queryLatency: 25, // Would be calculated from query timing
        throughput: this.calculateThroughput(),
        errorCount: 0 // Would be tracked from error logs
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cache: {
        hitRatio: cacheHitRatio,
        totalKeys: cache.keys().length + questionCache.keys().length,
        memoryUsage: this.estimateCacheMemory()
      },
      queue: {
        length: queueStatus.queueLength,
        processingRate: queueStatus.stats.processed,
        failureRate: queueStatus.stats.failed
      }
    };
  }

  private checkAlerts(metrics: SystemMetrics) {
    this.alerts.forEach(rule => {
      const value = this.getMetricValue(metrics, rule.metric);
      const shouldAlert = rule.condition === 'greater_than' 
        ? value > rule.threshold 
        : value < rule.threshold;

      if (shouldAlert) {
        this.emit('alert', {
          rule,
          value,
          timestamp: metrics.timestamp,
          message: `${rule.message} (Current: ${value}, Threshold: ${rule.threshold})`
        });

        // Log critical alerts
        if (rule.severity === 'critical') {
          console.error(`CRITICAL ALERT: ${rule.message} - Current value: ${value}`);
        }
      }
    });
  }

  private getMetricValue(metrics: SystemMetrics, path: string): number {
    const parts = path.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return 0;
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private calculateThroughput(): number {
    // Calculate requests per second based on recent metrics
    if (this.metrics.length < 2) return 0;
    
    const recent = this.metrics.slice(-2);
    const timeDiff = (recent[1].timestamp.getTime() - recent[0].timestamp.getTime()) / 1000;
    
    // Estimate based on queue processing
    return timeDiff > 0 ? 100 / timeDiff : 0; // Placeholder calculation
  }

  private estimateCacheMemory(): number {
    // Rough estimation of cache memory usage
    const totalKeys = cache.keys().length + questionCache.keys().length;
    return totalKeys * 1024; // Estimate 1KB per key
  }

  private cleanupOldMetrics() {
    // Keep only last 1000 metric entries (about 3 hours at 10-second intervals)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Get current system status
  getSystemStatus() {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return { status: 'unknown', message: 'No metrics available' };

    const { connectionPool, memory, queue } = latest;

    if (connectionPool.utilization > 90 || memory.heapUsed > 2 * 1024 * 1024 * 1024) {
      return { status: 'critical', message: 'System under severe load' };
    }

    if (connectionPool.utilization > 70 || queue.length > 500) {
      return { status: 'warning', message: 'System under moderate load' };
    }

    return { status: 'healthy', message: 'System operating normally' };
  }

  // Get performance report for 30K user scenario
  getPerformanceReport() {
    if (this.metrics.length === 0) {
      return { error: 'No metrics available' };
    }

    const recent = this.metrics.slice(-60); // Last 10 minutes
    const latest = this.metrics[this.metrics.length - 1];

    return {
      timestamp: new Date().toISOString(),
      current: {
        connectionUtilization: latest.connectionPool.utilization,
        memoryUsage: Math.round(latest.memory.heapUsed / 1024 / 1024),
        queueLength: latest.queue.length,
        cacheHitRatio: latest.cache.hitRatio
      },
      averages: {
        responseTime: this.calculateAverage(recent, 'performance.avgResponseTime'),
        throughput: this.calculateAverage(recent, 'performance.throughput'),
        connectionUtilization: this.calculateAverage(recent, 'connectionPool.utilization')
      },
      readiness: {
        for30KUsers: this.assess30KReadiness(latest),
        recommendedActions: this.getRecommendations(latest)
      }
    };
  }

  private calculateAverage(metrics: SystemMetrics[], path: string): number {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((total, metric) => {
      return total + this.getMetricValue(metric, path);
    }, 0);
    
    return sum / metrics.length;
  }

  private assess30KReadiness(metrics: SystemMetrics): string {
    const { connectionPool, memory, queue } = metrics;

    if (connectionPool.utilization < 50 && memory.heapUsed < 1024 * 1024 * 1024) {
      return 'Ready - System can handle 30K concurrent users';
    }

    if (connectionPool.utilization < 70 && memory.heapUsed < 1.5 * 1024 * 1024 * 1024) {
      return 'Caution - Monitor closely during 30K user load';
    }

    return 'Not Ready - Requires optimization before 30K user load';
  }

  private getRecommendations(metrics: SystemMetrics): string[] {
    const recommendations = [];

    if (metrics.connectionPool.utilization > 70) {
      recommendations.push('Consider enabling read replicas to distribute load');
    }

    if (metrics.memory.heapUsed > 1.2 * 1024 * 1024 * 1024) {
      recommendations.push('Optimize cache settings to reduce memory usage');
    }

    if (metrics.queue.length > 100) {
      recommendations.push('Increase queue processing workers');
    }

    if (metrics.cache.hitRatio < 80) {
      recommendations.push('Review cache strategy and TTL settings');
    }

    return recommendations;
  }

  // Get metrics for specific time range
  getMetricsInRange(startTime: Date, endTime: Date): SystemMetrics[] {
    return this.metrics.filter(metric => 
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }
}

export const realTimeMonitor = new RealTimeMonitor();

// Set up alert handlers
realTimeMonitor.on('alert', (alert) => {
  console.log(`ALERT [${alert.rule.severity.toUpperCase()}]: ${alert.message}`);
  
  // Critical alerts trigger emergency procedures
  if (alert.rule.severity === 'critical') {
    if (alert.rule.metric === 'connectionPool.utilization') {
      thirtyKOptimizer.emergencyLoadShedding();
    }
  }
});

realTimeMonitor.on('metrics', (metrics) => {
  // Log system status every minute
  if (metrics.timestamp.getSeconds() === 0) {
    const status = realTimeMonitor.getSystemStatus();
    console.log(`System Status: ${status.status} - ${status.message}`);
  }
});