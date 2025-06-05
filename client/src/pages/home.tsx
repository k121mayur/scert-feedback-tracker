import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, User, Settings, Info, Calendar } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();

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
              <Card className="max-w-md mx-auto">
                <CardHeader className="text-center">
                  <CardTitle className="text-xl font-medium flex items-center justify-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Assessment System
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Button 
                    onClick={() => setLocation('/new-exam')}
                    size="lg" 
                    className="w-full"
                  >
                    Start Assessment
                  </Button>
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