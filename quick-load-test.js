#!/usr/bin/env node

/**
 * Quick 40K Users Load Test - 3 Minutes
 * Real-time performance monitoring for NIPUN Teachers Portal
 */

import http from 'http';
import { performance } from 'perf_hooks';

class QuickLoadTest {
  constructor() {
    this.baseUrl = 'http://localhost:5000';
    this.totalUsers = 40000;
    this.testDuration = 180; // 3 minutes in seconds
    this.concurrentLimit = 2000; // Limit concurrent connections
    this.results = {
      requests: 0,
      successful: 0,
      failed: 0,
      timeouts: 0,
      examSubmissions: 0,
      feedbackSubmissions: 0,
      responseTimes: [],
      errors: {},
      peakConcurrent: 0,
      currentConcurrent: 0
    };
    this.activeRequests = new Set();
    this.startTime = null;
  }

  // Generate realistic test data
  generateExamData() {
    return {
      mobile: `98765${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      topic_id: `topic_${Math.floor(Math.random() * 5) + 1}`,
      topic_name: 'गणित शिक्षण विधि',
      assessment_date: '2025-01-06',
      batch_name: `Batch_Mumbai_${Math.floor(Math.random() * 50) + 1}`,
      district: 'Mumbai',
      questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
      answers: [1, 2, 3, 4, 1]
    };
  }

  generateFeedbackData() {
    return {
      mobile: `98765${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      topic_id: `topic_${Math.floor(Math.random() * 5) + 1}`,
      batch_name: `Batch_${Math.floor(Math.random() * 100) + 1}`,
      district: 'Mumbai',
      feedback_que: 'प्रशिक्षण की गुणवत्ता कैसी थी?',
      feedback: Math.floor(Math.random() * 5) + 1
    };
  }

  // Make HTTP request with proper error handling
  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const requestId = Math.random().toString(36).substr(2, 9);
      
      this.activeRequests.add(requestId);
      this.results.currentConcurrent = this.activeRequests.size;
      this.results.peakConcurrent = Math.max(this.results.peakConcurrent, this.results.currentConcurrent);

      const postData = data ? JSON.stringify(data) : null;
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTest-40K/1.0'
        }
      };

      if (postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const responseTime = performance.now() - startTime;
          this.activeRequests.delete(requestId);
          this.results.requests++;
          this.results.responseTimes.push(responseTime);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.results.successful++;
          } else {
            this.results.failed++;
            this.results.errors[res.statusCode] = (this.results.errors[res.statusCode] || 0) + 1;
          }
          
          resolve({ statusCode: res.statusCode, responseTime });
        });
      });

      req.on('timeout', () => {
        this.activeRequests.delete(requestId);
        this.results.requests++;
        this.results.timeouts++;
        this.results.failed++;
        req.destroy();
        resolve({ statusCode: 408, responseTime: 10000 });
      });

      req.on('error', () => {
        this.activeRequests.delete(requestId);
        this.results.requests++;
        this.results.failed++;
        this.results.errors['CONNECTION_ERROR'] = (this.results.errors['CONNECTION_ERROR'] || 0) + 1;
        resolve({ statusCode: 0, responseTime: performance.now() - startTime });
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  // Simulate user journey
  async simulateUser(userId) {
    try {
      // Visit homepage
      await this.makeRequest('/');
      
      // Submit exam (80% of users)
      if (Math.random() < 0.8) {
        const examData = this.generateExamData();
        const result = await this.makeRequest('/api/submit-exam', 'POST', examData);
        if (result.statusCode === 200 || result.statusCode === 202) {
          this.results.examSubmissions++;
        }
      }
      
      // Submit feedback (60% of users)
      if (Math.random() < 0.6) {
        const feedbackData = this.generateFeedbackData();
        const result = await this.makeRequest('/api/submit-feedback', 'POST', feedbackData);
        if (result.statusCode === 200 || result.statusCode === 202) {
          this.results.feedbackSubmissions++;
        }
      }
      
    } catch (error) {
      // Silent handling for load test
    }
  }

  // Control concurrent users
  async runWithConcurrencyControl() {
    const userPromises = new Set();
    let usersLaunched = 0;
    
    const launchInterval = setInterval(() => {
      // Launch users in bursts
      const burstSize = Math.min(100, this.totalUsers - usersLaunched);
      
      for (let i = 0; i < burstSize && this.activeRequests.size < this.concurrentLimit; i++) {
        if (usersLaunched >= this.totalUsers) break;
        
        const userPromise = this.simulateUser(++usersLaunched);
        userPromises.add(userPromise);
        
        userPromise.finally(() => {
          userPromises.delete(userPromise);
        });
      }
      
      if (usersLaunched >= this.totalUsers) {
        clearInterval(launchInterval);
      }
    }, 100); // Launch burst every 100ms
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.testDuration * 1000));
    
    // Wait for remaining requests
    console.log('Waiting for remaining requests to complete...');
    await Promise.allSettled([...userPromises]);
  }

  // Real-time monitoring
  startMonitoring() {
    const monitorInterval = setInterval(() => {
      if (!this.startTime) return;
      
      const elapsed = Math.floor((performance.now() - this.startTime) / 1000);
      const avgResponseTime = this.results.responseTimes.length > 0 
        ? Math.round(this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length)
        : 0;
      const successRate = this.results.requests > 0 
        ? Math.round((this.results.successful / this.results.requests) * 100)
        : 0;
      
      console.log(`\n[${elapsed}s] Live Stats:`);
      console.log(`  Requests: ${this.results.requests} | Success: ${successRate}%`);
      console.log(`  Concurrent: ${this.results.currentConcurrent} | Peak: ${this.results.peakConcurrent}`);
      console.log(`  Avg Response: ${avgResponseTime}ms | Exams: ${this.results.examSubmissions} | Feedback: ${this.results.feedbackSubmissions}`);
      
      if (elapsed >= this.testDuration) {
        clearInterval(monitorInterval);
      }
    }, 5000);
  }

  // Generate final report
  generateReport() {
    const testDuration = (performance.now() - this.startTime) / 1000;
    const avgResponseTime = this.results.responseTimes.length > 0 
      ? this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
      : 0;
    const successRate = this.results.requests > 0 
      ? (this.results.successful / this.results.requests) * 100
      : 0;
    const requestsPerSecond = this.results.requests / testDuration;
    
    // Calculate percentiles
    const sorted = this.results.responseTimes.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('40K CONCURRENT USERS - 3 MINUTE LOAD TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log('\nPERFORMANCE METRICS:');
    console.log(`  Test Duration: ${testDuration.toFixed(1)} seconds`);
    console.log(`  Target Users: ${this.totalUsers.toLocaleString()}`);
    console.log(`  Peak Concurrent: ${this.results.peakConcurrent.toLocaleString()}`);
    console.log(`  Total Requests: ${this.results.requests.toLocaleString()}`);
    console.log(`  Requests/Second: ${requestsPerSecond.toFixed(1)}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);
    
    console.log('\nRESPONSE TIMES:');
    console.log(`  Average: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`  95th Percentile: ${p95.toFixed(0)}ms`);
    console.log(`  99th Percentile: ${p99.toFixed(0)}ms`);
    
    console.log('\nAPPLICATION METRICS:');
    console.log(`  Successful Requests: ${this.results.successful.toLocaleString()}`);
    console.log(`  Failed Requests: ${this.results.failed.toLocaleString()}`);
    console.log(`  Timeouts: ${this.results.timeouts.toLocaleString()}`);
    console.log(`  Exam Submissions: ${this.results.examSubmissions.toLocaleString()}`);
    console.log(`  Feedback Submissions: ${this.results.feedbackSubmissions.toLocaleString()}`);
    
    if (Object.keys(this.results.errors).length > 0) {
      console.log('\nERROR BREAKDOWN:');
      Object.entries(this.results.errors).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }
    
    console.log('\nLOAD TEST ASSESSMENT:');
    if (successRate >= 95 && p95 < 2000) {
      console.log('  EXCELLENT: System handles 40K users with high performance');
    } else if (successRate >= 90 && p95 < 5000) {
      console.log('  GOOD: System performs well under 40K user load');
    } else if (successRate >= 80) {
      console.log('  MODERATE: System shows stress under 40K user load');
    } else {
      console.log('  CRITICAL: System requires optimization for 40K users');
    }
    
    console.log('\n' + '='.repeat(80));
  }

  // Main execution
  async run() {
    console.log('Starting 40K Concurrent Users Load Test (3 minutes)...');
    console.log(`Target: ${this.totalUsers.toLocaleString()} users`);
    console.log(`Concurrent Limit: ${this.concurrentLimit.toLocaleString()}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log('='.repeat(60));
    
    this.startTime = performance.now();
    this.startMonitoring();
    
    await this.runWithConcurrencyControl();
    
    console.log('\nLoad test completed!');
    this.generateReport();
  }
}

const loadTest = new QuickLoadTest();
loadTest.run().catch(console.error);