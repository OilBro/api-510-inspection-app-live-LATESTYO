import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Settings, ArrowLeft, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_TITLE } from "@/const";
import { toast } from "sonner";

export default function ImportData() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [showChecklistReview, setShowChecklistReview] = useState(false);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [parserType, setParserType] = useState<"docupipe" | "manus" | "vision">("docupipe");
  const [existingInspectionId, setExistingInspectionId] = useState<string | null>(null);
  const [continueMode, setContinueMode] = useState(false);
  
  const parseMutation = trpc.importedFiles.parseFile.useMutation();
  const finalizeMutation = trpc.importedFiles.finalizeChecklistImport.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
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
      setParseResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(",")[1]; // Remove data:...;base64, prefix

        const fileType = selectedFile.name.endsWith(".pdf") ? "pdf" : "excel";

        try {
          const result = await parseMutation.mutateAsync({
            fileData: base64Content,
            fileName: selectedFile.name,
            fileType,
            parserType, // Pass selected parser type
            inspectionId: existingInspectionId || undefined, // Append to existing if selected
          });

          setParseResult(result);
          
          // Check if checklist review is required
          if (result.requiresChecklistReview && result.checklistPreview) {
            setChecklistItems(result.checklistPreview);
            setShowChecklistReview(true);
            setUploading(false);
            toast.success("File imported! Please review checklist items.");
          } else {
            const message = result.isNewInspection 
              ? "New inspection created successfully!" 
              : "Data added to existing inspection!";
            toast.success(message);
            
            // Set continue mode and store inspection ID
            setExistingInspectionId(result.inspectionId);
            setContinueMode(true);
            setSelectedFile(null); // Clear file selection
            setUploading(false);
          }
        } catch (error) {
          console.error("Parse error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error("Detailed error:", errorMessage);
          toast.error(`Failed to parse file: ${errorMessage}`);
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Import Inspection Data</h2>
          <p className="text-gray-600">Upload PDF or Excel files to automatically create inspection records</p>
        </div>

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
                  <span className="text-primary mr-2">✓</span>
                  <span>Automatically extracts vessel identification</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Parses design specifications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Extracts thickness measurement data</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
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
                  <span className="text-primary mr-2">✓</span>
                  <span>Supports .xlsx and .xls formats</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Multi-sheet workbook processing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Bulk TML reading import</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">✓</span>
                  <span>Flexible column header matching</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Select a PDF or Excel file to import inspection data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="parser">PDF Parser (for PDF files only)</Label>
              <Select value={parserType} onValueChange={(value: "docupipe" | "manus" | "vision") => setParserType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docupipe">Docupipe API (Recommended)</SelectItem>
                  <SelectItem value="manus">Manus Built-in API</SelectItem>
                  <SelectItem value="vision">Vision Parser (For Scanned PDFs)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Choose which parser to use for PDF extraction. Use Vision Parser for scanned documents with images.</p>
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
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full"
              size="lg"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Processing..." : continueMode ? "Add Another File" : "Upload and Import"}
            </Button>

            {continueMode && parseResult && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Data successfully added!</p>
                    <p className="text-sm text-green-700 mt-1">
                      {parseResult.message || "Your data has been imported."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setLocation(`/inspections/${existingInspectionId}`)}
                    variant="default"
                    className="flex-1"
                  >
                    View Inspection
                  </Button>
                  <Button
                    onClick={() => {
                      setContinueMode(false);
                      setExistingInspectionId(null);
                      setParseResult(null);
                    }}
                    variant="outline"
                  >
                    Start New
                  </Button>
                </div>
                <p className="text-xs text-green-600">
                  💡 You can upload more files to add additional data to this inspection
                </p>
              </div>
            )}

            {uploading && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <div>
                    <p className="font-medium text-blue-900">Processing file...</p>
                    <p className="text-sm text-blue-700">This may take a few moments</p>
                  </div>
                </div>
              </div>
            )}

            {parseResult && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 mb-2">Import Successful!</p>
                    <div className="text-sm text-green-700 space-y-1">
                      {parseResult.parsedData.vesselTagNumber && (
                        <p>Vessel: {parseResult.parsedData.vesselTagNumber}</p>
                      )}
                      {parseResult.parsedData.vesselName && (
                        <p>Name: {parseResult.parsedData.vesselName}</p>
                      )}
                      {parseResult.parsedData.tmlReadings && parseResult.parsedData.tmlReadings.length > 0 && (
                        <p>TML Readings: {parseResult.parsedData.tmlReadings.length} locations imported</p>
                      )}
                    </div>
                    <p className="text-sm text-green-600 mt-3">Redirecting to inspection...</p>
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
                <span>Ensure PDF files are text-based (not scanned images) for best results</span>
              </li>
              <li className="flex items-start">
                <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <span>Excel files should have clear column headers for vessel data and TML readings</span>
              </li>
              <li className="flex items-start">
                <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <span>After import, review and complete any missing information in the inspection record</span>
              </li>
              <li className="flex items-start">
                <AlertCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <span>Imported data is automatically saved to the database for future reference</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Checklist Review Dialog */}
      <Dialog open={showChecklistReview} onOpenChange={setShowChecklistReview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Review Checklist Items</DialogTitle>
            <DialogDescription>
              {checklistItems.length} checklist items were found in the import. Please review and adjust the checked status before finalizing.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => {
                      const updated = [...checklistItems];
                      updated[index].checked = checked;
                      setChecklistItems(updated);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.category}</span>
                      {item.itemNumber && (
                        <span className="text-xs text-gray-500">#{item.itemNumber}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{item.itemText}</p>
                    {item.originalStatus && (
                      <p className="text-xs text-gray-500 mt-1">Original status: {item.originalStatus}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-600 mt-1 italic">{item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = checklistItems.map(item => ({ ...item, checked: true }));
                  setChecklistItems(updated);
                }}
              >
                Check All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updated = checklistItems.map(item => ({ ...item, checked: false }));
                  setChecklistItems(updated);
                }}
              >
                Uncheck All
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowChecklistReview(false);
                  setLocation(`/inspections/${parseResult.inspectionId}`);
                }}
              >
                Skip Checklist
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await finalizeMutation.mutateAsync({
                      inspectionId: parseResult.inspectionId,
                      checklistItems: checklistItems.map(item => ({
                        category: item.category,
                        itemNumber: item.itemNumber,
                        itemText: item.itemText,
                        checked: item.checked,
                        notes: item.notes,
                        checkedBy: item.checkedBy,
                        checkedDate: item.checkedDate,
                      })),
                    });
                    toast.success(`${checklistItems.length} checklist items imported!`);
                    setShowChecklistReview(false);
                    setLocation(`/inspections/${parseResult.inspectionId}`);
                  } catch (error) {
                    toast.error("Failed to finalize checklist import");
                  }
                }}
                disabled={finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? "Importing..." : "Finalize Import"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

