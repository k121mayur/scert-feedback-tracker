/**
 * Advanced Connection Optimization for Load Testing
 * Addresses I/O bottlenecks and connection management issues
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface ConnectionMetrics {
  activeConnections: number;
  pendingConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  memoryUsage: number;
  connectionErrors: number;
}

class ConnectionOptimizer extends EventEmitter {
  private metrics: ConnectionMetrics = {
    activeConnections: 0,
    pendingConnections: 0,
    failedConnections: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    connectionErrors: 0
  };

  private responseTimes: number[] = [];
  private connectionStartTimes = new Map<string, number>();
  private maxResponseTimes = 1000; // Keep last 1000 response times

  constructor() {
    super();
    this.setMaxListeners(0); // Remove listener limit for high concurrency
    this.startMetricsCollection();
  }

  // Track connection lifecycle
  trackConnectionStart(connectionId: string): void {
    this.connectionStartTimes.set(connectionId, performance.now());
    this.metrics.activeConnections++;
    this.metrics.pendingConnections++;
  }

  trackConnectionEnd(connectionId: string, success: boolean = true): void {
    const startTime = this.connectionStartTimes.get(connectionId);
    if (startTime) {
      const responseTime = performance.now() - startTime;
      this.addResponseTime(responseTime);
      this.connectionStartTimes.delete(connectionId);
    }

    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.pendingConnections = Math.max(0, this.metrics.pendingConnections - 1);

    if (!success) {
      this.metrics.failedConnections++;
      this.metrics.connectionErrors++;
    }
  }

  private addResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
    
    // Calculate average response time
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, t) => sum + t, 0) / this.responseTimes.length;
  }

  // Get optimization recommendations based on current metrics
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.averageResponseTime > 1000) {
      recommendations.push('High response times detected - consider reducing connection pool size');
    }

    if (this.metrics.failedConnections > 100) {
      recommendations.push('High connection failure rate - check database connection limits');
    }

    if (this.metrics.memoryUsage > 1000) {
      recommendations.push('High memory usage - implement connection pooling optimization');
    }

    if (this.metrics.activeConnections > 500) {
      recommendations.push('High concurrent connections - consider implementing queue throttling');
    }

    return recommendations;
  }

  // Apply automatic optimizations
  applyAutoOptimizations(): void {
    // Garbage collection optimization
    if (global.gc && this.metrics.memoryUsage > 800) {
      global.gc();
    }

    // Clean up old connection tracking
    const now = performance.now();
    for (const [id, startTime] of this.connectionStartTimes.entries()) {
      if (now - startTime > 60000) { // 60 second timeout
        this.connectionStartTimes.delete(id);
        this.metrics.connectionErrors++;
      }
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      // Update memory usage
      const usage = process.memoryUsage();
      this.metrics.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024); // MB

      // Apply auto optimizations
      this.applyAutoOptimizations();

      // Emit metrics for monitoring
      this.emit('metrics', this.metrics);
    }, 5000); // Every 5 seconds
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  // Reset metrics for fresh testing
  resetMetrics(): void {
    this.metrics = {
      activeConnections: 0,
      pendingConnections: 0,
      failedConnections: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      connectionErrors: 0
    };
    this.responseTimes = [];
    this.connectionStartTimes.clear();
  }

  // Get detailed connection health status
  getConnectionHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check response time health
    if (this.metrics.averageResponseTime > 2000) {
      issues.push('Very high response times');
      score -= 30;
    } else if (this.metrics.averageResponseTime > 1000) {
      issues.push('High response times');
      score -= 15;
    }

    // Check failure rate
    const failureRate = this.metrics.connectionErrors / (this.metrics.activeConnections + this.metrics.failedConnections + 1);
    if (failureRate > 0.1) {
      issues.push('High connection failure rate');
      score -= 25;
    }

    // Check memory usage
    if (this.metrics.memoryUsage > 1000) {
      issues.push('High memory usage');
      score -= 20;
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) status = 'healthy';
    else if (score >= 60) status = 'warning';
    else status = 'critical';

    return { status, score, issues };
  }
}

export const connectionOptimizer = new ConnectionOptimizer();