import { db } from './db';
import { sql } from 'drizzle-orm';

interface ReconciliationReport {
  timestamp: Date;
  checks: ReconciliationCheck[];
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  };
}

interface ReconciliationCheck {
  checkName: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  expected: number | string;
  actual: number | string;
  discrepancy: number;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class DataReconciliationService {
  
  async performFullReconciliation(): Promise<ReconciliationReport> {
    const checks: ReconciliationCheck[] = [];
    const timestamp = new Date();

    try {
      // Dashboard metrics validation
      await this.validateDashboardMetrics(checks);
      
      // Data consistency checks
      await this.checkDataConsistency(checks);
      
      // Data integrity checks
      await this.checkDataIntegrity(checks);

    } catch (error: any) {
      console.error('Error during data reconciliation:', error);
      checks.push({
        checkName: 'System Error Check',
        status: 'FAILED',
        expected: 'No errors',
        actual: `Error: ${error?.message || 'Unknown error'}`,
        discrepancy: 1,
        description: 'Critical system error during reconciliation',
        severity: 'HIGH'
      });
    }

    const summary = this.calculateSummary(checks);
    const overallStatus = this.determineOverallStatus(summary);

    return {
      timestamp,
      checks,
      overallStatus,
      summary
    };
  }

  private async validateDashboardMetrics(checks: ReconciliationCheck[]): Promise<void> {
    // Validate teacher count consistency
    const teacherCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM teachers`);
    const teacherCount = Number(teacherCountResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Teacher Count Validation',
      status: teacherCount > 0 ? 'PASSED' : 'FAILED',
      expected: 'Greater than 0',
      actual: teacherCount,
      discrepancy: teacherCount === 0 ? 1 : 0,
      description: 'Verify teacher records exist in database',
      severity: 'HIGH'
    });

    // Validate district count consistency
    const districtCountResult = await db.execute(sql`SELECT COUNT(DISTINCT district) as count FROM teachers`);
    const districtCount = Number(districtCountResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'District Count Validation',
      status: districtCount > 0 ? 'PASSED' : 'FAILED',
      expected: 'Greater than 0',
      actual: districtCount,
      discrepancy: districtCount === 0 ? 1 : 0,
      description: 'Verify district data consistency',
      severity: 'HIGH'
    });

    // Validate batch count consistency
    const batchCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM batches`);
    const batchCount = Number(batchCountResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Batch Count Validation',
      status: batchCount > 0 ? 'PASSED' : 'WARNING',
      expected: 'Greater than 0',
      actual: batchCount,
      discrepancy: batchCount === 0 ? 1 : 0,
      description: 'Verify batch records exist',
      severity: 'MEDIUM'
    });

    // Validate question count consistency
    const questionCountResult = await db.execute(sql`SELECT COUNT(*) as count FROM questions`);
    const questionCount = Number(questionCountResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Question Bank Validation',
      status: questionCount > 0 ? 'PASSED' : 'FAILED',
      expected: 'Greater than 0',
      actual: questionCount,
      discrepancy: questionCount === 0 ? 1 : 0,
      description: 'Verify question bank has content',
      severity: 'HIGH'
    });

    // Validate assessment date count
    const assessmentDateResult = await db.execute(sql`SELECT COUNT(DISTINCT assessment_date) as count FROM assessment_schedules`);
    const assessmentDateCount = Number(assessmentDateResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Assessment Date Validation',
      status: assessmentDateCount > 0 ? 'PASSED' : 'WARNING',
      expected: 'Greater than 0',
      actual: assessmentDateCount,
      discrepancy: assessmentDateCount === 0 ? 1 : 0,
      description: 'Verify assessment dates are scheduled',
      severity: 'MEDIUM'
    });
  }

  private async checkDataConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for duplicate mobile numbers
    const duplicatesResult = await db.execute(sql`
      SELECT mobile, COUNT(*) as count 
      FROM teachers 
      GROUP BY mobile 
      HAVING COUNT(*) > 1
    `);

    checks.push({
      checkName: 'Teacher Mobile Uniqueness',
      status: duplicatesResult.rows.length === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: duplicatesResult.rows.length,
      discrepancy: duplicatesResult.rows.length,
      description: 'Check for duplicate teacher mobile numbers',
      severity: 'HIGH'
    });

    // Check exam score validity
    const invalidScoresResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM exam_results 
      WHERE correct_count > total_questions OR correct_count < 0 OR total_questions <= 0
    `);

    const invalidScoreCount = Number(invalidScoresResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Valid Exam Scores',
      status: invalidScoreCount === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidScoreCount,
      discrepancy: invalidScoreCount,
      description: 'Verify exam results have valid scores',
      severity: 'HIGH'
    });
  }

  private async checkDataIntegrity(checks: ReconciliationCheck[]): Promise<void> {
    // Check feedback response validity
    const invalidFeedbackResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM trainer_feedback 
      WHERE feedback NOT IN ('असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट')
    `);

    const invalidFeedbackCount = Number(invalidFeedbackResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Valid Feedback Responses',
      status: invalidFeedbackCount === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidFeedbackCount,
      discrepancy: invalidFeedbackCount,
      description: 'Verify feedback responses match expected Marathi options',
      severity: 'HIGH'
    });

    // Check orphaned exam results
    const orphanedExamsResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM exam_results er 
      LEFT JOIN teachers t ON er.mobile = t.mobile 
      WHERE t.mobile IS NULL
    `);

    const orphanedExamCount = Number(orphanedExamsResult.rows[0]?.count || 0);

    checks.push({
      checkName: 'Exam Results Integrity',
      status: orphanedExamCount === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: orphanedExamCount,
      discrepancy: orphanedExamCount,
      description: 'Verify exam results reference valid teachers',
      severity: 'HIGH'
    });
  }



  private calculateSummary(checks: ReconciliationCheck[]) {
    return {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.status === 'PASSED').length,
      failedChecks: checks.filter(c => c.status === 'FAILED').length,
      warningChecks: checks.filter(c => c.status === 'WARNING').length
    };
  }

  private determineOverallStatus(summary: any): 'PASSED' | 'FAILED' | 'WARNING' {
    if (summary.failedChecks > 0) return 'FAILED';
    if (summary.warningChecks > 0) return 'WARNING';
    return 'PASSED';
  }

  async getLastReconciliationReport(): Promise<ReconciliationReport | null> {
    // This would typically be stored in a database table
    // For now, returning null as no persistence layer is implemented
    return null;
  }

  async scheduleReconciliation(intervalMinutes: number = 60): Promise<void> {
    console.log(`Scheduling data reconciliation every ${intervalMinutes} minutes`);
    
    setInterval(async () => {
      try {
        const report = await this.performFullReconciliation();
        console.log('Automated reconciliation completed:', {
          status: report.overallStatus,
          timestamp: report.timestamp,
          summary: report.summary
        });

        if (report.overallStatus === 'FAILED') {
          console.error('Critical data integrity issues detected:', 
            report.checks.filter(c => c.status === 'FAILED')
          );
        }
      } catch (error) {
        console.error('Automated reconciliation failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

export const dataReconciliation = new DataReconciliationService();