import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTable } from "@/components/batch-table";
import { CsvUpload } from "@/components/csv-upload";
import { BulkTeacherImport } from "@/components/bulk-teacher-import";
import { Users, FileText, BarChart3, Shield, UserSearch, ArrowLeft, Plus, Edit, Settings, Calendar, BookOpen, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AssessmentDate {
  date: string;
  isActive: boolean;
}

interface Topic {
  id: string;
  name: string;
  isActive: boolean;
}

interface DateTopicMapping {
  date: string;
  isActive: boolean;
  topics: Topic[];
}

interface ExamStats {
  totalExams: number;
  averageScore: number;
  passRate: number;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  satisfactionRate: number;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("batches");
  const [, setLocation] = useLocation();
  const [mobile, setMobile] = useState("");
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Check for existing authentication on component mount
  useEffect(() => {
    const authToken = sessionStorage.getItem('adminAuth');
    if (authToken) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      const response = await apiRequest('POST', '/api/admin/login', loginForm);
      const data = await response.json();
      
      if (data.success) {
        sessionStorage.setItem('adminAuth', 'authenticated');
        setIsAuthenticated(true);
        toast({
          title: "Login Successful",
          description: "Welcome to the administration panel.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password.",
        variant: "destructive",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setLoginForm({ username: "", password: "" });
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
  };

  // Assessment Control state
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateTopicMappings, setDateTopicMappings] = useState<DateTopicMapping[]>([]);
  const loadedRef = useRef(false);

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats'],
    enabled: activeTab === "reports",
  });

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(numericValue);
  };

  const searchTeacher = async () => {
    if (mobile.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/teacher-by-mobile/${mobile}`);
      if (response.ok) {
        const data = await response.json();
        setTeacherInfo(data);
        // Navigate with mobile number as query parameter to avoid double search
        setLocation(`/admin/teacher-details?mobile=${mobile}`);
      } else {
        setTeacherInfo(null);
        toast({
          title: "Teacher Not Found",
          description: "No teacher found with this mobile number.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching teacher:", error);
      toast({
        title: "Error",
        description: "Failed to search teacher. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Assessment Control Functions
  const loadAssessmentData = useCallback(async () => {
    if (loadedRef.current || assessmentLoading) return;
    
    setAssessmentLoading(true);
    loadedRef.current = true;
    
    try {
      const datesResponse = await fetch('/api/admin/assessment-control/dates');
      const datesWithTopics = await datesResponse.json();
      
      // Data now comes with topics already assigned to each date
      // Ensure it's always an array to prevent mapping errors
      setDateTopicMappings(Array.isArray(datesWithTopics) ? datesWithTopics : []);
    } catch (error) {
      console.error("Error loading assessment data:", error);
      loadedRef.current = false;
      toast({
        title: "Error",
        description: "Failed to load assessment data.",
        variant: "destructive",
      });
    } finally {
      setAssessmentLoading(false);
    }
  }, [assessmentLoading, toast]);

  const handleDateToggle = (date: string, isActive: boolean) => {
    setDateTopicMappings(prev => 
      prev.map(mapping => 
        mapping.date === date 
          ? { ...mapping, isActive }
          : mapping
      )
    );
  };

  const handleTopicToggle = (date: string, topicId: string, isActive: boolean) => {
    setDateTopicMappings(prev => 
      prev.map(mapping => 
        mapping.date === date 
          ? {
              ...mapping,
              topics: mapping.topics.map(topic =>
                topic.id === topicId ? { ...topic, isActive } : topic
              )
            }
          : mapping
      )
    );
  };

  const saveAssessmentChanges = async () => {
    setSaving(true);
    try {
      // Save date settings with safety checks
      await apiRequest('PUT', '/api/admin/assessment-control/dates', {
        dates: Array.isArray(dateTopicMappings) ? 
          dateTopicMappings.filter(mapping => mapping?.date).map(({ date, isActive }) => ({ date, isActive })) : []
      });

      // Save topic settings (flatten all topics) with safety checks
      const allTopics = Array.isArray(dateTopicMappings) ? 
        dateTopicMappings.flatMap(mapping => Array.isArray(mapping?.topics) ? mapping.topics : []) : [];
      const uniqueTopics = allTopics.reduce((acc: Topic[], topic) => {
        if (topic && topic.id) {
          const existing = acc.find(t => t.id === topic.id);
          if (!existing) {
            acc.push(topic);
          }
        }
        return acc;
      }, []);

      await apiRequest('PUT', '/api/admin/assessment-control/topics', {
        topics: uniqueTopics
      });

      // Reload data to reflect database changes
      loadedRef.current = false;
      await loadAssessmentData();

      toast({
        title: "Success",
        description: "Assessment settings saved successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Assessment Control Component
  const AssessmentControlSection = () => {
    useEffect(() => {
      if (activeTab === 'control') {
        loadAssessmentData();
      }
    }, [activeTab, loadAssessmentData]);

    return (
      <div className="space-y-6">
        {/* Header with Save Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Assessment Control Panel
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Control which dates and topics are available for teacher assessments
            </p>
          </div>
          <Button onClick={saveAssessmentChanges} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {assessmentLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading assessment data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dateTopicMappings.map((mapping) => (
              <Card key={mapping.date}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`date-${mapping.date}`}
                      checked={mapping.isActive}
                      onCheckedChange={(checked) => 
                        handleDateToggle(mapping.date, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <CardTitle className="flex items-center">
                        <Calendar className="mr-2 h-5 w-5" />
                        {formatDate(mapping.date)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{mapping.date}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      mapping.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {mapping.isActive ? 'Active' : 'Hidden'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center mb-3">
                      <BookOpen className="mr-2 h-4 w-4" />
                      <span className="font-medium">Available Topics</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mapping.topics.map((topic) => (
                        <div key={`${mapping.date}-${topic.id}`} className="flex items-center space-x-2 p-2 border rounded">
                          <Checkbox
                            id={`topic-${mapping.date}-${topic.id}`}
                            checked={topic.isActive}
                            onCheckedChange={(checked) => 
                              handleTopicToggle(mapping.date, topic.id, checked as boolean)
                            }
                          />
                          <label 
                            htmlFor={`topic-${mapping.date}-${topic.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            {topic.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Check date boxes to make assessment dates available to teachers</p>
              <p>• Check topic boxes to make specific topics available for each date</p>
              <p>• Uncheck to temporarily hide dates or topics from teacher selection</p>
              <p>• Changes take effect immediately after saving</p>
              <p>• Teachers will only see active/checked dates and topics</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Login UI component
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <p className="text-muted-foreground">Enter your credentials to access the administration panel</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/')}
                  className="flex-1"
                >
                  Back to Home
                </Button>
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1"
                >
                  {loginLoading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-border p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => setLocation('/')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-medium text-foreground">NIPUN Teachers Portal - Admin</h1>
                <p className="text-muted-foreground mt-1">Manage batches, teachers, and system data</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Admin Tabs */}
          <div className="border-b border-border mb-6">
            <TabsList className="grid w-full max-w-5xl grid-cols-5">
              <TabsTrigger value="batches" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Batch Management</span>
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex items-center space-x-2">
                <UserSearch className="h-4 w-4" />
                <span>Teacher Management</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Bulk Import</span>
              </TabsTrigger>
              <TabsTrigger value="control" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Assessment Control</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>System Reports</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Batch Management Tab */}
          <TabsContent value="batches">
            <BatchTable />
          </TabsContent>

          {/* Teacher Management Tab */}
          <TabsContent value="teachers">
            <div className="space-y-6">
              {/* Teacher Search Section */}
              <Card className="material-shadow-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <UserSearch className="h-5 w-5" />
                    <span>Teacher Search & Reports</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md space-y-4">
                    <div>
                      <label htmlFor="mobile" className="block text-sm font-medium text-foreground mb-2">
                        Search by Mobile Number
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
                      className="w-full"
                    >
                      {loading ? "Searching..." : "Search Teacher"}
                    </Button>
                    
  
                  </div>
                </CardContent>
              </Card>

              {/* Teacher Management Section */}
              <Card className="material-shadow-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>Teacher Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={() => setLocation('/admin/add-teacher')}
                      className="flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add New Teacher</span>
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setLocation('/admin/edit-teacher')}
                      className="flex items-center space-x-2"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit Teacher Records</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>


            </div>
          </TabsContent>

          {/* Bulk Import Tab */}
          <TabsContent value="import">
            <div className="space-y-6">
              <BulkTeacherImport />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Payment ID Verification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CsvUpload />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assessment Control Tab */}
          <TabsContent value="control">
            <AssessmentControlSection />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            {/* System Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{(stats as any)?.systemStats?.totalTeachers || 0}</div>
                <div className="text-sm text-blue-600 font-medium">Total Teachers</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                <div className="text-2xl font-bold text-green-600">{(stats as any)?.systemStats?.totalDistricts || 0}</div>
                <div className="text-sm text-green-600 font-medium">Districts</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{(stats as any)?.systemStats?.totalBatches || 0}</div>
                <div className="text-sm text-purple-600 font-medium">Total Batches</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">{(stats as any)?.systemStats?.totalSubjects || 0}</div>
                <div className="text-sm text-orange-600 font-medium">Subjects</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 text-center border border-indigo-200">
                <div className="text-2xl font-bold text-indigo-600">{(stats as any)?.systemStats?.totalQuestions || 0}</div>
                <div className="text-sm text-indigo-600 font-medium">Questions</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-200">
                <div className="text-2xl font-bold text-emerald-600">{(stats as any)?.systemStats?.totalAssessmentDates || 0}</div>
                <div className="text-sm text-emerald-600 font-medium">Assessment Dates</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Exam Statistics */}
              <Card className="material-shadow-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Exam Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Total Exams Conducted</span>
                      <span className="font-bold text-primary">
                        {(stats as any)?.examStats?.totalExams || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Average Score</span>
                      <span className="font-bold text-secondary">
                        {(stats as any)?.examStats?.averageScore || 0}/10
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Pass Rate</span>
                      <span className="font-bold text-secondary">
                        {(stats as any)?.examStats?.passRate || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feedback Summary */}
              <Card className="material-shadow-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Feedback Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Feedback Responses</span>
                      <span className="font-bold text-primary">
                        {(stats as any)?.feedbackStats?.totalFeedback || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Avg. Training Quality</span>
                      <span className="font-bold text-secondary">
                        {(stats as any)?.feedbackStats?.averageRating || 0}/5
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Satisfaction Rate</span>
                      <span className="font-bold text-secondary">
                        {(stats as any)?.feedbackStats?.satisfactionRate || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Export Options */}
            <Card className="material-shadow-2">
              <CardHeader>
                <CardTitle>Export Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="flex items-center justify-center p-4 border border-border rounded-lg hover:bg-muted transition-colors">
                    <FileText className="text-green-600 text-2xl mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Exam Data</div>
                      <div className="text-sm text-muted-foreground">Excel format</div>
                    </div>
                  </button>
                  <button className="flex items-center justify-center p-4 border border-border rounded-lg hover:bg-muted transition-colors">
                    <FileText className="text-red-600 text-2xl mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Feedback Report</div>
                      <div className="text-sm text-muted-foreground">PDF format</div>
                    </div>
                  </button>
                  <button className="flex items-center justify-center p-4 border border-border rounded-lg hover:bg-muted transition-colors">
                    <FileText className="text-blue-600 text-2xl mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Batch Data</div>
                      <div className="text-sm text-muted-foreground">CSV format</div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
