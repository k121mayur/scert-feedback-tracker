import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, BookOpen, User, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AssessmentSchedule {
  id: number;
  assessmentDate: string;
  topicId: string;
  topicName: string;
  isActive: boolean;
}

export default function NewExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobile, setMobile] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [assessmentDates, setAssessmentDates] = useState<string[]>([]);
  const [topicsForDate, setTopicsForDate] = useState<AssessmentSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load available assessment dates on component mount
  useEffect(() => {
    fetchAssessmentDates();
  }, []);

  // Load topics when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchTopicsForDate(selectedDate);
    }
  }, [selectedDate]);

  const fetchAssessmentDates = async () => {
    try {
      const response = await fetch('/api/assessment-dates');
      const dates = await response.json();
      setAssessmentDates(dates);
    } catch (error) {
      console.error("Error fetching assessment dates:", error);
      toast({
        title: "Error",
        description: "Failed to load assessment dates.",
        variant: "destructive",
      });
    }
  };

  const fetchTopicsForDate = async (date: string) => {
    try {
      const response = await fetch(`/api/assessments-by-date/${date}`);
      const topics = await response.json();
      setTopicsForDate(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      toast({
        title: "Error",
        description: "Failed to load topics for selected date.",
        variant: "destructive",
      });
    }
  };

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length <= 10) {
      setMobile(numericValue);
    }
  };

  const validateForm = () => {
    if (mobile.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return false;
    }

    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select an assessment date.",
        variant: "destructive",
      });
      return false;
    }

    if (!selectedTopic) {
      toast({
        title: "Topic Required",
        description: "Please select a topic for assessment.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const checkExamEligibility = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Check if exam already taken for this date and topic
      const response = await fetch(`/api/check-exam-exists/${mobile}/${selectedTopic}/${selectedDate}`);
      const exists = await response.json();

      if (exists.exists) {
        toast({
          title: "Exam Already Taken",
          description: "You have already completed this assessment for the selected date.",
          variant: "destructive",
        });
        return;
      }

      // Start the exam
      sessionStorage.setItem('examData', JSON.stringify({
        mobile,
        date: selectedDate,
        topicId: selectedTopic,
        topicName: topicsForDate.find(t => t.topicId === selectedTopic)?.topicName || '',
      }));

      setLocation('/exam');
    } catch (error) {
      console.error("Error checking exam eligibility:", error);
      toast({
        title: "Error",
        description: "Failed to verify exam eligibility. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="material-shadow-2">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-2xl font-medium flex items-center">
              <BookOpen className="mr-2" />
              Assessment Portal
            </CardTitle>
            <p className="text-primary-foreground/80 mt-1">
              Select your assessment date and topic to begin
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <div className="max-w-md mx-auto space-y-6">
              {/* Mobile Number Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    value={mobile}
                    onChange={(e) => handleMobileChange(e.target.value)}
                    className="pr-10"
                    placeholder="Enter your 10-digit mobile number"
                    maxLength={10}
                  />
                  <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Assessment Date Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Assessment Date
                </label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select assessment date" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessmentDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        <div className="flex items-center">
                          <Calendar className="mr-2 h-4 w-4" />
                          {formatDate(date)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic Selection */}
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Assessment Topic
                  </label>
                  <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select topic for assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      {topicsForDate.map((topic) => (
                        <SelectItem key={topic.topicId} value={topic.topicId}>
                          <div className="flex items-center">
                            <BookOpen className="mr-2 h-4 w-4" />
                            {topic.topicName}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Assessment Instructions */}
              {selectedDate && selectedTopic && (
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2 flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    Assessment Information
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Assessment duration: 10 minutes</li>
                    <li>• Total questions: 5 (randomly selected)</li>
                    <li>• Each question has 4 multiple choice options</li>
                    <li>• You can review and change answers before submission</li>
                    <li>• Once submitted, answers cannot be changed</li>
                  </ul>
                </div>
              )}

              {/* Start Assessment Button */}
              <Button
                onClick={checkExamEligibility}
                disabled={!mobile || !selectedDate || !selectedTopic || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="loading-spinner w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"></div>
                    Verifying...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Start Assessment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}