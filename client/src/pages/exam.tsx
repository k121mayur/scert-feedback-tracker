import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Timer } from "@/components/timer";
import { QuestionCard } from "@/components/question-card";
import { Clock, CheckCircle } from "lucide-react";
import { useTimer } from "@/hooks/use-timer";
import { useToast } from "@/hooks/use-toast";

interface Question {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface ExamData {
  mobile: string;
  topic?: string;
  batch?: string;
  district?: string;
  // New date-based assessment fields
  date?: string;
  topicId?: string;
  topicName?: string;
}

export default function Exam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  const { timeLeft, isExpired, startTimer } = useTimer(600); // 10 minutes

  useEffect(() => {
    // First try to get exam data from sessionStorage (new date-based system)
    const sessionExamData = sessionStorage.getItem('examData');
    
    if (sessionExamData) {
      const parsedData = JSON.parse(sessionExamData);
      setExamData(parsedData);
      
      // Use new API endpoint for date-based assessments
      if (parsedData.topicId) {
        loadNewExamQuestionsWithData(parsedData.topicId, parsedData.mobile);
      } else {
        loadQuestions(parsedData.mobile, parsedData.topic);
      }
      return;
    }

    // Fallback to URL parameters (legacy system)
    const urlParams = new URLSearchParams(window.location.search);
    const mobile = urlParams.get('mobile');
    const topic = urlParams.get('topic');
    const batch = urlParams.get('batch');
    const district = urlParams.get('district');

    if (!mobile || !topic || !batch || !district) {
      toast({
        title: "Invalid Access",
        description: "Missing required exam parameters.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }

    setExamData({ mobile, topic, batch, district });
    loadQuestions(mobile, topic);
  }, []);

  useEffect(() => {
    if (isExpired && examStarted) {
      handleAutoSubmit();
    }
  }, [isExpired, examStarted]);

  const loadQuestions = async (mobile: string, topic: string) => {
    try {
      const response = await fetch(`/api/questions/${topic}/${mobile}`);
      const data = await response.json();

      if (data.status === "error") {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setExamStarted(true);
      startTimer();
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
      setLocation('/');
    } finally {
      setLoading(false);
    }
  };

  const loadNewExamQuestions = async (topicId: string) => {
    try {
      if (!examData?.mobile) {
        toast({
          title: "Error",
          description: "Mobile number is required for authentication.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      const response = await fetch(`/api/exam-questions/${topicId}?mobile=${examData.mobile}`);
      const data = await response.json();

      if (data.status === "error") {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setExamStarted(true);
      startTimer();
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
      setLocation('/');
    } finally {
      setLoading(false);
    }
  };

  const loadNewExamQuestionsWithData = async (topicId: string, mobile: string) => {
    try {
      if (!mobile) {
        toast({
          title: "Error",
          description: "Mobile number is required for authentication.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      const response = await fetch(`/api/exam-questions/${topicId}?mobile=${mobile}`);
      const data = await response.json();

      if (data.status === "error") {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
      setExamStarted(true);
      startTimer();
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
      });
      setLocation('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: examData?.topicId || examData?.topic,
          topic_name: examData?.topicName || examData?.topic,
          mobile: examData?.mobile,
          assessment_date: examData?.date || new Date().toISOString().split('T')[0],
          batch_name: examData?.batch || "General",
          district: examData?.district || "General",
          questions: questions.map(q => q.question),
          answers: answers,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.processing) {
          // ASYNC PROCESSING: Store exam ID and poll for status
          sessionStorage.setItem('examProcessing', JSON.stringify({
            examId: result.examId,
            mobile: examData?.mobile,
            topic: examData?.topicId || examData?.topic,
            topicName: examData?.topicName || examData?.topic,
            assessmentDate: examData?.date || new Date().toISOString().split('T')[0],
            batch: examData?.batch || "General",
            district: examData?.district || "General",
            submittedAt: new Date().toISOString()
          }));
          
          // Navigate to processing status page
          setLocation('/processing');
        } else {
          // Legacy synchronous result
          sessionStorage.setItem('examResult', JSON.stringify({
            ...result.result,
            mobile: examData?.mobile,
            topic: examData?.topicId || examData?.topic,
            topicName: examData?.topicName || examData?.topic,
            assessmentDate: examData?.date || new Date().toISOString().split('T')[0],
            batch: examData?.batch || "General",
            district: examData?.district || "General",
          }));
          
          setLocation('/results');
        }
      } else {
        toast({
          title: "Submission Failed",
          description: result.message || "Failed to submit exam.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting exam:", error);
      toast({
        title: "Error",
        description: "Failed to submit exam. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    toast({
      title: "Time's Up!",
      description: "Your exam has been automatically submitted.",
      variant: "destructive",
    });
    handleSubmit();
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const answeredCount = answers.filter(answer => answer !== null).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your exam...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-medium text-foreground mb-4">No Questions Available</h2>
            <p className="text-muted-foreground mb-6">
              There are no questions available for this topic at the moment.
            </p>
            <Button onClick={() => setLocation('/')}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="material-shadow-2">
          {/* Timer Header */}
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-medium">Online Examination</CardTitle>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm opacity-90">Time Remaining</div>
                  <Timer 
                    timeLeft={timeLeft} 
                    className={`text-2xl font-bold ${timeLeft <= 60 ? 'timer-warning' : ''}`} 
                  />
                </div>
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4">
              <Progress 
                value={100 - (timeLeft / 600 * 100)} 
                className="h-2 bg-primary-foreground/20"
              />
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Question Progress</span>
                <span className="text-sm text-muted-foreground">
                  {currentQuestion + 1} of {questions.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Question Content */}
            <QuestionCard
              question={questions[currentQuestion]}
              questionNumber={currentQuestion + 1}
              selectedAnswer={answers[currentQuestion]}
              onAnswerSelect={handleAnswerSelect}
              disabled={isExpired}
            />

            {/* Question Navigator */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Answered: {answeredCount} of {questions.length}
              </div>
              <div className="flex space-x-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestion(index)}
                    className={`progress-question-number ${
                      index === currentQuestion
                        ? 'current'
                        : answers[index] !== null
                        ? 'answered'
                        : 'unanswered'
                    }`}
                    disabled={isExpired}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                onClick={handlePrevious}
                disabled={currentQuestion === 0 || isExpired}
                variant="outline"
              >
                Previous
              </Button>
              
              <div className="flex space-x-4">
                {currentQuestion < questions.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    disabled={isExpired}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || isExpired}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  >
                    {submitting ? (
                      <>
                        <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Submit Exam
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {isExpired && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive font-medium text-center">
                  Time has expired! Your answers have been locked and will be submitted automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
