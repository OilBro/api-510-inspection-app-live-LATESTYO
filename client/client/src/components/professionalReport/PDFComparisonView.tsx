import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PDFComparisonViewProps {
  inspectionId: string;
  reportId: string;
}

export default function PDFComparisonView({ inspectionId, reportId }: PDFComparisonViewProps) {
  const [zoom, setZoom] = useState(100);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get original uploaded PDF
  const { data: originalPdf, isLoading: loadingOriginal } = trpc.inspections.getOriginalPdf.useQuery({
    inspectionId,
  });

  // Generate professional report PDF
  const generatePdf = trpc.professionalReport.generatePDF.useMutation({
    onSuccess: (data) => {
      // Convert base64 PDF to blob URL
      const pdfBlob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setGeneratedPdfUrl(url);
      setIsGenerating(false);
      toast.success("Report generated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to generate report: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const handleGenerateReport = () => {
    setIsGenerating(true);
    generatePdf.mutate({ reportId, inspectionId });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  if (loadingOriginal) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!originalPdf) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No original PDF found for this inspection.
          </p>
          <p className="text-sm text-muted-foreground">
            Original PDFs are only available for inspections created via PDF import.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>PDF Comparison</CardTitle>
          <CardDescription>
            Compare the original uploaded PDF with the generated inspection report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {zoom}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleResetZoom}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1" />

            {!generatedPdfUrl && (
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            )}

            {generatedPdfUrl && (
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                variant="outline"
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Split View */}
      <div className="grid grid-cols-2 gap-4">
        {/* Original PDF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Original PDF</CardTitle>
            <CardDescription>Uploaded inspection document</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <iframe
                src={originalPdf?.url || ''}
                className="w-full"
                style={{ height: "800px", transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                title="Original PDF"
              />
            </div>
          </CardContent>
        </Card>

        {/* Generated Report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Report</CardTitle>
            <CardDescription>
              {generatedPdfUrl ? "Professional inspection report" : "Generate report to compare"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedPdfUrl ? (
              <div className="border rounded-lg overflow-hidden bg-gray-50">
                <iframe
                  src={generatedPdfUrl}
                  className="w-full"
                  style={{ height: "800px", transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                  title="Generated Report"
                />
              </div>
            ) : (
              <div className="border rounded-lg flex items-center justify-center bg-gray-50" style={{ height: "800px" }}>
                <div className="text-center text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No report generated yet</p>
                  <p className="text-sm mt-2">Click "Generate Report" to create the comparison</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
