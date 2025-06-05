import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AddTeacher() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    teacherId: "",
    teacherName: "",
    mobile: "",
    payId: "",
    district: "",
    serviceType: "",
    trainingGroup: ""
  });

  const districts = [
    "Ahmednagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana", 
    "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule", 
    "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", 
    "Latur", "Mumbai", "Nagpur", "Nanded", "Nandurbar", "Nashik", 
    "Palghar", "Parbhani", "Pune", "Raigarh", "Ratnagiri", "Sangli", 
    "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"
  ];

  const serviceTypes = ["Selection Grade", "Senior Grade"];
  
  const trainingGroups = [
    "Arts Sports", "Higher Secondary", "Primary", "Secondary", 
    "Secondary & Higher Secondary", "Teacher Training Institute"
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMobileChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    handleInputChange('mobile', numericValue);
  };

  const generateTeacherId = () => {
    const district = formData.district;
    if (!district) return "";
    
    const prefix = district.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `TCH_${prefix}_${timestamp}`;
  };

  const generatePayId = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PAY_${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teacherName || !formData.mobile || !formData.district || !formData.serviceType || !formData.trainingGroup) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.mobile.length !== 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const teacherData = {
        ...formData,
        teacherId: formData.teacherId || generateTeacherId(),
        payId: formData.payId || generatePayId()
      };

      await apiRequest('POST', '/api/admin/teachers', teacherData);
      
      toast({
        title: "Success",
        description: "Teacher added successfully!",
      });
      
      setLocation('/admin');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add teacher. Please try again.",
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
                className="mr-4 flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <UserPlus className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-medium text-foreground">Add New Teacher</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Teacher Information</CardTitle>
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
                    onChange={(e) => handleMobileChange(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District *</Label>
                  <Select onValueChange={(value) => handleInputChange('district', value)}>
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
                  <Label htmlFor="serviceType">Service Type *</Label>
                  <Select onValueChange={(value) => handleInputChange('serviceType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trainingGroup">Training Group *</Label>
                  <Select onValueChange={(value) => handleInputChange('trainingGroup', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select training group" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainingGroups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="teacherId">Teacher ID</Label>
                  <Input
                    id="teacherId"
                    type="text"
                    value={formData.teacherId}
                    onChange={(e) => handleInputChange('teacherId', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payId">Payment ID</Label>
                  <Input
                    id="payId"
                    type="text"
                    value={formData.payId}
                    onChange={(e) => handleInputChange('payId', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to auto-generate
                  </p>
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
                  {loading ? "Adding..." : "Add Teacher"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}