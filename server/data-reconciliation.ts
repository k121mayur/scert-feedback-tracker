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
    const teacherCount = teacherCountResult.rows[0]?.count || 0;

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
    const districtCount = districtCountResult.rows[0]?.count || 0;

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
    const batchCount = batchCountResult.rows[0]?.count || 0;

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
    const questionCount = questionCountResult.rows[0]?.count || 0;

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
    const assessmentDateCount = assessmentDateResult.rows[0]?.count || 0;

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

  private async checkBatchDataConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for empty batches
    const batchesWithoutTeachers = await db
      .select({ 
        batchName: batches.batchName,
        teacherCount: count(batchTeachers.id)
      })
      .from(batches)
      .leftJoin(batchTeachers, sql`${batches.batchName} = ${batchTeachers.batchName}`)
      .groupBy(batches.batchName)
      .having(sql`COUNT(${batchTeachers.id}) = 0`);

    checks.push({
      checkName: 'Empty Batches',
      status: batchesWithoutTeachers.length === 0 ? 'PASSED' : 'WARNING',
      expected: 0,
      actual: batchesWithoutTeachers.length,
      discrepancy: batchesWithoutTeachers.length,
      description: 'Batches with no assigned teachers',
      severity: 'MEDIUM'
    });

    // Check batch-district consistency
    const batchDistrictMismatch = await db
      .select({
        batchName: batches.batchName,
        batchDistrict: batches.district,
        teacherDistrict: teachers.district
      })
      .from(batches)
      .innerJoin(batchTeachers, sql`${batches.batchName} = ${batchTeachers.batchName}`)
      .innerJoin(teachers, sql`${batchTeachers.teacherMobile} = ${teachers.teacherMobile}`)
      .where(sql`${batches.district} != ${teachers.district}`);

    checks.push({
      checkName: 'Batch District Consistency',
      status: batchDistrictMismatch.length === 0 ? 'PASSED' : 'WARNING',
      expected: 0,
      actual: batchDistrictMismatch.length,
      discrepancy: batchDistrictMismatch.length,
      description: 'Teachers assigned to batches in different districts',
      severity: 'MEDIUM'
    });
  }

  private async checkAssessmentScheduleConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for future assessment dates
    const futureAssessments = await db
      .select({ count: count() })
      .from(assessmentSchedules)
      .where(sql`${assessmentSchedules.assessmentDate} > CURRENT_DATE`);

    checks.push({
      checkName: 'Future Assessment Dates',
      status: 'PASSED',
      expected: 'Variable',
      actual: futureAssessments[0]?.count || 0,
      discrepancy: 0,
      description: 'Number of future assessment dates scheduled',
      severity: 'LOW'
    });

    // Check for orphaned topic assignments
    const topicAssignments = await db
      .selectDistinct({ topicId: assessmentSchedules.topicId })
      .from(assessmentSchedules);

    const questionTopics = await db
      .selectDistinct({ topicId: questions.topicId })
      .from(questions);

    const orphanedTopics = topicAssignments.filter(
      assignment => !questionTopics.find(qt => qt.topicId === assignment.topicId)
    );

    checks.push({
      checkName: 'Assessment Topic Validity',
      status: orphanedTopics.length === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: orphanedTopics.length,
      discrepancy: orphanedTopics.length,
      description: 'Assessment topics without corresponding questions',
      severity: 'HIGH'
    });
  }

  private async checkQuestionBankConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for topics with insufficient questions
    const topicQuestionCounts = await db
      .select({
        topicId: questions.topicId,
        questionCount: count()
      })
      .from(questions)
      .groupBy(questions.topicId);

    const insufficientQuestions = topicQuestionCounts.filter(
      topic => topic.questionCount < 10
    );

    checks.push({
      checkName: 'Minimum Questions Per Topic',
      status: insufficientQuestions.length === 0 ? 'PASSED' : 'WARNING',
      expected: 0,
      actual: insufficientQuestions.length,
      discrepancy: insufficientQuestions.length,
      description: 'Topics with fewer than 10 questions',
      severity: 'MEDIUM'
    });

    // Check for questions with missing options
    const incompleteQuestions = await db
      .select({ count: count() })
      .from(questions)
      .where(sql`
        ${questions.option1} IS NULL OR ${questions.option1} = '' OR
        ${questions.option2} IS NULL OR ${questions.option2} = '' OR
        ${questions.option3} IS NULL OR ${questions.option3} = '' OR
        ${questions.option4} IS NULL OR ${questions.option4} = ''
      `);

    checks.push({
      checkName: 'Complete Question Options',
      status: (incompleteQuestions[0]?.count || 0) === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: incompleteQuestions[0]?.count || 0,
      discrepancy: incompleteQuestions[0]?.count || 0,
      description: 'Questions with missing answer options',
      severity: 'HIGH'
    });
  }

  private async checkExamResultsConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for impossible scores
    const invalidScores = await db
      .select({ count: count() })
      .from(examResults)
      .where(sql`
        ${examResults.correctCount} > ${examResults.totalQuestions} OR
        ${examResults.correctCount} < 0 OR
        ${examResults.totalQuestions} <= 0
      `);

    checks.push({
      checkName: 'Valid Exam Scores',
      status: (invalidScores[0]?.count || 0) === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidScores[0]?.count || 0,
      discrepancy: invalidScores[0]?.count || 0,
      description: 'Exam results with impossible scores',
      severity: 'HIGH'
    });

    // Check for duplicate exam attempts
    const duplicateExams = await db
      .select({
        mobile: examResults.mobile,
        topicId: examResults.topicId,
        examDate: examResults.examDate,
        count: count()
      })
      .from(examResults)
      .groupBy(examResults.mobile, examResults.topicId, examResults.examDate)
      .having(sql`COUNT(*) > 1`);

    checks.push({
      checkName: 'Unique Exam Attempts',
      status: duplicateExams.length === 0 ? 'PASSED' : 'WARNING',
      expected: 0,
      actual: duplicateExams.length,
      discrepancy: duplicateExams.length,
      description: 'Duplicate exam attempts for same teacher/topic/date',
      severity: 'MEDIUM'
    });
  }

  private async checkFeedbackDataConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check for valid feedback responses
    const validResponses = ['असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट'];
    
    const invalidFeedback = await db
      .select({ count: count() })
      .from(trainerFeedback)
      .where(sql`${trainerFeedback.feedback} NOT IN ('असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट')`);

    checks.push({
      checkName: 'Valid Feedback Responses',
      status: (invalidFeedback[0]?.count || 0) === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidFeedback[0]?.count || 0,
      discrepancy: invalidFeedback[0]?.count || 0,
      description: 'Feedback responses not matching expected Marathi options',
      severity: 'HIGH'
    });
  }

  private async checkCrossReferenceConsistency(checks: ReconciliationCheck[]): Promise<void> {
    // Check exam results reference valid teachers
    const invalidExamTeachers = await db
      .select({ count: count() })
      .from(examResults)
      .leftJoin(teachers, sql`${examResults.mobile} = ${teachers.teacherMobile}`)
      .where(sql`${teachers.teacherMobile} IS NULL`);

    checks.push({
      checkName: 'Exam Results Teacher Reference',
      status: (invalidExamTeachers[0]?.count || 0) === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidExamTeachers[0]?.count || 0,
      discrepancy: invalidExamTeachers[0]?.count || 0,
      description: 'Exam results referencing non-existent teachers',
      severity: 'HIGH'
    });

    // Check feedback references valid teachers
    const invalidFeedbackTeachers = await db
      .select({ count: count() })
      .from(trainerFeedback)
      .leftJoin(teachers, sql`${trainerFeedback.mobile} = ${teachers.teacherMobile}`)
      .where(sql`${teachers.teacherMobile} IS NULL`);

    checks.push({
      checkName: 'Feedback Teacher Reference',
      status: (invalidFeedbackTeachers[0]?.count || 0) === 0 ? 'PASSED' : 'FAILED',
      expected: 0,
      actual: invalidFeedbackTeachers[0]?.count || 0,
      discrepancy: invalidFeedbackTeachers[0]?.count || 0,
      description: 'Feedback referencing non-existent teachers',
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