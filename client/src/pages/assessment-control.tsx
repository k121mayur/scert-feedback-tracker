import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, BookOpen, Save } from "lucide-react";
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

export default function AssessmentControl() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const [assessmentDates, setAssessmentDates] = useState<AssessmentDate[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Load current assessment dates and topics
  useEffect(() => {
    loadAssessmentData();
  }, []);

  const loadAssessmentData = async () => {
    setLoading(true);
    try {
      // Load assessment dates
      const datesResponse = await fetch('/api/admin/assessment-control/dates');
      const datesData = await datesResponse.json();
      setAssessmentDates(datesData);

      // Load topics
      const topicsResponse = await fetch('/api/admin/assessment-control/topics');
      const topicsData = await topicsResponse.json();
      setTopics(topicsData);
    } catch (error) {
      console.error("Error loading assessment data:", error);
      toast({
        title: "Error",
        description: "Failed to load assessment data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateToggle = (date: string, isActive: boolean) => {
    setAssessmentDates(prev => 
      prev.map(d => d.date === date ? { ...d, isActive } : d)
    );
  };

  const handleTopicToggle = (topicId: string, isActive: boolean) => {
    setTopics(prev => 
      prev.map(t => t.id === topicId ? { ...t, isActive } : t)
    );
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Save date settings
      await apiRequest('PUT', '/api/admin/assessment-control/dates', {
        dates: assessmentDates
      });

      // Save topic settings
      await apiRequest('PUT', '/api/admin/assessment-control/topics', {
        topics: topics
      });

      toast({
        title: "Success",
        description: "Assessment settings saved successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes. Please try again.",
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
              <Calendar className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-medium text-foreground">Assessment Control Panel</h1>
            </div>
            <Button onClick={saveChanges} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assessment Dates Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Available Assessment Dates
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control which dates are available for teachers to select for assessments
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading dates...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assessmentDates.map((dateItem) => (
                    <div key={dateItem.date} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`date-${dateItem.date}`}
                        checked={dateItem.isActive}
                        onCheckedChange={(checked) => 
                          handleDateToggle(dateItem.date, checked as boolean)
                        }
                      />
                      <label 
                        htmlFor={`date-${dateItem.date}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{formatDate(dateItem.date)}</div>
                        <div className="text-sm text-muted-foreground">{dateItem.date}</div>
                      </label>
                      <div className={`px-2 py-1 rounded text-xs ${
                        dateItem.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {dateItem.isActive ? 'Active' : 'Hidden'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Topics Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                Available Topics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control which topics are available for teachers to select for assessments
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading topics...</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {topics.map((topic) => (
                    <div key={topic.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`topic-${topic.id}`}
                        checked={topic.isActive}
                        onCheckedChange={(checked) => 
                          handleTopicToggle(topic.id, checked as boolean)
                        }
                      />
                      <label 
                        htmlFor={`topic-${topic.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{topic.name}</div>
                        <div className="text-sm text-muted-foreground">Topic ID: {topic.id}</div>
                      </label>
                      <div className={`px-2 py-1 rounded text-xs ${
                        topic.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {topic.isActive ? 'Active' : 'Hidden'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Check the boxes to make dates and topics available for teacher assessments</p>
              <p>• Uncheck to temporarily hide dates or topics from the teacher selection interface</p>
              <p>• Changes take effect immediately after saving</p>
              <p>• Teachers will only see active/checked dates and topics when selecting assessments</p>
              <p>• Hidden dates and topics can be re-enabled at any time</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}