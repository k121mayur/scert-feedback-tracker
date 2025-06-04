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
        if (result === "success") {
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
      description: "Your feedback has been submitted successfully.",
    });
    
    // Redirect to home after a delay
    setTimeout(() => {
      setLocation('/');
    }, 2000);
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
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="material-shadow-2">
          <CardHeader className="bg-accent text-accent-foreground rounded-t-lg">
            <CardTitle className="text-2xl font-medium flex items-center">
              <MessageSquare className="mr-2" />
              Training Feedback
            </CardTitle>
            <p className="text-accent-foreground/80 mt-1">Help us improve our training programs</p>
          </CardHeader>

          <CardContent className="p-8">
            <div className="text-center mb-8">
              <MessageSquare className="h-12 w-12 text-accent mx-auto mb-4" />
              <h2 className="text-xl font-medium text-foreground">We Value Your Feedback</h2>
              <p className="text-muted-foreground mt-2">
                Your feedback helps us improve the quality of our training programs
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-8">
              {questions.map((question, index) => (
                <Card key={question.id} className="p-6 border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    <span className="text-accent font-bold">{index + 1}.</span> {question.feedbackQues}
                  </h3>
                  
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      {[question.option1, question.option2, question.option3, question.option4, question.option5].map((option, optionIndex) => (
                        <div key={optionIndex} className="feedback-option">
                          <div className="flex items-center">
                            <RadioGroupItem
                              value={option}
                              id={`q${question.id}_option${optionIndex}`}
                              className="mr-2"
                            />
                            <Label
                              htmlFor={`q${question.id}_option${optionIndex}`}
                              className={`flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors text-sm font-medium min-h-[48px] ${
                                answers[question.id] === option 
                                  ? 'border-primary bg-primary/10 text-primary' 
                                  : 'border-border hover:bg-muted'
                              }`}
                            >
                              {option}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </Card>
              ))}

              {/* Progress Indicator */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-foreground">Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(answers).length} of {questions.length} answered
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div 
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="text-center pt-6">
                <Button
                  type="submit"
                  disabled={submitting || Object.keys(answers).length !== questions.length}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 material-shadow-1 hover:material-shadow-2 transition-all"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Guidelines */}
            <Card className="mt-8 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-900 mb-2">Feedback Guidelines:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Please answer all questions honestly</li>
                  <li>• Your feedback will help improve future training sessions</li>
                  <li>• All responses are confidential</li>
                  <li>• You can only submit feedback once per topic</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
