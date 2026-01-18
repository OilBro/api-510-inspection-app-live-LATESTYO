import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProcessingResult {
  inspectionId: string;
  vesselTag: string;
  status: "success" | "error" | "pending" | "processing";
  message?: string;
}

export default function BatchReprocess() {
  const [, setLocation] = useLocation();
  const [selectedInspections, setSelectedInspections] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
  const [progress, setProgress] = useState(0);

  // Get all imported files with their inspection details
  const { data: importedFiles, isLoading } = trpc.batchReprocess.listImportedFiles.useQuery();

  // Filter to only PDF files
  const pdfFiles = importedFiles?.filter((file: { fileType: string }) => file.fileType === 'pdf') || [];

  const reprocessMutation = trpc.batchReprocess.reprocessSingle.useMutation();

  const toggleSelection = (inspectionId: string) => {
    const newSelection = new Set(selectedInspections);
    if (newSelection.has(inspectionId)) {
      newSelection.delete(inspectionId);
    } else {
      newSelection.add(inspectionId);
    }
    setSelectedInspections(newSelection);
  };

  const selectAll = () => {
    if (selectedInspections.size === pdfFiles.length) {
      setSelectedInspections(new Set());
    } else {
      setSelectedInspections(new Set(pdfFiles.map((f: typeof pdfFiles[0]) => f.id)));
    }
  };

  const handleBatchReprocess = async () => {
    if (selectedInspections.size === 0) {
      toast.error("Please select at least one inspection to re-process");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    const results: ProcessingResult[] = [];
    selectedInspections.forEach(id => {
      const file = pdfFiles.find((f: typeof pdfFiles[0]) => f.id === id);
      results.push({
        inspectionId: id,
        vesselTag: file?.vesselTagNumber || "Unknown",
        status: "pending" as const
      });
    });
    setProcessingResults(results);

    let completed = 0;
    const selectedArray = Array.from(selectedInspections);
    for (const fileId of selectedArray) {
      // Update status to processing
      setProcessingResults(prev => prev.map(r => 
        r.inspectionId === fileId ? { ...r, status: "processing" as const } : r
      ));

      try {
        await reprocessMutation.mutateAsync({
          importedFileId: fileId
        });

        setProcessingResults(prev => prev.map(r => 
          r.inspectionId === fileId 
            ? { ...r, status: "success" as const, message: "Successfully re-processed" }
            : r
        ));
      } catch (error) {
        setProcessingResults(prev => prev.map(r => 
          r.inspectionId === fileId 
            ? { ...r, status: "error" as const, message: error instanceof Error ? error.message : "Unknown error" }
            : r
        ));
      }

      completed++;
      setProgress((completed / selectedInspections.size) * 100);
    }

    setIsProcessing(false);
    toast.success(`Batch re-processing complete: ${completed} inspections processed`);
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading inspections...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Button 
        variant="ghost" 
        className="mb-6"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-amber-600" />
            Batch Re-Process PDFs
          </CardTitle>
          <CardDescription>
            Re-run improved AI extraction on previously imported PDFs to update TML readings, 
            calculations, and component data. This uses the latest parsing algorithms to 
            extract more accurate data from your existing inspection documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pdfFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No inspections with imported PDF files found.</p>
              <p className="text-sm mt-2">Import some inspection PDFs first, then return here to re-process them.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setLocation("/import")}
              >
                Go to Import Data
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedInspections.size === pdfFiles.length && pdfFiles.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select All ({pdfFiles.length} inspections with PDF files)
                  </span>
                </div>
                <Button 
                  onClick={handleBatchReprocess}
                  disabled={isProcessing || selectedInspections.size === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-Process Selected ({selectedInspections.size})
                    </>
                  )}
                </Button>
              </div>

              {isProcessing && (
                <div className="mb-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    Processing: {Math.round(progress)}% complete
                  </p>
                </div>
              )}

              <div className="border rounded-lg divide-y">
                {pdfFiles.map((file: typeof pdfFiles[0]) => {
                  const result = processingResults.find(r => r.inspectionId === file.id);
                  
                  return (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={selectedInspections.has(file.id)}
                          onCheckedChange={() => toggleSelection(file.id)}
                          disabled={isProcessing}
                        />
                        <div>
                          <p className="font-medium">{file.vesselTagNumber || "Unknown Vessel"}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.fileName || "PDF file"} • 
                            Imported {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result?.status === "processing" && (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        )}
                        {result?.status === "success" && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {result?.status === "error" && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-sm text-red-600">{result.message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
