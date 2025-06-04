import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, User, Settings, Info } from "lucide-react";
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
    // Only allow numbers and limit to 10 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(numericValue);
    
    // Reset topic data when mobile changes
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
          title: "Access Denied",
          description: data.message || "Question paper is no longer active.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching topic data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch exam details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    if (topicData?.success && topicData.topic_id) {
      setLocation(`/exam?mobile=${mobile}&topic=${topicData.topic_id}&batch=${topicData.batch_name}&district=${topicData.district}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-border sticky top-0 z-50">
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
            {/* Examination Section */}
            <section id="exam" className="mb-12">
              <Card className="max-w-2xl mx-auto material-shadow-2">
                <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
                  <CardTitle className="text-2xl font-medium flex items-center">
                    <GraduationCap className="mr-2" />
                    Online Examination System
                  </CardTitle>
                  <p className="text-primary-foreground/80 mt-1">Complete your training assessment</p>
                </CardHeader>
                
                <CardContent className="p-6">
                  {/* Demo Numbers Section */}
                  <div className="mb-6 p-4 bg-muted rounded-lg border">
                    <h3 className="text-sm font-medium text-foreground mb-2 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Demo Login Numbers
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Use these mobile numbers to test the system:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="font-mono">9876543210</span>
                        <span className="text-xs text-muted-foreground">Math Topic</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="font-mono">9876543211</span>
                        <span className="text-xs text-muted-foreground">Science Topic</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="font-mono">9876543212</span>
                        <span className="text-xs text-muted-foreground">English Topic</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="font-mono">9876543213</span>
                        <span className="text-xs text-muted-foreground">History Topic</span>
                      </div>
                    </div>
                  </div>

                  <div className="max-w-md mx-auto">
                    <div className="mb-6">
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
                    
                    {mobile.length === 10 && (
                      <div className="space-y-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Topic ID
                          </label>
                          <Input
                            value={topicData?.topic_id || ''}
                            readOnly
                            className="bg-muted"
                            placeholder={loading ? "Loading..." : "Auto-filled based on mobile number"}
                          />
                        </div>
                        
                        {topicData?.success && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                Batch Name
                              </label>
                              <Input
                                value={topicData.batch_name || ''}
                                readOnly
                                className="bg-muted"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                District
                              </label>
                              <Input
                                value={topicData.district || ''}
                                readOnly
                                className="bg-muted"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={handleStartExam}
                      disabled={!topicData?.success || loading}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground material-shadow-1 hover:material-shadow-2 transition-all"
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Start Examination
                    </Button>
                    
                    <Card className="mt-6 bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-2">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Exam Guidelines:</p>
                            <ul className="space-y-1 text-blue-700">
                              <li>• 10 questions, 10 minutes duration</li>
                              <li>• No going back to previous questions</li>
                              <li>• Auto-submit when time expires</li>
                              <li>• Only one attempt allowed</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
              <h3 className="text-lg font-medium mb-4">Teacher Training Portal</h3>
              <p className="text-gray-300 text-sm">
                Empowering educators through comprehensive training and assessment programs.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#exam" className="text-gray-300 hover:text-white transition-colors">
                    Examination
                  </Link>
                </li>
                <li>
                  <Link href="#results" className="text-gray-300 hover:text-white transition-colors">
                    Results
                  </Link>
                </li>
                <li>
                  <Link href="#feedback" className="text-gray-300 hover:text-white transition-colors">
                    Feedback
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="text-gray-300 hover:text-white transition-colors">
                    Administration
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Support</h3>
              <p className="text-gray-300 text-sm">
                For technical assistance, contact your system administrator.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-4 text-center text-sm text-gray-300">
            <p>&copy; 2024 Teacher Training Portal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
