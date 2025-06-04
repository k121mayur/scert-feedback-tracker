import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingData {
  examId: string;
  mobile: string;
  topic: string;
  topicName: string;
  assessmentDate: string;
  batch: string;
  district: string;
  submittedAt: string;
}

interface ProcessingStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'duplicate';
  message?: string;
  result?: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    totalQuestions: number;
    examId: number;
  };
  processedAt?: string;
  error?: string;
}

export default function Processing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [processingData, setProcessingData] = useState<ProcessingData | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const data = sessionStorage.getItem('examProcessing');
    if (!data) {
      toast({
        title: "Invalid Access",
        description: "No processing data found.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }

    const parsedData = JSON.parse(data);
    setProcessingData(parsedData);
    pollStatus(parsedData.examId);
  }, []);

  const pollStatus = async (examId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max polling
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/exam-status/${examId}`);
        const statusData = await response.json();
        
        setStatus(statusData);
        
        // Update progress based on status
        if (statusData.status === 'queued') {
          setProgress(25);
        } else if (statusData.status === 'processing') {
          setProgress(75);
        } else if (statusData.status === 'completed') {
          setProgress(100);
          setPolling(false);
          
          // Store results and navigate to results page
          sessionStorage.setItem('examResult', JSON.stringify({
            ...statusData.result,
            // Use mobile from result if available, otherwise from processing data
            mobile: statusData.result.mobile || processingData?.mobile,
            topic: statusData.result.topicId || processingData?.topic,
            topicName: statusData.result.topicName || processingData?.topicName,
            assessmentDate: statusData.result.assessmentDate || processingData?.assessmentDate,
            batch: statusData.result.batch || processingData?.batch,
            district: statusData.result.district || processingData?.district,
          }));
          
          setTimeout(() => {
            setLocation('/results');
          }, 2000);
          
        } else if (statusData.status === 'failed' || statusData.status === 'duplicate') {
          setProgress(100);
          setPolling(false);
          
          toast({
            title: statusData.status === 'duplicate' ? "Exam Already Submitted" : "Processing Failed",
            description: statusData.message || statusData.error || "An error occurred during processing.",
            variant: "destructive",
          });
        }
        
        attempts++;
        if (attempts < maxAttempts && polling && !['completed', 'failed', 'duplicate'].includes(statusData.status)) {
          setTimeout(poll, 1000); // Poll every second
        } else if (attempts >= maxAttempts) {
          setPolling(false);
          toast({
            title: "Processing Timeout",
            description: "Exam processing is taking longer than expected. Please check back later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error polling status:", error);
        attempts++;
        if (attempts < maxAttempts && polling) {
          setTimeout(poll, 2000); // Retry after 2 seconds on error
        }
      }
    };
    
    poll();
  };

  const getStatusIcon = () => {
    if (!status) return <Clock className="h-6 w-6 text-blue-500 animate-spin" />;
    
    switch (status.status) {
      case 'queued':
        return <Clock className="h-6 w-6 text-yellow-500" />;
      case 'processing':
        return <Clock className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'duplicate':
        return <AlertCircle className="h-6 w-6 text-orange-500" />;
      default:
        return <Clock className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusMessage = () => {
    if (!status) return "Initializing processing...";
    
    switch (status.status) {
      case 'queued':
        return "Your exam is queued for processing. Please wait...";
      case 'processing':
        return "Processing your exam answers and calculating results...";
      case 'completed':
        return "Exam processed successfully! Redirecting to results...";
      case 'failed':
        return status.error || "Failed to process exam. Please contact support.";
      case 'duplicate':
        return "This exam has already been submitted.";
      default:
        return "Processing status unknown.";
    }
  };

  if (!processingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Card className="material-shadow-2">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
              {getStatusIcon()}
              <span>Processing Your Exam</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Processing Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Status Message */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-lg font-medium">{getStatusMessage()}</p>
              {status?.message && (
                <p className="text-sm text-muted-foreground mt-2">{status.message}</p>
              )}
            </div>

            {/* Exam Details */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h3 className="font-semibold text-lg">Exam Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Mobile:</span>
                  <p className="font-medium">{processingData.mobile}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Topic:</span>
                  <p className="font-medium">{processingData.topicName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">{processingData.assessmentDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Batch:</span>
                  <p className="font-medium">{processingData.batch}</p>
                </div>
              </div>
            </div>

            {/* Processing ID */}
            <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-muted-foreground">Processing ID</p>
              <p className="font-mono text-sm break-all">{processingData.examId}</p>
            </div>

            {/* Action Buttons */}
            {!polling && status?.status !== 'completed' && (
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setPolling(true);
                    pollStatus(processingData.examId);
                  }}
                  className="flex-1"
                >
                  Retry Processing
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation('/')}
                  className="flex-1"
                >
                  Go Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}