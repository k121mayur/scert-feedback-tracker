import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, User, Settings, Info, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TopicData {
  success: boolean;
  topic_id?: string;
  batch_name?: string;
  district?: string;
  message?: string;
}

export default function Home() {
  const [mobile, setMobile] = useState("");
  const [topicData, setTopicData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(numericValue);
    
    if (numericValue.length !== 10) {
      setTopicData(null);
    }
  };

  useEffect(() => {
    if (mobile.length === 10) {
      fetchTopicData();
    }
  }, [mobile]);

  const fetchTopicData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/topic-by-mobile/${mobile}`);
      const data: TopicData = await response.json();
      
      setTopicData(data);
      
      if (!data.success) {
        toast({
          title: "Mobile Number Not Found",
          description: data.message || "This mobile number is not registered for training.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching topic data:", error);
      toast({
        title: "Connection Error",
        description: "Unable to verify mobile number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    if (topicData && topicData.success) {
      setLocation(`/exam?mobile=${mobile}&topic=${topicData.topic_id}&batch=${topicData.batch_name}&district=${topicData.district}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-medium text-foreground">Teacher Training Portal</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="#exam" className="text-muted-foreground hover:text-primary transition-colors">
                Examination
              </Link>
              <Link href="#results" className="text-muted-foreground hover:text-primary transition-colors">
                Results
              </Link>
              <Link href="#feedback" className="text-muted-foreground hover:text-primary transition-colors">
                Feedback
              </Link>
              <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors">
                Administration
              </Link>
            </nav>
            <div className="flex items-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="student" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="student" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Student Portal</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Admin Panel</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="student">
            {/* New Date-Based Assessment System - Primary Section */}
            <section id="new-assessment" className="mb-12">
              <Card className="max-w-2xl mx-auto material-shadow-2 border-2 border-primary">
                <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-t-lg">
                  <CardTitle className="text-2xl font-medium flex items-center">
                    <Calendar className="mr-2" />
                    New Date-Based Assessment System
                  </CardTitle>
                  <p className="text-primary-foreground/90 mt-2">
                    Enhanced assessment platform with scheduled topics for June 1-10, 2025
                  </p>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-foreground">Modern Assessment Experience</h3>
                      <p className="text-muted-foreground">
                        Select from 5 topics per assessment date • Randomized questions • Comprehensive tracking
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="font-semibold text-primary">10 Assessment Dates</div>
                        <div className="text-muted-foreground">June 1-10, 2025</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="font-semibold text-primary">5 Topics/Date</div>
                        <div className="text-muted-foreground">Varied subjects</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="font-semibold text-primary">5 Questions</div>
                        <div className="text-muted-foreground">From 12-question banks</div>
                      </div>
                    </div>

                    <Button 
                      onClick={() => setLocation('/new-exam')}
                      size="lg" 
                      className="w-full md:w-auto px-8 py-3 text-lg font-medium"
                    >
                      Start New Assessment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Legacy Examination System - Secondary Section */}
            <section id="exam" className="mb-12">
              <Card className="max-w-2xl mx-auto material-shadow-2">
                <CardHeader className="bg-muted text-muted-foreground rounded-t-lg">
                  <CardTitle className="text-xl font-medium flex items-center">
                    <GraduationCap className="mr-2" />
                    Legacy Examination System
                  </CardTitle>
                  <p className="text-muted-foreground/80 mt-1">
                    Traditional mobile-based assessment method
                  </p>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="mobile" className="block text-sm font-medium text-foreground mb-2">
                        Mobile Number
                      </label>
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="Enter your 10-digit mobile number"
                        value={mobile}
                        onChange={(e) => handleMobileChange(e.target.value)}
                        className="w-full"
                        maxLength={10}
                      />
                      {mobile && mobile.length < 10 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Please enter a complete 10-digit mobile number
                        </p>
                      )}
                    </div>

                    {loading && (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">Verifying mobile number...</p>
                      </div>
                    )}

                    {topicData && topicData.success && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-800 mb-2">Registration Found!</h4>
                        <div className="text-sm text-green-700 space-y-1">
                          <p><span className="font-medium">Topic:</span> {topicData.topic_id}</p>
                          <p><span className="font-medium">Batch:</span> {topicData.batch_name}</p>
                          <p><span className="font-medium">District:</span> {topicData.district}</p>
                        </div>
                        <Button 
                          onClick={handleStartExam}
                          className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Start Legacy Examination
                        </Button>
                      </div>
                    )}

                    {mobile.length === 10 && !loading && !topicData?.success && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-amber-800 text-sm">
                          Mobile number not found in the system. Please try the New Date-Based Assessment System above.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Demo Numbers Section - Moved to Bottom */}
            <section className="mb-12">
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Info className="mr-2 h-5 w-5" />
                    Demo Testing Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Legacy System Demo Numbers</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use these mobile numbers to test the legacy examination system:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-muted rounded border">
                          <span className="font-mono text-sm">9876543210</span>
                          <span className="text-xs text-muted-foreground">Math Topic</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded border">
                          <span className="font-mono text-sm">9876543211</span>
                          <span className="text-xs text-muted-foreground">Science Topic</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded border">
                          <span className="font-mono text-sm">9876543212</span>
                          <span className="text-xs text-muted-foreground">English Topic</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded border">
                          <span className="font-mono text-sm">9876543213</span>
                          <span className="text-xs text-muted-foreground">History Topic</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <h4 className="font-medium text-foreground mb-2">Recommended Approach</h4>
                      <p className="text-sm text-muted-foreground">
                        For the best experience, use the <strong>New Date-Based Assessment System</strong> above. 
                        It provides enhanced features, better tracking, and supports 40,000 concurrent users.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="admin">
            <div className="text-center py-12">
              <Settings className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-medium text-foreground mb-4">Administration Panel</h2>
              <p className="text-muted-foreground mb-6">
                Access the full admin dashboard to manage batches, teachers, and system data
              </p>
              <Link href="/admin">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Settings className="mr-2 h-4 w-4" />
                  Go to Admin Panel
                </Button>
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Teacher Training Portal</h3>
              <p className="text-gray-300 text-sm">
                Comprehensive assessment platform designed for efficient teacher training and evaluation.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Features</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Date-based assessment scheduling</li>
                <li>• Randomized question selection</li>
                <li>• Comprehensive result tracking</li>
                <li>• Feedback collection system</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Performance</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Supports 40,000 concurrent users</li>
                <li>• Optimized database performance</li>
                <li>• High-speed response times</li>
                <li>• Robust error handling</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              &copy; 2025 Teacher Training Portal. Built with modern web technologies for optimal performance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}