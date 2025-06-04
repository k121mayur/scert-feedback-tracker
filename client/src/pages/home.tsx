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

            {/* Demo Testing Information Section */}
            <section className="mb-12">
              <Card className="max-w-4xl mx-auto">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-t-lg">
                  <CardTitle className="text-xl flex items-center text-blue-900 dark:text-blue-100">
                    <Info className="mr-2 h-5 w-5" />
                    Demo Testing Information
                  </CardTitle>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                    Test the assessment system with these demo mobile numbers
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-foreground mb-3 flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-primary" />
                        Date-Based Assessment System Demo Numbers
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Use these mobile numbers to test the new date-based assessment system. Each number is registered across multiple assessment dates with different topics.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="font-mono text-lg font-bold text-green-800 dark:text-green-200">9876543210</div>
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">Mumbai District</div>
                          <div className="text-xs text-green-600 dark:text-green-400">BATCH_MUM_001</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="font-mono text-lg font-bold text-blue-800 dark:text-blue-200">9876543211</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Pune District</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">BATCH_PUN_002</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="font-mono text-lg font-bold text-purple-800 dark:text-purple-200">9876543212</div>
                          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Nashik District</div>
                          <div className="text-xs text-purple-600 dark:text-purple-400">BATCH_NAS_003</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="font-mono text-lg font-bold text-orange-800 dark:text-orange-200">9876543213</div>
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">Nagpur District</div>
                          <div className="text-xs text-orange-600 dark:text-orange-400">BATCH_NAG_004</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 rounded-lg border border-teal-200 dark:border-teal-800">
                          <div className="font-mono text-lg font-bold text-teal-800 dark:text-teal-200">9876543214</div>
                          <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">Aurangabad District</div>
                          <div className="text-xs text-teal-600 dark:text-teal-400">BATCH_AUR_005</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950 dark:to-rose-950 rounded-lg border border-pink-200 dark:border-pink-800">
                          <div className="font-mono text-lg font-bold text-pink-800 dark:text-pink-200">9876543215</div>
                          <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">Kolhapur District</div>
                          <div className="text-xs text-pink-600 dark:text-pink-400">BATCH_KOL_006</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-medium text-foreground mb-2">How to Test</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Use any demo number in the Date-Based Assessment System</li>
                            <li>• Select from multiple available assessment dates</li>
                            <li>• Choose from various subject topics per date</li>
                            <li>• Experience the complete 5-question assessment</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-foreground mb-2">System Features</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Date-based topic organization</li>
                            <li>• Admin assessment control panel</li>
                            <li>• Real-time progress tracking</li>
                            <li>• Comprehensive result analytics</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Recommended Testing Approach</h5>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Start with the <strong>Date-Based Assessment System</strong> using any demo number above. 
                        This system supports 40,000 concurrent users and provides the most comprehensive testing experience 
                        with advanced admin controls and detailed analytics.
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