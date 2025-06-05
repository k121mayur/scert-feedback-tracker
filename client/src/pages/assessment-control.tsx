import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, BookOpen, Save, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Topic {
  id: string;
  name: string;
  isActive: boolean;
}

interface AssessmentDate {
  date: string;
  isActive: boolean;
  topics: Topic[];
}

export default function AssessmentControl() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const [assessmentDates, setAssessmentDates] = useState<AssessmentDate[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Load current assessment dates and topics
  useEffect(() => {
    loadAssessmentData();
  }, []);

  const loadAssessmentData = async () => {
    setLoading(true);
    try {
      // Load assessment dates with their topics
      const datesResponse = await fetch('/api/admin/assessment-control/dates');
      const datesData = await datesResponse.json();
      setAssessmentDates(datesData);
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

  const handleTopicToggle = (date: string, topicId: string, isActive: boolean) => {
    setAssessmentDates(prev => 
      prev.map(d => 
        d.date === date 
          ? { 
              ...d, 
              topics: d.topics.map(t => 
                t.id === topicId ? { ...t, isActive } : t
              )
            }
          : d
      )
    );
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Save date and topic settings
      await apiRequest('PUT', '/api/admin/assessment-control/dates', {
        dates: assessmentDates
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Assessment Dates with Topics Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Assessment Dates & Topic Control
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Control which dates are available and which topics teachers can access for each assessment date
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading assessment data...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {assessmentDates.map((dateItem) => (
                  <div key={dateItem.date} className="border rounded-lg p-4">
                    {/* Date Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`date-${dateItem.date}`}
                          checked={dateItem.isActive}
                          onCheckedChange={(checked) => 
                            handleDateToggle(dateItem.date, checked as boolean)
                          }
                        />
                        <label 
                          htmlFor={`date-${dateItem.date}`}
                          className="cursor-pointer"
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
                      
                      {/* Expand/Collapse Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDateExpansion(dateItem.date)}
                        className="flex items-center space-x-1"
                      >
                        {expandedDates.has(dateItem.date) ? (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            <span>Hide Topics</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-4 w-4" />
                            <span>Show Topics ({dateItem.topics.filter(t => t.isActive).length}/{dateItem.topics.length})</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Topics List */}
                    {expandedDates.has(dateItem.date) && (
                      <div className="ml-6 pl-4 border-l-2 border-muted">
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center">
                            <BookOpen className="mr-2 h-4 w-4" />
                            Available Topics for this Date
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                          {dateItem.topics.map((topic) => (
                            <div key={topic.id} className="flex items-center space-x-2 p-2 border rounded">
                              <Checkbox
                                id={`topic-${dateItem.date}-${topic.id}`}
                                checked={topic.isActive}
                                onCheckedChange={(checked) => 
                                  handleTopicToggle(dateItem.date, topic.id, checked as boolean)
                                }
                              />
                              <label 
                                htmlFor={`topic-${dateItem.date}-${topic.id}`}
                                className="flex-1 cursor-pointer text-sm"
                              >
                                <div className="font-medium line-clamp-2">{topic.name}</div>
                                <div className="text-xs text-muted-foreground">{topic.id}</div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Check date boxes to make assessment dates available for teachers</p>
              <p>• Expand each date to see and control which topics are available for that specific date</p>
              <p>• Teachers will only see active topics when selecting assessments for a particular date</p>
              <p>• Questions served during assessment will be filtered based on selected topics for that date</p>
              <p>• Changes take effect immediately after saving</p>
              <p>• Hidden dates and topics can be re-enabled at any time</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}