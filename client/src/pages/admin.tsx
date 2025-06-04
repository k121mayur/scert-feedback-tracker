import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTable } from "@/components/batch-table";
import { CsvUpload } from "@/components/csv-upload";
import { Users, FileText, BarChart3, Shield, UserSearch, ArrowLeft, Plus, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
  const [activeTab, setActiveTab] = useState("batches");
  const [, setLocation] = useLocation();
  const [mobile, setMobile] = useState("");
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
                <h1 className="text-2xl font-medium text-foreground">Administration Panel</h1>
                <p className="text-muted-foreground mt-1">Manage batches, teachers, and system data</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Admin Tabs */}
          <div className="border-b border-border mb-6">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="batches" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Batch Management</span>
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex items-center space-x-2">
                <UserSearch className="h-4 w-4" />
                <span>Teacher Management</span>
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
                    
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Sample Teacher Mobile Numbers:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>Mumbai: 9876543201</div>
                        <div>Pune: 9876543226</div>
                        <div>Nashik: 9876543251</div>
                        <div>Nagpur: 9876543276</div>
                        <div>Aurangabad: 9876543301</div>
                      </div>
                    </div>
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
                        {stats?.examStats?.totalExams || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Average Score</span>
                      <span className="font-bold text-secondary">
                        {stats?.examStats?.averageScore || 0}/10
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Pass Rate</span>
                      <span className="font-bold text-secondary">
                        {stats?.examStats?.passRate || 0}%
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
                        {stats?.feedbackStats?.totalFeedback || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Avg. Training Quality</span>
                      <span className="font-bold text-secondary">
                        {stats?.feedbackStats?.averageRating || 0}/5
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                      <span className="text-muted-foreground">Satisfaction Rate</span>
                      <span className="font-bold text-secondary">
                        {stats?.feedbackStats?.satisfactionRate || 0}%
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
