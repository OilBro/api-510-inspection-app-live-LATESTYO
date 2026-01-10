import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Settings, ArrowLeft, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_TITLE } from "@/const";
import { toast } from "sonner";
import ExtractionPreview from "@/components/ExtractionPreview";

type ImportStep = "upload" | "preview" | "success";

export default function ImportData() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parserType, setParserType] = useState<"docupipe" | "manus" | "vision" | "hybrid">("hybrid");
  const [step, setStep] = useState<ImportStep>("upload");
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [savedInspectionId, setSavedInspectionId] = useState<string | null>(null);
  const [isNewInspection, setIsNewInspection] = useState(true);
  
  const previewMutation = trpc.importedFiles.previewExtraction.useMutation();
  const confirmMutation = trpc.importedFiles.confirmExtraction.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPDF = file.type === "application/pdf";
      const isExcel = 
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel" ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls");

      if (!isPDF && !isExcel) {
        toast.error("Please select a PDF or Excel file");
        return;
      }

      setSelectedFile(file);
      setStep("upload");
      setPreviewData(null);
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
          const result = await previewMutation.mutateAsync({
            fileData: base64Content,
            fileName: selectedFile.name,
            fileType,
            parserType,
          });

          if (result.success) {
            setPreviewData(result.preview);
            setPreviewSummary(result.summary);
            setStep("preview");
            toast.success("Data extracted! Review and edit before saving.");
          }
        } catch (error) {
          console.error("Preview error:", error);
          toast.error(`Failed to extract data: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
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
    setStep("upload");
    setPreviewData(null);
    setPreviewSummary(null);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep("upload");
    setPreviewData(null);
    setPreviewSummary(null);
    setSavedInspectionId(null);
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
            <div className={`flex items-center space-x-2 ${step === "preview" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "preview" ? "bg-primary text-white" : step === "success" ? "bg-green-500 text-white" : "bg-muted"}`}>
                {step === "success" ? <CheckCircle2 className="h-5 w-5" /> : "2"}
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
                      <span>Automatically extracts vessel identification</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Parses design specifications</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Extracts thickness measurement data</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>AI-powered intelligent parsing</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <FileSpreadsheet className="h-10 w-10 text-green-600 mb-2" />
                  <CardTitle>Excel Import</CardTitle>
                  <CardDescription>Upload inspection data from Excel spreadsheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Supports .xlsx and .xls formats</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Multi-sheet workbook processing</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Bulk TML reading import</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2">✔</span>
                      <span>Flexible column header matching</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>Select a PDF or Excel file to extract and preview inspection data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="parser">PDF Parser (for PDF files only)</Label>
                  <Select value={parserType} onValueChange={(value: "docupipe" | "manus" | "vision" | "hybrid") => setParserType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hybrid">Hybrid Auto-Detect (Recommended)</SelectItem>
                      <SelectItem value="docupipe">Docupipe API</SelectItem>
                      <SelectItem value="manus">Manus Built-in API</SelectItem>
                      <SelectItem value="vision">Vision Parser (For Scanned PDFs)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Hybrid Auto-Detect handles mixed text/scanned PDFs automatically. Use Vision Parser for fully scanned documents.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <Button
                  onClick={handlePreview}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                  size="lg"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {uploading ? "Extracting Data..." : "Extract & Preview"}
                </Button>

                {uploading && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <div>
                        <p className="font-medium text-blue-900">Processing file...</p>
                        <p className="text-sm text-blue-700">Extracting data with {parserType} parser</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Import Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Use Hybrid parser for mixed text/scanned PDFs - it auto-detects page types</span>
                  </li>
                  <li className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>You can edit all extracted data before saving to the database</span>
                  </li>
                  <li className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Missing fields can be added manually in the preview step</span>
                  </li>
                  <li className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Excel files should have clear column headers for vessel data and TML readings</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Preview Step */}
        {step === "preview" && previewData && (
          <Card>
            <CardHeader>
              <CardTitle>Review Extracted Data</CardTitle>
              <CardDescription>
                Review and edit the extracted data below. Click on any field to modify it before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExtractionPreview
                preview={previewData}
                summary={previewSummary}
                parserUsed={parserType}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                isConfirming={confirmMutation.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card>
            <CardContent className="pt-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {isNewInspection ? "Inspection Created Successfully!" : "Data Added Successfully!"}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {isNewInspection 
                      ? "A new inspection record has been created with the imported data."
                      : "The data has been added to the existing inspection record."}
                  </p>
                </div>
                <div className="flex gap-3 justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                  >
                    Import Another File
                  </Button>
                  <Button
                    onClick={() => setLocation(`/inspections/${savedInspectionId}`)}
                  >
                    View Inspection
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
