import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import NewExam from "@/pages/new-exam";
import Exam from "@/pages/exam";
import Results from "@/pages/results";
import Processing from "@/pages/processing";
import Feedback from "@/pages/feedback";
import Admin from "@/pages/admin";
import TeacherDetails from "@/pages/teacher-details";
import AddTeacher from "@/pages/add-teacher";
import EditTeacher from "@/pages/edit-teacher";
import AssessmentControl from "@/pages/assessment-control";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new-exam" component={NewExam} />
      <Route path="/exam" component={Exam} />
      <Route path="/results" component={Results} />
      <Route path="/processing" component={Processing} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/teacher-details" component={TeacherDetails} />
      <Route path="/admin/add-teacher" component={AddTeacher} />
      <Route path="/admin/edit-teacher" component={EditTeacher} />
      <Route path="/admin/assessment-control" component={AssessmentControl} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
