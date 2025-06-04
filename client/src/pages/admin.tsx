import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTable } from "@/components/batch-table";
import { CsvUpload } from "@/components/csv-upload";
import { Users, FileText, BarChart3, Shield, UserSearch } from "lucide-react";
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
        setLocation('/admin/teacher-details');
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
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-medium text-foreground">Administration Panel</h1>
              <p className="text-muted-foreground mt-1">Manage batches, teachers, and system data</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Admin Tabs */}
          <div className="border-b border-border mb-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="batches" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Batch Management</span>
              </TabsTrigger>
              <TabsTrigger value="verification" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Data Verification</span>
              </TabsTrigger>
              <TabsTrigger value="teachers" className="flex items-center space-x-2">
                <UserSearch className="h-4 w-4" />
                <span>Teacher Reports</span>
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

          {/* Data Verification Tab */}
          <TabsContent value="verification">
            <Card className="material-shadow-2">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>CSV Data Verification</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CsvUpload />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teacher Reports Tab */}
          <TabsContent value="teachers">
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
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
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
