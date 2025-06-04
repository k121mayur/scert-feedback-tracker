import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, CheckCircle, XCircle, FileText, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  success: boolean;
  data: Array<{
    [key: string]: any;
    exists: string;
  }>;
  summary: {
    total: number;
    verified: number;
    unverified: number;
  };
}

export function CsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/admin/verify-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        toast({
          title: "Verification Complete",
          description: `Processed ${data.summary.total} records successfully.`,
        });
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to process CSV file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result?.data) return;

    // Convert data to CSV format
    const headers = Object.keys(result.data[0]);
    const csvContent = [
      headers.join(','),
      ...result.data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `verified_payment_ids_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Download Complete",
      description: "Verified CSV file has been downloaded.",
    });
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setUploading(false);
    setProcessing(false);
    // Reset file input
    const fileInput = document.getElementById('csvFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Upload CSV File</h3>
        <p className="text-muted-foreground mb-4">
          Select a CSV file to verify payment IDs against the database
        </p>
        
        <div className="flex flex-col items-center space-y-4">
          <Input
            id="csvFileInput"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="max-w-md"
          />
          
          {file && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {processing && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="loading-spinner w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Processing CSV File</h4>
                <p className="text-sm text-blue-700">Verifying payment IDs against database...</p>
                <Progress value={uploading ? 50 : 90} className="mt-2 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-secondary mx-auto mb-2" />
                <div className="text-2xl font-bold text-secondary">{result.summary.verified}</div>
                <div className="text-sm text-green-700">Verified Records</div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6 text-center">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <div className="text-2xl font-bold text-destructive">{result.summary.unverified}</div>
                <div className="text-sm text-red-700">Unverified Records</div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-primary">{result.summary.total}</div>
                <div className="text-sm text-blue-700">Total Records</div>
              </CardContent>
            </Card>
          </div>

          {/* Verification Details */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium text-foreground mb-4">Verification Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Time:</span>
                  <span className="font-medium">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-medium text-secondary">
                    {Math.round((result.summary.verified / result.summary.total) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-secondary">Verification Complete</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleDownload}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Updated CSV
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              Process Another File
            </Button>
          </div>
        </div>
      )}

      {/* Upload Actions */}
      {file && !result && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
          >
            {uploading ? (
              <>
                <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Payment IDs
              </>
            )}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={uploading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Verification Process</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Upload CSV file with payment ID column</li>
                <li>• System verifies each payment ID against teacher database</li>
                <li>• Results show "Yes" for verified IDs, "No" for unverified</li>
                <li>• Download updated CSV with verification status</li>
                <li>• Supported file size: Up to 10MB</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
