import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, User, BookOpen, Trophy, Calendar, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeacherInfo {
  id: number;
  teacherId: string;
  teacherName: string;
  mobile: string;
  payId: string;
  district: string;
  createdAt: string;
}

interface ExamRecord {
  id: number;
  topicId: string;
  topicName: string;
  assessmentDate: string;
  batchName: string;
  district: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  submittedAt: string;
}

interface FeedbackRecord {
  id: number;
  topicName: string;
  feedbackQue: string;
  feedback: string;
  batchName: string;
  district: string;
  createdAt: string;
}

interface TeacherStats {
  totalExams: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalTopics: number;
  passRate: number;
  totalCorrect: number;
  totalQuestions: number;
}

export default function TeacherDetails() {
  const [, setLocation] = useLocation();
  const [mobile, setMobile] = useState("");
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<FeedbackRecord[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  // Check for mobile number in URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mobileParam = urlParams.get('mobile');
    if (mobileParam && mobileParam.length === 10) {
      setMobile(mobileParam);
      // Automatically search for the teacher
      setTimeout(() => {
        searchTeacher(mobileParam);
      }, 100);
    }
  }, []);

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(numericValue);
  };

  const searchTeacher = async (mobileNumber?: string) => {
    const searchMobile = mobileNumber || mobile;
    
    if (searchMobile.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Fetch teacher information
      const teacherResponse = await fetch(`/api/admin/teacher-by-mobile/${searchMobile}`);
      
      if (!teacherResponse.ok) {
        setTeacherInfo(null);
        setExamRecords([]);
        setFeedbackRecords([]);
        setTeacherStats(null);
        toast({
          title: "Teacher Not Found",
          description: "No teacher found with this mobile number.",
          variant: "destructive",
        });
        return;
      }

      const teacherData = await teacherResponse.json();
      setTeacherInfo(teacherData);

      // Fetch exam records
      const examResponse = await fetch(`/api/admin/teacher-exams/${searchMobile}`);
      const examData = examResponse.ok ? await examResponse.json() : [];
      setExamRecords(examData);

      // Fetch feedback records
      const feedbackResponse = await fetch(`/api/admin/teacher-feedback/${searchMobile}`);
      const feedbackData = feedbackResponse.ok ? await feedbackResponse.json() : [];
      setFeedbackRecords(feedbackData);

      // Calculate teacher statistics
      if (examData.length > 0) {
        const scores = examData.map((exam: ExamRecord) => 
          Math.round((exam.correctCount / exam.totalQuestions) * 100)
        );
        
        const totalExams = examData.length;
        const averageScore = scores.reduce((a: number, b: number) => a + b, 0) / totalExams;
        const bestScore = Math.max(...scores);
        const worstScore = Math.min(...scores);
        const totalTopics = new Set(examData.map((exam: ExamRecord) => exam.topicId)).size;
        const passRate = (scores.filter((score: number) => score >= 60).length / totalExams) * 100;
        
        // Calculate total marks (correct answers out of total questions)
        const totalCorrect = examData.reduce((sum: number, exam: ExamRecord) => sum + exam.correctCount, 0);
        const totalQuestions = examData.reduce((sum: number, exam: ExamRecord) => sum + exam.totalQuestions, 0);

        setTeacherStats({
          totalExams,
          averageScore: Math.round(averageScore),
          bestScore,
          worstScore,
          totalTopics,
          passRate: Math.round(passRate),
          totalCorrect,
          totalQuestions
        });
      } else {
        setTeacherStats({
          totalExams: 0,
          averageScore: 0,
          bestScore: 0,
          worstScore: 0,
          totalTopics: 0,
          passRate: 0,
          totalCorrect: 0,
          totalQuestions: 0
        });
      }

    } catch (error) {
      console.error("Error fetching teacher details:", error);
      toast({
        title: "Error",
        description: "Failed to fetch teacher details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800";
    if (score >= 75) return "bg-blue-100 text-blue-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getPassBadge = (score: number) => {
    return score >= 60 ? (
      <Badge className="bg-green-100 text-green-800">PASS</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">FAIL</Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => setLocation('/admin')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <User className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-medium text-foreground">Teacher Details</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="mr-2 h-5 w-5" />
              Search Teacher
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="mobile" className="block text-sm font-medium text-foreground mb-2">
                  Mobile Number
                </label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={mobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  className="w-full"
                  maxLength={10}
                />
              </div>
              <Button 
                onClick={searchTeacher}
                disabled={loading || mobile.length !== 10}
                className="px-6"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Information */}
        {searched && (
          <>
            {teacherInfo ? (
              <div className="space-y-8">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Teacher Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                        <p className="text-lg font-semibold">{teacherInfo.teacherName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Teacher ID</label>
                        <p className="text-lg">{teacherInfo.teacherId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Mobile Number</label>
                        <p className="text-lg font-mono">{teacherInfo.mobile}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">District</label>
                        <p className="text-lg">{teacherInfo.district}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Payment ID</label>
                        <p className="text-lg">{teacherInfo.payId || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                        <p className="text-lg">{formatDate(teacherInfo.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Statistics */}
                {teacherStats && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Trophy className="mr-2 h-5 w-5" />
                        Performance Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{teacherStats.totalExams}</div>
                          <div className="text-sm text-blue-600">Total Exams</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{teacherStats.averageScore}%</div>
                          <div className="text-sm text-green-600">Average Score</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{teacherStats.bestScore}%</div>
                          <div className="text-sm text-purple-600">Best Score</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{teacherStats.worstScore}%</div>
                          <div className="text-sm text-orange-600">Lowest Score</div>
                        </div>
                        <div className="text-center p-4 bg-indigo-50 rounded-lg">
                          <div className="text-2xl font-bold text-indigo-600">{teacherStats.totalTopics}</div>
                          <div className="text-sm text-indigo-600">Topics Covered</div>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 rounded-lg">
                          <div className="text-2xl font-bold text-emerald-600">{teacherStats.passRate}%</div>
                          <div className="text-sm text-emerald-600">Pass Rate</div>
                        </div>
                        <div className="text-center p-4 bg-rose-50 rounded-lg">
                          <div className="text-2xl font-bold text-rose-600">{teacherStats.totalCorrect}/{teacherStats.totalQuestions}</div>
                          <div className="text-sm text-rose-600">Total Marks</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Records */}
                <Tabs defaultValue="exams" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="exams" className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Assessment Records ({examRecords.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Feedback Records ({feedbackRecords.length})</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="exams">
                    <Card>
                      <CardHeader>
                        <CardTitle>Assessment History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {examRecords.length > 0 ? (
                          <div className="space-y-4">
                            {examRecords.map((exam) => {
                              const score = Math.round((exam.correctCount / exam.totalQuestions) * 100);
                              return (
                                <div key={exam.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{exam.topicName}</h3>
                                        {getPassBadge(score)}
                                      </div>
                                      <div className="text-sm text-muted-foreground space-y-1">
                                        <p><span className="font-medium">Topic ID:</span> {exam.topicId}</p>
                                        <p><span className="font-medium">Date:</span> {formatDate(exam.assessmentDate)}</p>
                                        <p><span className="font-medium">Submitted:</span> {formatDateTime(exam.submittedAt)}</p>
                                        <p><span className="font-medium">Batch:</span> {exam.batchName}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="text-right space-y-2">
                                      <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(score)}`}>
                                        {score}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <p>Correct: {exam.correctCount}/{exam.totalQuestions}</p>
                                        <p>Wrong: {exam.wrongCount}</p>
                                        <p>Unanswered: {exam.unansweredCount}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No assessment records found</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="feedback">
                    <Card>
                      <CardHeader>
                        <CardTitle>Feedback History by Subject</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {feedbackRecords.length > 0 ? (
                          <div className="space-y-4">
                            {(() => {
                              // Group feedback by subject/topic
                              const groupedFeedback = feedbackRecords.reduce((acc: any, feedback) => {
                                const topic = feedback.topicName;
                                if (!acc[topic]) {
                                  acc[topic] = [];
                                }
                                acc[topic].push(feedback);
                                return acc;
                              }, {});

                              return Object.entries(groupedFeedback).map(([topic, feedbacks]: [string, any]) => (
                                <div key={topic} className="border rounded-lg">
                                  <button 
                                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex justify-between items-center"
                                    onClick={() => {
                                      const element = document.getElementById(`feedback-${topic}`);
                                      if (element) {
                                        element.classList.toggle('hidden');
                                      }
                                    }}
                                  >
                                    <div>
                                      <h3 className="font-semibold text-primary">{topic}</h3>
                                      <p className="text-sm text-muted-foreground">{feedbacks.length} feedback record(s)</p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">Click to expand</div>
                                  </button>
                                  
                                  <div id={`feedback-${topic}`} className="hidden border-t">
                                    {feedbacks.map((feedback: any) => (
                                      <div key={feedback.id} className="p-4 border-b last:border-b-0">
                                        <div className="space-y-3">
                                          <div className="flex justify-between items-start">
                                            <span className="text-sm text-muted-foreground">
                                              {formatDateTime(feedback.createdAt)}
                                            </span>
                                          </div>
                                          
                                          <div className="bg-muted/50 rounded-lg p-3">
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                              {feedback.feedbackQue}
                                            </p>
                                            <p className="text-foreground">{feedback.feedback}</p>
                                          </div>
                                          
                                          <div className="text-sm text-muted-foreground">
                                            <span className="font-medium">Batch:</span> {feedback.batchName} | 
                                            <span className="font-medium"> District:</span> {feedback.district}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No feedback records found</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Teacher Not Found</h3>
                    <p className="text-muted-foreground">
                      No teacher found with mobile number: {mobile}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}