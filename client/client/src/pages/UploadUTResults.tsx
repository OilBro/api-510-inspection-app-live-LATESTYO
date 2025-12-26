import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Upload, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

export default function UploadUTResults() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's inspections for selection
  const { data: inspections, isLoading: loadingInspections } = trpc.inspections.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Upload photo mutation (reuse existing infrastructure)
  const uploadMutation = trpc.professionalReport.photos.upload.useMutation();

  // Upload UT results mutation
  const uploadUTMutation = trpc.pdfImport.uploadUTResults.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      setSelectedFile(file);
      setUploadSuccess(false);
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedInspectionId) {
      toast.error("Please select both a file and a target inspection");
      return;
    }

    setUploading(true);
    setProcessing(false);
    setErrorMessage(null);

    try {
      // Convert file to base64
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const base64Data = await base64Promise;

      // Upload PDF to S3
      const uploadResult = await uploadMutation.mutateAsync({
        base64Data,
        filename: selectedFile.name,
        contentType: selectedFile.type,
      });

      setUploading(false);
      setProcessing(true);

      // Process UT results and add to inspection
      const result = await uploadUTMutation.mutateAsync({
        targetInspectionId: selectedInspectionId,
        pdfUrl: uploadResult.url,
        fileName: selectedFile.name,
      });

      setProcessing(false);
      setUploadSuccess(true);
      toast.success(result.message || "UT results uploaded successfully");

      // Reset form
      setSelectedFile(null);
      setSelectedInspectionId("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Navigate to the inspection detail page after a short delay
      setTimeout(() => {
        setLocation(`/inspections/${selectedInspectionId}`);
      }, 2000);
    } catch (error) {
      setUploading(false);
      setProcessing(false);
      const message = error instanceof Error ? error.message : "Failed to upload UT results";
      setErrorMessage(message);
      toast.error(message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to upload UT results</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Upload UT Results</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload New UT Results</h2>
          <p className="text-gray-600">
            Add new ultrasonic thickness measurements to an existing inspection report
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload UT Report</CardTitle>
            <CardDescription>
              Select an existing inspection and upload a PDF containing new thickness measurements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Inspection Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Target Inspection</label>
              {loadingInspections ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading inspections...</span>
                </div>
              ) : (
                <Select value={selectedInspectionId} onValueChange={setSelectedInspectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an inspection to update" />
                  </SelectTrigger>
                  <SelectContent>
                    {inspections?.map((inspection) => (
                      <SelectItem key={inspection.id} value={inspection.id}>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>
                            {inspection.vesselTagNumber || "Untitled"} -{" "}
                            {inspection.vesselName || "No Name"}
                            {inspection.inspectionDate &&
                              ` (${new Date(inspection.inspectionDate).toLocaleDateString()})`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                New thickness measurements will be added to the selected inspection
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload UT Report PDF</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="ut-file-input"
                />
                <label htmlFor="ut-file-input" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-900">Click to upload PDF</p>
                      <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Status Messages */}
            {uploading && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Uploading PDF file...</AlertDescription>
              </Alert>
            )}

            {processing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Extracting thickness measurements from PDF using AI...
                </AlertDescription>
              </Alert>
            )}

            {uploadSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  UT results uploaded successfully! Redirecting to inspection...
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedInspectionId || uploading || processing}
              className="w-full"
              size="lg"
            >
              {uploading || processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploading ? "Uploading..." : "Processing..."}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload UT Results
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Select the inspection report you want to update from the dropdown</li>
              <li>Upload a PDF containing the new ultrasonic thickness (UT) measurements</li>
              <li>Our AI will automatically extract all thickness readings from the PDF</li>
              <li>New measurements will be added to the selected inspection</li>
              <li>Corrosion rates and remaining life calculations will be updated automatically</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
