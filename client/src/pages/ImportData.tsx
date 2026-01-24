import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Settings, ArrowLeft, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, Eye, Loader2, Download, FileCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_TITLE } from "@/const";
import { toast } from "sonner";
import ExtractionPreview from "@/components/ExtractionPreview";
import { Progress } from "@/components/ui/progress";

type ImportStep = "upload" | "extracting" | "preview" | "success";

// Download template button component
function DownloadTemplateButton() {
  const { data, isLoading, refetch } = trpc.pdfImport.downloadTemplate.useQuery(undefined, {
    enabled: false, // Don't auto-fetch
  });

  const handleDownload = async () => {
    try {
      const result = await refetch();
      if (result.data) {
        // Convert base64 to blob
        const byteCharacters = atob(result.data.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.contentType });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Template downloaded!');
      }
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-4 w-full"
      onClick={handleDownload}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Download Excel Template
    </Button>
  );
}

export default function ImportData() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parserType, setParserType] = useState<"docupipe" | "manus" | "vision" | "hybrid">("hybrid");
  const [step, setStep] = useState<ImportStep>("upload");
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [savedInspectionId, setSavedInspectionId] = useState<string | null>(null);
  const [isNewInspection, setIsNewInspection] = useState(true);
  
  // Async extraction state
  const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionMessage, setExtractionMessage] = useState("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const startJobMutation = trpc.importedFiles.startExtractionJob.useMutation();
  const confirmMutation = trpc.importedFiles.confirmExtraction.useMutation();
  const utils = trpc.useUtils();

  // Poll for job status
  useEffect(() => {
    if (extractionJobId && step === "extracting") {
      const pollStatus = async () => {
        try {
          const status = await utils.importedFiles.getExtractionJobStatus.fetch({ jobId: extractionJobId });
          
          setExtractionProgress(status.progress || 0);
          setExtractionMessage(status.progressMessage || "Processing...");
          
          if (status.status === "completed" && status.extractedData) {
            // Stop polling
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            const data = status.extractedData as any;
            setPreviewData(data.preview);
            setPreviewSummary(data.summary);
            setStep("preview");
            toast.success("Data extracted! Review and edit before saving.");
          } else if (status.status === "failed") {
            // Stop polling
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            setStep("upload");
            toast.error(`Extraction failed: ${status.errorMessage || "Unknown error"}`);
          }
        } catch (error) {
          console.error("Error polling job status:", error);
        }
      };
      
      // Start polling every 2 seconds
      pollingIntervalRef.current = setInterval(pollStatus, 2000);
      // Also poll immediately
      pollStatus();
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [extractionJobId, step, utils]);

  // Validate and set file (shared by both input and drag-drop)
  const validateAndSetFile = (file: File) => {
    const isPDF = file.type === "application/pdf";
    const isExcel = 
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls");

    if (!isPDF && !isExcel) {
      toast.error("Please select a PDF or Excel file");
      return false;
    }
    
    // File size validation - 25MB limit
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 25MB limit. Please use a smaller file or split into multiple files.`);
      return false;
    }

    setSelectedFile(file);
    setStep("upload");
    setPreviewData(null);
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateAndSetFile(file)) {
        toast.success(`File "${file.name}" ready for import`);
      }
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(",")[1];

        const fileType = selectedFile.name.endsWith(".pdf") ? "pdf" : "excel";

        try {
          // Start async extraction job
          const result = await startJobMutation.mutateAsync({
            fileData: base64Content,
            fileName: selectedFile.name,
            fileType,
            parserType,
          });

          setExtractionJobId(result.jobId);
          setExtractionProgress(0);
          setExtractionMessage("Starting extraction...");
          setStep("extracting");
          setUploading(false);
          
        } catch (error) {
          console.error("Start job error:", error);
          toast.error(`Failed to start extraction: ${error instanceof Error ? error.message : "Unknown error"}`);
          setUploading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error("Upload failed");
      setUploading(false);
    }
  };

  const handleConfirm = async (data: any) => {
    try {
      const result = await confirmMutation.mutateAsync({
        vesselInfo: data.vesselInfo,
        reportInfo: data.reportInfo,
        tmlReadings: data.tmlReadings,
        nozzles: data.nozzles,
        narratives: data.narratives,
      });

      if (result.success) {
        setSavedInspectionId(result.inspectionId);
        setIsNewInspection(result.isNewInspection);
        setStep("success");
        toast.success(result.message);
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast.error(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleCancel = () => {
    // Stop any polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setStep("upload");
    setPreviewData(null);
    setPreviewSummary(null);
    setExtractionJobId(null);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep("upload");
    setPreviewData(null);
    setPreviewSummary(null);
    setSavedInspectionId(null);
    setExtractionJobId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">{APP_TITLE}</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Import Inspection Data</h2>
          <p className="text-gray-600">Upload PDF or Excel files to automatically extract and review inspection data before saving</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === "upload" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "upload" ? "bg-primary text-white" : "bg-green-500 text-white"}`}>
                {step !== "upload" ? <CheckCircle2 className="h-5 w-5" /> : "1"}
              </div>
              <span className="font-medium">Upload</span>
            </div>
            <div className="w-12 h-0.5 bg-muted" />
            <div className={`flex items-center space-x-2 ${step === "extracting" || step === "preview" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "extracting" ? "bg-primary text-white" : step === "preview" || step === "success" ? "bg-green-500 text-white" : "bg-muted"}`}>
                {step === "preview" || step === "success" ? <CheckCircle2 className="h-5 w-5" /> : step === "extracting" ? <Loader2 className="h-5 w-5 animate-spin" /> : "2"}
              </div>
              <span className="font-medium">Review & Edit</span>
            </div>
            <div className="w-12 h-0.5 bg-muted" />
            <div className={`flex items-center space-x-2 ${step === "success" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "success" ? "bg-green-500 text-white" : "bg-muted"}`}>
                {step === "success" ? <CheckCircle2 className="h-5 w-5" /> : "3"}
              </div>
              <span className="font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Extracting Step */}
        {step === "extracting" && (
          <Card className="mb-8">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center space-y-6">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">Extracting Data...</h3>
                  <p className="text-muted-foreground mb-4">{extractionMessage}</p>
                </div>
                <div className="w-full max-w-md">
                  <Progress value={extractionProgress} className="h-3" />
                  <p className="text-center text-sm text-muted-foreground mt-2">{extractionProgress}% complete</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes for large documents. Please don't close this page.
                </p>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Step */}
        {step === "upload" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <FileText className="h-10 w-10 text-red-600 mb-2" />
                  <CardTitle>PDF Import</CardTitle>
                  <CardDescription>Upload API 510 inspection reports in PDF format</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      Extracts vessel info, TML readings, nozzles
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      AI-powered data recognition
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      Supports scanned and digital PDFs
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <FileSpreadsheet className="h-10 w-10 text-green-600 mb-2" />
                  <CardTitle>Excel Import</CardTitle>
                  <CardDescription>Upload structured Excel spreadsheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      Imports TML readings from spreadsheets
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      Supports .xlsx and .xls formats
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      Fast structured data import
                    </li>
                  </ul>
                  <DownloadTemplateButton />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload File
                </CardTitle>
                <CardDescription>
                  Drag and drop a file or click to select
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : selectedFile
                      ? "border-green-500 bg-green-50"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                  }`}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {isDragging ? (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="h-12 w-12 text-primary animate-bounce" />
                      <p className="text-lg font-medium text-primary">Drop file here</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      {selectedFile.name.endsWith('.pdf') ? (
                        <FileText className="h-12 w-12 text-red-500" />
                      ) : (
                        <FileSpreadsheet className="h-12 w-12 text-green-600" />
                      )}
                      <div>
                        <p className="text-lg font-medium text-foreground">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                      >
                        Remove and select different file
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-medium text-foreground">Drag and drop your file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports PDF and Excel files (.pdf, .xlsx, .xls) up to 25MB
                      </p>
                    </div>
                  )}
                </div>

                {selectedFile?.name.endsWith(".pdf") && (
                  <div className="space-y-2">
                    <Label htmlFor="parser">Parser Type</Label>
                    <Select value={parserType} onValueChange={(v: any) => setParserType(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parser" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                        <SelectItem value="manus">Manus AI Parser</SelectItem>
                        <SelectItem value="vision">Vision Parser (for scanned)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Hybrid automatically detects and handles mixed text/scanned documents
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handlePreview} 
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Extraction...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Extract & Preview
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Preview Step */}
        {step === "preview" && previewData && (
          <ExtractionPreview
            preview={previewData}
            summary={previewSummary}
            parserUsed={parserType}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isConfirming={confirmMutation.isPending}
          />
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <h3 className="text-2xl font-bold">Import Successful!</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {isNewInspection 
                    ? "A new inspection record has been created with the extracted data."
                    : "The existing inspection record has been updated with the new data."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Button asChild className="bg-green-600 hover:bg-green-700">
                    <Link href={`/inspection/${savedInspectionId}/report`}>
                      <FileCheck className="mr-2 h-4 w-4" />
                      View Report
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/inspection/${savedInspectionId}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Inspection Details
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={handleReset}>
                    Import Another
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
