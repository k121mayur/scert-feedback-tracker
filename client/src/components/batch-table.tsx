import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Trash2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Batch {
  id: number;
  batchName: string;
  district: string;
  coordinatorName: string;
  serviceType: string;
  trainingGroup: string;
  createdAt: string;
}

interface BatchTeacher {
  id: number;
  teacherName: string;
  teacherMobile: string;
  topicId: string;
  stopTime: string;
}

export function BatchTable() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [newBatch, setNewBatch] = useState({
    batchName: "",
    district: "",
    coordinatorName: "",
    serviceType: "",
    trainingGroup: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['/api/admin/batches'],
  });

  const { data: batchTeachers = [] } = useQuery({
    queryKey: ['/api/admin/batches', selectedBatch, 'teachers'],
    enabled: !!selectedBatch && isViewDialogOpen,
  });

  const createBatchMutation = useMutation({
    mutationFn: (batch: typeof newBatch) => apiRequest('POST', '/api/admin/batches', batch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/batches'] });
      setIsAddDialogOpen(false);
      setNewBatch({
        batchName: "",
        district: "",
        coordinatorName: "",
        serviceType: "",
        trainingGroup: "",
      });
      toast({
        title: "Success",
        description: "Batch created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create batch.",
        variant: "destructive",
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchName: string) => apiRequest('DELETE', `/api/admin/batches/${batchName}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/batches'] });
      toast({
        title: "Success",
        description: "Batch deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete batch.",
        variant: "destructive",
      });
    },
  });

  const handleCreateBatch = () => {
    if (!newBatch.batchName || !newBatch.district || !newBatch.coordinatorName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createBatchMutation.mutate(newBatch);
  };

  const handleDeleteBatch = (batchName: string) => {
    if (confirm("Are you sure you want to delete this batch?")) {
      deleteBatchMutation.mutate(batchName);
    }
  };

  const handleViewBatch = (batchName: string) => {
    setSelectedBatch(batchName);
    setIsViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <Card className="material-shadow-2">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            <span>Training Batches</span>
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Add New Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Batch</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="batchName">Batch Name</Label>
                  <Input
                    id="batchName"
                    value={newBatch.batchName}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, batchName: e.target.value }))}
                    placeholder="e.g., BATCH_NGP_001"
                  />
                </div>
                <div>
                  <Label htmlFor="district">District</Label>
                  <Input
                    id="district"
                    value={newBatch.district}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, district: e.target.value }))}
                    placeholder="e.g., Nagpur"
                  />
                </div>
                <div>
                  <Label htmlFor="coordinatorName">Coordinator Name</Label>
                  <Input
                    id="coordinatorName"
                    value={newBatch.coordinatorName}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, coordinatorName: e.target.value }))}
                    placeholder="e.g., Dr. Rajesh Kumar"
                  />
                </div>
                <div>
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Input
                    id="serviceType"
                    value={newBatch.serviceType}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, serviceType: e.target.value }))}
                    placeholder="e.g., Professional Development"
                  />
                </div>
                <div>
                  <Label htmlFor="trainingGroup">Training Group</Label>
                  <Input
                    id="trainingGroup"
                    value={newBatch.trainingGroup}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, trainingGroup: e.target.value }))}
                    placeholder="e.g., Primary Education"
                  />
                </div>
                <Button 
                  onClick={handleCreateBatch} 
                  disabled={createBatchMutation.isPending}
                  className="w-full"
                >
                  {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sr.No</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Batch Name</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Training Type</TableHead>
                <TableHead>Training Group</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No batches found. Create your first batch to get started.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch: Batch, index: number) => (
                  <TableRow key={batch.id} className="hover:bg-muted/50">
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{batch.district}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{batch.batchName}</div>
                        <div className="text-sm text-muted-foreground">Active</div>
                      </div>
                    </TableCell>
                    <TableCell>{batch.coordinatorName}</TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {batch.serviceType}
                      </span>
                    </TableCell>
                    <TableCell>{batch.trainingGroup}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewBatch(batch.batchName)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBatch(batch.batchName)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-900"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* View Batch Teachers Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Batch Teachers - {selectedBatch}</DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Topic ID</TableHead>
                    <TableHead>Stop Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchTeachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No teachers found for this batch.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batchTeachers.map((teacher: BatchTeacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>{teacher.teacherName}</TableCell>
                        <TableCell>{teacher.teacherMobile}</TableCell>
                        <TableCell>{teacher.topicId}</TableCell>
                        <TableCell>
                          {new Date(teacher.stopTime).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
