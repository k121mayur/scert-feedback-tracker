import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MessageSquare, Heart, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeedbackQuestion {
  id: number;
  feedbackQues: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  option5: string;
}

interface FeedbackData {
  mobile: string;
  topic: string;
  batch: string;
  district: string;
}

export default function Feedback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // First try to get feedback data from sessionStorage (from exam results)
    const examResultData = sessionStorage.getItem('examResult');
    
    if (examResultData) {
      const parsedData = JSON.parse(examResultData);
      
      // Ensure mobile number exists before proceeding
      if (!parsedData.mobile) {
        console.error('No mobile number found in exam result data:', parsedData);
        toast({
          title: "Missing Information",
          description: "Unable to access feedback without mobile number. Please start from exam.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }
      
      const feedbackInfo = {
        mobile: parsedData.mobile,
        topic: parsedData.topicName || parsedData.topic,
        batch: parsedData.batch || "General",
        district: parsedData.district || "General"
      };
      setFeedbackData(feedbackInfo);
      checkExistingFeedback(feedbackInfo.mobile, feedbackInfo.topic);
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
        description: "Missing required feedback parameters.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }

    setFeedbackData({ mobile, topic, batch, district });
    checkExistingFeedback(mobile, topic);
  }, []);

  const checkExistingFeedback = async (mobile: string, topic: string) => {
    try {
      const response = await fetch(`/api/check-topic-feedback?topic=${encodeURIComponent(topic)}&mobile=${encodeURIComponent(mobile)}`);
      const result = await response.text();

      if (result === "exists") {
        toast({
          title: "Feedback Already Submitted",
          description: "You have already submitted feedback for this topic.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      await loadFeedbackQuestions();
    } catch (error) {
      console.error("Error checking existing feedback:", error);
      toast({
        title: "Error",
        description: "Failed to verify feedback status.",
        variant: "destructive",
      });
      setLocation('/');
    }
  };

  const loadFeedbackQuestions = async () => {
    try {
      const response = await fetch('/api/feedback-questions');
      const data = await response.json();
      setQuestions(data);
    } catch (error) {
      console.error("Error loading feedback questions:", error);
      toast({
        title: "Error",
        description: "Failed to load feedback questions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const validateForm = () => {
    const unansweredQuestions = questions.filter(q => !answers[q.id]);
    if (unansweredQuestions.length > 0) {
      toast({
        title: "Incomplete Feedback",
        description: "Please answer all questions before submitting.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || submitting || !feedbackData) return;

    setSubmitting(true);
    try {
      const questionTexts = questions.map(q => q.feedbackQues);
      const feedbackAnswers = questions.map(q => answers[q.id]);

      // Final validation before submission
      if (!feedbackData.mobile) {
        toast({
          title: "Submission Error",
          description: "Mobile number is required for feedback submission.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      console.log('Feedback Data:', feedbackData);
      console.log('Submitting feedback with data:', {
        topic_name: feedbackData.topic,
        mobile_no: feedbackData.mobile,
        batch_name: feedbackData.batch,
        district: feedbackData.district,
        questions: questionTexts,
        feedback_answers: feedbackAnswers,
      });

      const response = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_name: feedbackData.topic,
          mobile_no: feedbackData.mobile,
          batch_name: feedbackData.batch,
          district: feedbackData.district,
          questions: questionTexts,
          feedback_answers: feedbackAnswers,
        }),
      });

      if (response.ok) {
        const result = await response.text();
        console.log('Feedback submission result:', result);
        if (result === "success" || result.includes("success")) {
          // Show thank you message
          showThankYouMessage();
        } else {
          toast({
            title: "Submission Failed",
            description: "An error occurred while submitting feedback.",
            variant: "destructive",
          });
        }
      } else {
        // Handle HTTP error responses
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        if (response.status === 400 && errorData.message === "Feedback already submitted") {
          toast({
            title: "Already Submitted",
            description: "You have already submitted feedback for this topic.",
            variant: "destructive",
          });
          // Redirect to home since feedback is already done
          setTimeout(() => {
            setLocation('/');
          }, 2000);
        } else {
          toast({
            title: "Submission Failed",
            description: errorData.message || "Failed to submit feedback.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showThankYouMessage = () => {
    toast({
      title: "Thank You!",
      description: "Your feedback has been submitted successfully. Redirecting to home page...",
      action: (
        <button 
          onClick={() => setLocation('/')}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
        >
          Go Home
        </button>
      ),
    });
    
    // Clear exam data
    sessionStorage.removeItem('examResult');
    
    // Redirect to home after a delay
    setTimeout(() => {
      setLocation('/');
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4">
        {/* Simple Header */}
        <div className="text-center mb-6 pt-6">
          <Heart className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-foreground">प्रशिक्षक मूल्यांकन</h1>
          <p className="text-sm text-muted-foreground mt-1">कृपया सर्व प्रश्नांची उत्तरे द्या</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <h3 className="text-base font-medium text-foreground mb-3 leading-relaxed">
                {index + 1}. {question.feedbackQues}
              </h3>
              
              <RadioGroup
                value={answers[question.id] || ''}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
              >
                <div className="space-y-2">
                  {[question.option1, question.option2, question.option3, question.option4, question.option5].map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={option}
                        id={`q${question.id}_option${optionIndex}`}
                        className="text-primary"
                      />
                      <Label
                        htmlFor={`q${question.id}_option${optionIndex}`}
                        className={`flex-1 p-2 rounded cursor-pointer transition-colors text-sm ${
                          answers[question.id] === option 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          ))}

          {/* Simple Progress */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span>प्रगती</span>
              <span>{Object.keys(answers).length}/{questions.length}</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 mt-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitting || Object.keys(answers).length !== questions.length}
            className="w-full py-3 text-base font-medium"
            size="lg"
          >
            {submitting ? (
              <>
                <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                सबमिट करत आहे...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                मूल्यांकन सबमिट करा
              </>
            )}
          </Button>
        </form>

        {/* Simple Note */}
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
            आपले मत गुपचूप ठेवले जाईल आणि प्रशिक्षण सुधारण्यासाठी वापरले जाईल
          </p>
        </div>
      </div>
    </div>
  );
}
