import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Users, Building, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportResult {
  success: boolean;
  message: string;
  summary: {
    totalRecords: number;
    importedTeachers: number;
    importedBatches: number;
    importedBatchTeachers: number;
    skippedRecords: number;
    errors: string[];
  };
}

export function BulkTeacherImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/admin/bulk-import-teachers', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.summary.importedTeachers} teachers across ${data.summary.importedBatches} batches.`,
        });
      } else {
        throw new Error(data.message || 'Import failed');
      }
    } catch (error) {
      console.error("Error importing teachers:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import teacher data.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Bulk Teacher Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Upload Teacher CSV File</h3>
            <p className="text-muted-foreground mb-4">
              Import teacher data with districts, batches, service types, and contact information
            </p>
            
            <div className="flex flex-col items-center space-y-4">
              <Input
                id="teacherCsvInput"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="max-w-md"
              />
              
              {file && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {importing && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="loading-spinner w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Importing Teacher Data</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">Processing teachers, districts, and batches...</p>
                <Progress value={importing ? 60 : 100} className="mt-2 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {result && (
        <Card className={result.success ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"}>
          <CardHeader>
            <CardTitle className={`flex items-center ${result.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
              {result.success ? <CheckCircle className="mr-2 h-5 w-5" /> : <AlertCircle className="mr-2 h-5 w-5" />}
              Import {result.success ? "Completed" : "Failed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{result.summary.totalRecords}</div>
                <div className="text-sm text-muted-foreground">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.summary.importedTeachers}</div>
                <div className="text-sm text-muted-foreground">Teachers Imported</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.summary.importedBatches}</div>
                <div className="text-sm text-muted-foreground">Batches Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{result.summary.skippedRecords}</div>
                <div className="text-sm text-muted-foreground">Skipped Records</div>
              </div>
            </div>

            {result.summary.errors && result.summary.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Import Errors:</h4>
                <div className="bg-red-100 dark:bg-red-900 p-3 rounded text-sm">
                  {result.summary.errors.map((error, index) => (
                    <div key={index} className="text-red-800 dark:text-red-200">{error}</div>
                  ))}
                  {result.summary.errors.length >= 10 && (
                    <div className="text-red-600 dark:text-red-400 mt-2">... and more errors (showing first 10)</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Actions */}
      {file && !result && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleImport}
            disabled={importing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
          >
            {importing ? (
              <>
                <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Importing...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Import Teachers
              </>
            )}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={importing}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Building className="mr-2 h-4 w-4" />
            CSV Format Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Required columns:</strong> District, batch Name, Service type, Training group, Teacher ID, Teacher name, Phone number</p>
            <p><strong>Data processing:</strong> Creates districts, batches, teachers, and batch-teacher relationships automatically</p>
            <p><strong>Duplicate handling:</strong> Skips existing teachers and batches to prevent duplicates</p>
            <p><strong>Error handling:</strong> Records with missing essential data (district, batch name, teacher name, phone) are skipped</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}