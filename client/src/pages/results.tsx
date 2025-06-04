import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Circle, MessageSquare, Download } from "lucide-react";

interface ExamResult {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  mobile: string;
  topic: string;
  topicName?: string;
  assessmentDate?: string;
  batch: string;
  district: string;
}

export default function Results() {
  const [, setLocation] = useLocation();
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  useEffect(() => {
    // Get exam result from sessionStorage
    const resultData = sessionStorage.getItem('examResult');
    if (!resultData) {
      setLocation('/');
      return;
    }

    try {
      const result = JSON.parse(resultData);
      setExamResult(result);
    } catch (error) {
      console.error("Error parsing exam result:", error);
      setLocation('/');
    }
  }, []);

  const handleProceedToFeedback = () => {
    if (examResult) {
      setLocation(`/feedback?mobile=${examResult.mobile}&topic=${examResult.topic}&batch=${examResult.batch}&district=${examResult.district}`);
    }
  };

  const handleDownloadResults = () => {
    if (!examResult) return;

    const attemptedQuestions = examResult.correctCount + examResult.wrongCount;
    const percentage = Math.round((examResult.correctCount / examResult.totalQuestions) * 100);
    const accuracy = attemptedQuestions > 0 ? Math.round((examResult.correctCount / attemptedQuestions) * 100) : 0;
    const passingScore = 60;
    const resultStatus = percentage >= passingScore ? "PASSED" : "FAILED";
    
    const resultText = `
TEACHER TRAINING EXAMINATION RESULTS
====================================

CANDIDATE INFORMATION:
--------------------
Mobile Number: ${examResult.mobile}
Topic: ${examResult.topicName || examResult.topic}
Topic ID: ${examResult.topic}
Assessment Date: ${examResult.assessmentDate || new Date().toISOString().split('T')[0]}
Batch Name: ${examResult.batch}
District: ${examResult.district}
Exam Date & Time: ${new Date().toLocaleString()}

PERFORMANCE SUMMARY:
------------------
Total Questions: ${examResult.totalQuestions}
Questions Attempted: ${attemptedQuestions}
Questions Unanswered: ${examResult.unansweredCount}

SCORE BREAKDOWN:
---------------
Correct Answers: ${examResult.correctCount}
Wrong Answers: ${examResult.wrongCount}
Final Score: ${examResult.correctCount}/${examResult.totalQuestions}

PERFORMANCE METRICS:
------------------
Overall Percentage: ${percentage}%
Attempt Accuracy: ${accuracy}%
Completion Rate: ${Math.round((attemptedQuestions / examResult.totalQuestions) * 100)}%

RESULT STATUS: ${resultStatus}
${percentage >= passingScore ? 'Congratulations! You have successfully passed the assessment.' : 'Please review the topics and attempt the assessment again.'}

GRADE CLASSIFICATION:
-------------------
${percentage >= 90 ? 'Excellent (A+)' :
  percentage >= 80 ? 'Very Good (A)' :
  percentage >= 70 ? 'Good (B)' :
  percentage >= 60 ? 'Satisfactory (C)' :
  'Needs Improvement (F)'}

Generated on: ${new Date().toLocaleString()}
System: Teacher Training Assessment Platform
    `.trim();

    const blob = new Blob([resultText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_result_${examResult.mobile}_${examResult.topic}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!examResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  const score = examResult.correctCount;
  const percentage = Math.round((score / examResult.totalQuestions) * 100);
  const attempted = examResult.correctCount + examResult.wrongCount;
  const accuracy = attempted > 0 ? Math.round((examResult.correctCount / attempted) * 100) : 0;

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="material-shadow-2">
          <CardHeader className="bg-secondary text-secondary-foreground rounded-t-lg">
            <CardTitle className="text-2xl font-medium flex items-center">
              <CheckCircle className="mr-2" />
              Examination Results
            </CardTitle>
            <p className="text-secondary-foreground/80 mt-1">Your performance summary</p>
          </CardHeader>

          <CardContent className="p-8">
            {/* Completion Status */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-foreground">Exam Completed!</h2>
              <p className="text-muted-foreground mt-2">Your results have been calculated</p>
            </div>

            {/* Results Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary">{examResult.totalQuestions}</div>
                <div className="text-sm text-blue-700">Total Questions</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-secondary">{examResult.correctCount}</div>
                <div className="text-sm text-green-700">Correct Answers</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{examResult.wrongCount}</div>
                <div className="text-sm text-red-700">Wrong Answers</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{examResult.unansweredCount}</div>
                <div className="text-sm text-gray-700">Unanswered</div>
              </div>
            </div>

            {/* Score Visualization */}
            <Card className="bg-muted p-6 mb-8">
              <h3 className="text-lg font-medium text-foreground mb-4">Performance Overview</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-foreground">Overall Score</span>
                    <span className="text-sm font-bold text-secondary">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-3" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attempted:</span>
                    <span className="font-medium">{attempted}/{examResult.totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accuracy:</span>
                    <span className="font-medium text-secondary">{accuracy}%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="text-lg font-medium">Final Score:</span>
                  <span className="text-lg font-bold text-primary">{score}/{examResult.totalQuestions}</span>
                </div>
              </div>
            </Card>

            {/* Performance Indicators */}
            <div className="flex items-center justify-center space-x-6 mb-8 text-sm">
              <div className="flex items-center space-x-2 text-secondary">
                <CheckCircle className="h-4 w-4" />
                <span>Correct: {examResult.correctCount}</span>
              </div>
              <div className="flex items-center space-x-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Wrong: {examResult.wrongCount}</span>
              </div>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Circle className="h-4 w-4" />
                <span>Unanswered: {examResult.unansweredCount}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleProceedToFeedback}
                className="bg-primary hover:bg-primary/90 text-primary-foreground material-shadow-1 hover:material-shadow-2 transition-all"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Proceed to Feedback
              </Button>
              <Button
                onClick={handleDownloadResults}
                variant="outline"
                className="border-border hover:bg-muted transition-colors"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Results
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
