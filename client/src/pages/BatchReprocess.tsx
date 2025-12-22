import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  ArrowLeft,
  PlayCircle,
  Info
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function BatchReprocess() {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [results, setResults] = useState<Array<{
    fileId: string;
    fileName: string;
    success: boolean;
    message: string;
  }>>([]);

  const { data: importedFiles, isLoading, refetch } = trpc.batchReprocess.listImportedFiles.useQuery();

  const reprocessSingle = trpc.batchReprocess.reprocessSingle.useMutation({
    onSuccess: (data) => {
      toast.success(`Re-processed: ${data.message}`);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const reprocessAll = trpc.batchReprocess.reprocessAll.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setIsProcessing(false);
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(`Batch re-process failed: ${error.message}`);
    },
  });

  const handleSelectAll = () => {
    if (importedFiles) {
      if (selectedFiles.size === importedFiles.length) {
        setSelectedFiles(new Set());
      } else {
        setSelectedFiles(new Set(importedFiles.map(f => f.id)));
      }
    }
  };

  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleReprocessSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.error("Please select at least one file to re-process");
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(selectedFiles.size);
    setResults([]);

    const selectedArray = Array.from(selectedFiles);
    const newResults: typeof results = [];

    for (let i = 0; i < selectedArray.length; i++) {
      const fileId = selectedArray[i];
      const file = importedFiles?.find(f => f.id === fileId);
      
      try {
        const result = await reprocessSingle.mutateAsync({ importedFileId: fileId });
        newResults.push({
          fileId,
          fileName: file?.fileName || "Unknown",
          success: true,
          message: result.message,
        });
      } catch (error) {
        newResults.push({
          fileId,
          fileName: file?.fileName || "Unknown",
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      
      setProcessedCount(i + 1);
      setResults([...newResults]);
    }

    setIsProcessing(false);
    setSelectedFiles(new Set());
    refetch();
  };

  const handleReprocessAll = () => {
    if (!importedFiles || importedFiles.length === 0) {
      toast.error("No files to re-process");
      return;
    }

    if (!confirm(`Are you sure you want to re-process all ${importedFiles.length} imported PDFs? This will update all TML readings, nozzle evaluations, and calculations with the improved extraction logic.`)) {
      return;
    }

    setIsProcessing(true);
    setTotalToProcess(importedFiles.length);
    setProcessedCount(0);
    setResults([]);
    reprocessAll.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case "processing":
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pdfFiles = importedFiles?.filter(f => f.fileType === "pdf") || [];

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Batch Re-Process PDFs</h1>
        <p className="text-muted-foreground">
          Re-run the improved AI extraction on previously imported PDFs to update TML readings, 
          nozzle evaluations, and component calculations with better head detection and nozzle identification.
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Improved Extraction</AlertTitle>
        <AlertDescription>
          The improved extraction now better identifies:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Both heads</strong> - North/South heads are now properly mapped to East/West Head calculations</li>
            <li><strong>Nozzle data</strong> - Nozzles are extracted and added to the Nozzle Evaluations page</li>
            <li><strong>Checklist items</strong> - Any checklist data in the PDF is now extracted</li>
          </ul>
        </AlertDescription>
      </Alert>

      {isProcessing && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="font-medium">Processing... {processedCount} of {totalToProcess}</p>
                <Progress value={(processedCount / totalToProcess) * 100} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !isProcessing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.success ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">{result.fileName}</span>
                  </div>
                  <span className={`text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
                    {result.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Imported PDF Files ({pdfFiles.length})
              </CardTitle>
              <CardDescription>
                Select files to re-process with improved extraction
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={isProcessing || pdfFiles.length === 0}
              >
                {selectedFiles.size === pdfFiles.length ? "Deselect All" : "Select All"}
              </Button>
              <Button
                variant="outline"
                onClick={handleReprocessSelected}
                disabled={isProcessing || selectedFiles.size === 0}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-process Selected ({selectedFiles.size})
              </Button>
              <Button
                onClick={handleReprocessAll}
                disabled={isProcessing || pdfFiles.length === 0}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Re-process All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : pdfFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No imported PDF files found.</p>
              <p className="text-sm mt-2">Import PDFs using "Import from PDF (AI)" on the dashboard.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pdfFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    selectedFiles.has(file.id) ? "bg-blue-50 border-blue-200" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleSelectFile(file.id)}
                      disabled={isProcessing}
                    />
                    <div>
                      <p className="font-medium">{file.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        Vessel: {file.vesselTagNumber}
                        {file.vesselName && ` - ${file.vesselName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Imported: {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : "Unknown"}
                        {file.processedAt && ` • Last processed: ${new Date(file.processedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(file.processingStatus)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reprocessSingle.mutate({ importedFileId: file.id })}
                      disabled={isProcessing || reprocessSingle.isPending}
                    >
                      {reprocessSingle.isPending && reprocessSingle.variables?.importedFileId === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
