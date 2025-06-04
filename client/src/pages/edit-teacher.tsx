import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TeacherData {
  id: number;
  teacherId: string;
  teacherName: string;
  mobile: string;
  payId: string;
  district: string;
}

export default function EditTeacher() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMobile, setSearchMobile] = useState("");
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    teacherName: "",
    mobile: "",
    payId: "",
    district: ""
  });

  const districts = ["Mumbai", "Pune", "Nashik", "Nagpur", "Aurangabad"];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setSearchMobile(numericValue);
  };

  const searchTeacher = async () => {
    if (searchMobile.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`/api/admin/teacher-by-mobile/${searchMobile}`);
      if (response.ok) {
        const data = await response.json();
        setTeacherData(data);
        setFormData({
          teacherName: data.teacherName,
          mobile: data.mobile,
          payId: data.payId || "",
          district: data.district
        });
        toast({
          title: "Teacher Found",
          description: "You can now edit the teacher details.",
        });
      } else {
        setTeacherData(null);
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
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teacherData) {
      toast({
        title: "No Teacher Selected",
        description: "Please search for a teacher first.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.teacherName || !formData.mobile || !formData.district) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      await apiRequest('PUT', `/api/admin/teachers/${teacherData.id}`, formData);
      
      toast({
        title: "Success",
        description: "Teacher updated successfully!",
      });
      
      setLocation('/admin');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
              <Edit className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-medium text-foreground">Edit Teacher</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="mr-2 h-5 w-5" />
              Search Teacher
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="searchMobile">Mobile Number</Label>
                <Input
                  id="searchMobile"
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={searchMobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  maxLength={10}
                />
              </div>
              <Button 
                onClick={searchTeacher}
                disabled={searchLoading || searchMobile.length !== 10}
              >
                {searchLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {teacherData && (
          <Card>
            <CardHeader>
              <CardTitle>Edit Teacher Information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Teacher ID: {teacherData.teacherId}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="teacherName">Teacher Name *</Label>
                    <Input
                      id="teacherName"
                      type="text"
                      value={formData.teacherName}
                      onChange={(e) => handleInputChange('teacherName', e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district">District *</Label>
                    <Select value={formData.district} onValueChange={(value) => handleInputChange('district', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payId">Payment ID</Label>
                    <Input
                      id="payId"
                      type="text"
                      value={formData.payId}
                      onChange={(e) => handleInputChange('payId', e.target.value)}
                      placeholder="Payment ID"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/admin')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Update Teacher"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}