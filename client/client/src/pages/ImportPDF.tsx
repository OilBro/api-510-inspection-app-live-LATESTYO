import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";


export default function ImportPDF() {
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const extractMutation = trpc.pdfImport.extractFromPDF.useMutation();
  const saveMutation = trpc.pdfImport.saveExtractedData.useMutation();
  const uploadMutation = trpc.professionalReport.photos.upload.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setExtractedData(null);
    } else {
      toast.error("Please select a valid PDF file");
    }
  };

  const handleUploadAndExtract = async () => {
    if (!file) return;

    try {
      setUploading(true);
      
      // Convert file to base64 for upload
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const base64Data = await base64Promise;
      
      // Upload PDF using professional report photos upload mutation (reuse existing infrastructure)
      const uploadResult = await uploadMutation.mutateAsync({
        base64Data,
        filename: `pdfs/${Date.now()}-${file.name}`,
        contentType: 'application/pdf',
      });
      
      const pdfUrl = uploadResult.url;
      
      setUploading(false);
      setExtracting(true);

      // Extract data using AI
      const result = await extractMutation.mutateAsync({
        pdfUrl,
        fileName: file.name,
      });

      if (result.success) {
        setExtractedData(result.data);
        toast.success("Data extracted successfully! Review and save.");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;

    try {
      setSaving(true);
      
      const result = await saveMutation.mutateAsync(extractedData);
      
      if (result.success) {
        toast.success("Inspection imported successfully!");
        setLocation(`/inspections/${result.inspectionId}`);
      }
    } catch (error) {
      console.error("Save failed:", error);
      toast.error(`Failed to save inspection: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Import Inspection from PDF</CardTitle>
            <CardDescription>
              Upload an API 510 inspection report PDF and we'll automatically extract all the data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            {!extractedData && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">
                        {file ? file.name : "Choose PDF file"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click to browse or drag and drop
                      </p>
                    </div>
                  </label>
                </div>

                {file && (
                  <Button
                    onClick={handleUploadAndExtract}
                    disabled={uploading || extracting}
                    className="w-full"
                    size="lg"
                  >
                    {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {extracting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {uploading ? "Uploading..." : extracting ? "Extracting Data..." : "Process PDF"}
                  </Button>
                )}
              </div>
            )}

            {/* Extracted Data Preview */}
            {extractedData && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Data extracted successfully</span>
                </div>

                {/* Vessel Data */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Vessel Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tag Number:</span>
                      <p className="font-medium">{extractedData.vesselData.vesselTagNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vessel Name:</span>
                      <p className="font-medium">{extractedData.vesselData.vesselName || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manufacturer:</span>
                      <p className="font-medium">{extractedData.vesselData.manufacturer || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Year Built:</span>
                      <p className="font-medium">{extractedData.vesselData.yearBuilt || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Design Pressure:</span>
                      <p className="font-medium">{extractedData.vesselData.designPressure || "N/A"} psig</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Design Temp:</span>
                      <p className="font-medium">{extractedData.vesselData.designTemperature || "N/A"} °F</p>
                    </div>
                  </div>
                </div>

                {/* Thickness Measurements */}
                {extractedData.thicknessMeasurements && extractedData.thicknessMeasurements.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">
                      Thickness Measurements ({extractedData.thicknessMeasurements.length})
                    </h3>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2">CML</th>
                            <th className="text-left p-2">Component</th>
                            <th className="text-left p-2">Location</th>
                            <th className="text-right p-2">Thickness</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.thicknessMeasurements.map((tm: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{tm.cml}</td>
                              <td className="p-2">{tm.component}</td>
                              <td className="p-2">{tm.location || "-"}</td>
                              <td className="p-2 text-right">{tm.thickness}"</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Findings */}
                {extractedData.findings && extractedData.findings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">
                      Findings ({extractedData.findings.length})
                    </h3>
                    <div className="space-y-2">
                      {extractedData.findings.map((finding: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{finding.section}</span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                finding.severity === "critical"
                                  ? "bg-red-100 text-red-700"
                                  : finding.severity === "monitor"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{finding.finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setExtractedData(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Inspection
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

