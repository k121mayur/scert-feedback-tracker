#!/usr/bin/env node

/**
 * 40K Concurrent Users Load Testing System
 * Simulates real-world usage patterns for NIPUN Teachers Portal
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';
import fs from 'fs';

class LoadTester40K {
  constructor() {
    this.baseUrl = process.env.REPL_URL || 'http://localhost:5000';
    this.totalUsers = 40000;
    this.batchSize = 1000; // Process users in batches
    this.concurrentBatches = 40; // 40 batches of 1000 users each
    this.testDuration = 180000; // 3 minutes
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errors: {},
      examSubmissions: 0,
      feedbackSubmissions: 0,
      queuedRequests: 0,
      concurrentUsers: 0,
      peakConcurrentUsers: 0
    };
    this.activeRequests = new Set();
    this.startTime = null;
  }

  // Generate realistic teacher mobile numbers
  generateMobileNumber() {
    const prefixes = ['9876', '9988', '9123', '8765', '7890', '6543'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return prefix + suffix;
  }

  // Generate realistic assessment data
  generateExamData() {
    const topics = [
      'गणित शिक्षण विधि',
      'हिंदी भाषा शिक्षण',
      'विज्ञान शिक्षण प्रणाली',
      'सामाजिक विज्ञान',
      'शिक्षा मनोविज्ञान'
    ];
    const districts = [
      'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad',
      'Solapur', 'Amravati', 'Kolhapur', 'Sangli', 'Satara'
    ];
    
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const district = districts[Math.floor(Math.random() * districts.length)];
    
    return {
      mobile: this.generateMobileNumber(),
      topic_id: `topic_${Math.floor(Math.random() * 5) + 1}`,
      topic_name: topic,
      assessment_date: '2025-01-06',
      batch_name: `Batch_${district}_${Math.floor(Math.random() * 50) + 1}`,
      district: district,
      questions: Array.from({length: 5}, (_, i) => `question_${i + 1}`),
      answers: Array.from({length: 5}, () => Math.floor(Math.random() * 4) + 1)
    };
  }

  // Generate feedback data
  generateFeedbackData() {
    const feedbackQuestions = [
      'प्रशिक्षण की गुणवत्ता कैसी थी?',
      'सामग्री कितनी उपयोगी थी?',
      'प्रशिक्षक की शिक्षण पद्धति कैसी थी?'
    ];
    
    return {
      mobile: this.generateMobileNumber(),
      topic_id: `topic_${Math.floor(Math.random() * 5) + 1}`,
      batch_name: `Batch_${Math.floor(Math.random() * 100) + 1}`,
      district: 'Mumbai',
      feedback_que: feedbackQuestions[Math.floor(Math.random() * feedbackQuestions.length)],
      feedback: Math.floor(Math.random() * 5) + 1 // Rating 1-5
    };
  }

  // Make HTTP request with timeout and retry logic
  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const requestId = Math.random().toString(36).substr(2, 9);
      
      this.activeRequests.add(requestId);
      this.results.concurrentUsers = this.activeRequests.size;
      this.results.peakConcurrentUsers = Math.max(this.results.peakConcurrentUsers, this.results.concurrentUsers);

      const url = new URL(path, this.baseUrl);
      const options = {
        method,
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTest-40K/1.0',
          'Connection': 'keep-alive'
        }
      };

      if (data) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
      }

      const client = url.protocol === 'https:' ? https : http;
      
      const req = client.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          this.activeRequests.delete(requestId);
          this.results.totalRequests++;
          this.results.responseTimes.push(responseTime);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.results.successfulRequests++;
          } else {
            this.results.failedRequests++;
            this.results.errors[res.statusCode] = (this.results.errors[res.statusCode] || 0) + 1;
          }
          
          this.updateResponseTimeStats(responseTime);
          resolve({ statusCode: res.statusCode, data: responseData, responseTime });
        });
      });

      req.on('timeout', () => {
        this.activeRequests.delete(requestId);
        this.results.totalRequests++;
        this.results.timeouts++;
        this.results.failedRequests++;
        req.destroy();
        resolve({ statusCode: 408, error: 'Timeout', responseTime: 30000 });
      });

      req.on('error', (error) => {
        this.activeRequests.delete(requestId);
        this.results.totalRequests++;
        this.results.failedRequests++;
        this.results.errors['CONNECTION_ERROR'] = (this.results.errors['CONNECTION_ERROR'] || 0) + 1;
        resolve({ statusCode: 0, error: error.message, responseTime: performance.now() - startTime });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  updateResponseTimeStats(responseTime) {
    this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
    this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
    this.results.averageResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
  }

  // Simulate a single user journey
  async simulateUserJourney(userId) {
    const journeyStartTime = performance.now();
    
    try {
      // Step 1: Visit homepage
      await this.makeRequest('/');
      
      // Step 2: Access new exam page
      await this.makeRequest('/new-exam');
      
      // Step 3: Submit exam
      const examData = this.generateExamData();
      const examResult = await this.makeRequest('/api/submit-exam', 'POST', examData);
      
      if (examResult.statusCode === 200 || examResult.statusCode === 202) {
        this.results.examSubmissions++;
      }
      
      // Step 4: Submit feedback (70% of users)
      if (Math.random() < 0.7) {
        const feedbackData = this.generateFeedbackData();
        const feedbackResult = await this.makeRequest('/api/submit-feedback', 'POST', feedbackData);
        
        if (feedbackResult.statusCode === 200 || feedbackResult.statusCode === 202) {
          this.results.feedbackSubmissions++;
        }
      }
      
      // Step 5: Check results (30% of users)
      if (Math.random() < 0.3) {
        await this.makeRequest(`/api/results/${examData.mobile}`);
      }
      
    } catch (error) {
      console.error(`User ${userId} journey failed:`, error.message);
    }
  }

  // Run batch of concurrent users
  async runUserBatch(batchNumber, usersInBatch) {
    console.log(`Starting batch ${batchNumber} with ${usersInBatch} users...`);
    
    const userPromises = [];
    for (let i = 0; i < usersInBatch; i++) {
      const userId = (batchNumber - 1) * this.batchSize + i + 1;
      userPromises.push(this.simulateUserJourney(userId));
      
      // Add small delay between user starts to simulate realistic traffic
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    await Promise.allSettled(userPromises);
    console.log(`Batch ${batchNumber} completed`);
  }

  // Monitor system performance during test
  async monitorSystem() {
    const monitoring = setInterval(async () => {
      if (!this.startTime) return;
      
      const elapsed = performance.now() - this.startTime;
      
      // Check system status
      try {
        const statusResponse = await this.makeRequest('/api/system-status');
        if (statusResponse.data) {
          const status = JSON.parse(statusResponse.data);
          console.log(`\n🔄 System Status (${Math.round(elapsed/1000)}s):`);
          console.log(`   Queue Length: ${status.queueLength || 0}`);
          console.log(`   Memory Usage: ${status.memoryUsage || 'N/A'}`);
          console.log(`   Active Connections: ${this.results.concurrentUsers}`);
        }
      } catch (error) {
        // System status endpoint might not be available
      }
      
      // Print current stats
      console.log(`\n📊 Live Stats (${Math.round(elapsed/1000)}s):`);
      console.log(`   Total Requests: ${this.results.totalRequests}`);
      console.log(`   Success Rate: ${((this.results.successfulRequests/this.results.totalRequests)*100).toFixed(1)}%`);
      console.log(`   Avg Response Time: ${this.results.averageResponseTime.toFixed(0)}ms`);
      console.log(`   Concurrent Users: ${this.results.concurrentUsers}`);
      console.log(`   Peak Concurrent: ${this.results.peakConcurrentUsers}`);
      console.log(`   Exam Submissions: ${this.results.examSubmissions}`);
      console.log(`   Feedback Submissions: ${this.results.feedbackSubmissions}`);
      
      if (elapsed >= this.testDuration) {
        clearInterval(monitoring);
      }
    }, 10000); // Update every 10 seconds
  }

  // Calculate performance percentiles
  calculatePercentiles() {
    const sorted = this.results.responseTimes.sort((a, b) => a - b);
    const length = sorted.length;
    
    return {
      p50: sorted[Math.floor(length * 0.5)],
      p90: sorted[Math.floor(length * 0.9)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)]
    };
  }

  // Generate comprehensive test report
  generateReport() {
    const testDuration = (performance.now() - this.startTime) / 1000;
    const percentiles = this.calculatePercentiles();
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    const requestsPerSecond = this.results.totalRequests / testDuration;
    
    console.log('\n' + '='.repeat(80));
    console.log('🚀 40K CONCURRENT USERS LOAD TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n📈 PERFORMANCE METRICS:');
    console.log(`   Test Duration: ${testDuration.toFixed(1)} seconds`);
    console.log(`   Total Users Simulated: ${this.totalUsers.toLocaleString()}`);
    console.log(`   Peak Concurrent Users: ${this.results.peakConcurrentUsers.toLocaleString()}`);
    console.log(`   Total Requests: ${this.results.totalRequests.toLocaleString()}`);
    console.log(`   Requests/Second: ${requestsPerSecond.toFixed(1)}`);
    console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
    
    console.log('\n⏱️  RESPONSE TIMES:');
    console.log(`   Average: ${this.results.averageResponseTime.toFixed(0)}ms`);
    console.log(`   Minimum: ${this.results.minResponseTime.toFixed(0)}ms`);
    console.log(`   Maximum: ${this.results.maxResponseTime.toFixed(0)}ms`);
    console.log(`   50th Percentile: ${percentiles.p50.toFixed(0)}ms`);
    console.log(`   90th Percentile: ${percentiles.p90.toFixed(0)}ms`);
    console.log(`   95th Percentile: ${percentiles.p95.toFixed(0)}ms`);
    console.log(`   99th Percentile: ${percentiles.p99.toFixed(0)}ms`);
    
    console.log('\n📊 REQUEST BREAKDOWN:');
    console.log(`   Successful: ${this.results.successfulRequests.toLocaleString()}`);
    console.log(`   Failed: ${this.results.failedRequests.toLocaleString()}`);
    console.log(`   Timeouts: ${this.results.timeouts.toLocaleString()}`);
    console.log(`   Exam Submissions: ${this.results.examSubmissions.toLocaleString()}`);
    console.log(`   Feedback Submissions: ${this.results.feedbackSubmissions.toLocaleString()}`);
    
    if (Object.keys(this.results.errors).length > 0) {
      console.log('\n❌ ERROR BREAKDOWN:');
      Object.entries(this.results.errors).forEach(([error, count]) => {
        console.log(`   ${error}: ${count}`);
      });
    }
    
    console.log('\n✅ LOAD TEST ASSESSMENT:');
    if (successRate >= 95 && percentiles.p95 < 5000) {
      console.log('   🎉 EXCELLENT: System handles 40K users with high performance');
    } else if (successRate >= 90 && percentiles.p95 < 10000) {
      console.log('   ✅ GOOD: System performs well under 40K user load');
    } else if (successRate >= 80) {
      console.log('   ⚠️  MODERATE: System shows stress under 40K user load');
    } else {
      console.log('   🔥 CRITICAL: System requires optimization for 40K users');
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Save detailed results to file
    const detailedResults = {
      testConfig: {
        totalUsers: this.totalUsers,
        batchSize: this.batchSize,
        concurrentBatches: this.concurrentBatches,
        testDuration: testDuration
      },
      performance: {
        totalRequests: this.results.totalRequests,
        successfulRequests: this.results.successfulRequests,
        failedRequests: this.results.failedRequests,
        successRate: successRate,
        requestsPerSecond: requestsPerSecond,
        peakConcurrentUsers: this.results.peakConcurrentUsers
      },
      responseTimes: {
        average: this.results.averageResponseTime,
        min: this.results.minResponseTime,
        max: this.results.maxResponseTime,
        percentiles: percentiles
      },
      applicationMetrics: {
        examSubmissions: this.results.examSubmissions,
        feedbackSubmissions: this.results.feedbackSubmissions
      },
      errors: this.results.errors,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      `load-test-results-40k-${Date.now()}.json`,
      JSON.stringify(detailedResults, null, 2)
    );
    
    console.log('📄 Detailed results saved to JSON file');
  }

  // Main load testing execution
  async run() {
    console.log('🚀 Starting 40K Concurrent Users Load Test...');
    console.log(`Target: ${this.totalUsers.toLocaleString()} users in ${this.concurrentBatches} concurrent batches`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log('='.repeat(60));
    
    this.startTime = performance.now();
    
    // Start system monitoring
    this.monitorSystem();
    
    // Execute concurrent batches
    const batchPromises = [];
    for (let batch = 1; batch <= this.concurrentBatches; batch++) {
      const usersInBatch = Math.min(this.batchSize, this.totalUsers - (batch - 1) * this.batchSize);
      if (usersInBatch > 0) {
        batchPromises.push(this.runUserBatch(batch, usersInBatch));
        
        // Stagger batch starts slightly to simulate realistic user arrival patterns
        if (batch % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Wait for all batches to complete
    console.log('\n⏳ Waiting for all user journeys to complete...');
    await Promise.allSettled(batchPromises);
    
    // Wait for any remaining requests to complete
    console.log('\n⏳ Waiting for remaining requests to finish...');
    let waitCount = 0;
    while (this.activeRequests.size > 0 && waitCount < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitCount++;
      console.log(`   Active requests: ${this.activeRequests.size}`);
    }
    
    console.log('\n✅ Load test completed!');
    this.generateReport();
  }
}

// Execute load test
const loadTest = new LoadTester40K();
loadTest.run().catch(console.error);