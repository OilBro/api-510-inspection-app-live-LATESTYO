import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, AlertCircle, CheckCircle, Pencil, Save, X, Upload, Loader2, FileUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface InspectionResultsTabProps {
  inspectionId: string;
  inspectionResults: string | null | undefined;
  recommendations: string | null | undefined;
}

export default function InspectionResultsTab({ 
  inspectionId,
  inspectionResults, 
  recommendations 
}: InspectionResultsTabProps) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit state for inspection results
  const [isEditingResults, setIsEditingResults] = useState(false);
  const [editedResults, setEditedResults] = useState(inspectionResults || "");
  
  // Edit state for recommendations
  const [isEditingRecommendations, setIsEditingRecommendations] = useState(false);
  const [editedRecommendations, setEditedRecommendations] = useState(recommendations || "");
  
  // PDF upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const hasResults = inspectionResults && inspectionResults.trim().length > 0;
  const hasRecommendations = recommendations && recommendations.trim().length > 0;

  const updateMutation = trpc.inspections.updateResultsAndRecommendations.useMutation({
    onSuccess: () => {
      toast.success("Changes saved successfully");
      utils.inspections.get.invalidate({ id: inspectionId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save changes");
    },
  });

  const extractMutation = trpc.inspections.extractResultsFromPDF.useMutation({
    onSuccess: (data) => {
      if (data.inspectionResults || data.recommendations) {
        // Update the edited values with extracted content
        if (data.inspectionResults) {
          setEditedResults(data.inspectionResults);
          setIsEditingResults(true);
        }
        if (data.recommendations) {
          setEditedRecommendations(data.recommendations);
          setIsEditingRecommendations(true);
        }
        toast.success("Successfully extracted content from PDF! Review and save the changes.");
      } else {
        toast.warning("No Section 3.0 or 4.0 content found in the PDF");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to extract from PDF");
    },
  });

  // Parse the inspection results into sections if possible
  const parseResults = (text: string) => {
    // If we can't parse sections, return the whole text as one section
    if (!text.includes('\n') || text.length < 100) {
      return [{ title: 'Inspection Findings', content: text }];
    }

    // Split by numbered sections (3.1, 3.2, etc.)
    const numberedSections = text.split(/(?=\d+\.\d+\s)/);
    if (numberedSections.length > 1) {
      return numberedSections
        .filter(s => s.trim())
        .map(section => {
          const lines = section.trim().split('\n');
          const title = lines[0].replace(/^\d+\.\d+\s*/, '').trim() || 'Section';
          const content = lines.slice(1).join('\n').trim() || lines[0];
          return { title, content };
        });
    }

    // Return as single section
    return [{ title: 'Inspection Findings', content: text }];
  };

  const resultsSections = hasResults ? parseResults(inspectionResults!) : [];

  const handleSaveResults = () => {
    updateMutation.mutate({
      id: inspectionId,
      inspectionResults: editedResults || null,
    });
    setIsEditingResults(false);
  };

  const handleSaveRecommendations = () => {
    updateMutation.mutate({
      id: inspectionId,
      recommendations: editedRecommendations || null,
    });
    setIsEditingRecommendations(false);
  };

  const handleSaveBoth = () => {
    updateMutation.mutate({
      id: inspectionId,
      inspectionResults: editedResults || null,
      recommendations: editedRecommendations || null,
    });
    setIsEditingResults(false);
    setIsEditingRecommendations(false);
  };

  const handleCancelResults = () => {
    setEditedResults(inspectionResults || "");
    setIsEditingResults(false);
  };

  const handleCancelRecommendations = () => {
    setEditedRecommendations(recommendations || "");
    setIsEditingRecommendations(false);
  };

  const handleStartEditResults = () => {
    setEditedResults(inspectionResults || "");
    setIsEditingResults(true);
  };

  const handleStartEditRecommendations = () => {
    setEditedRecommendations(recommendations || "");
    setIsEditingRecommendations(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Please select a PDF file");
      return;
    }

    try {
      setIsUploading(true);
      
      // Upload the file to storage
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const { url } = await uploadResponse.json();
      setIsUploading(false);
      
      // Now extract from the uploaded PDF
      setIsExtracting(true);
      extractMutation.mutate({ pdfUrl: url });
      
    } catch (error) {
      toast.error("Failed to upload PDF file");
      console.error(error);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const isProcessing = isUploading || isExtracting || extractMutation.isPending;

  return (
    <div className="space-y-6">
      {/* PDF Upload Card */}
      <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileUp className="h-10 w-10 text-blue-500 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Extract from PDF
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4 max-w-md">
              Upload an API 510 inspection report PDF to automatically extract Section 3.0 (Inspection Results) and Section 4.0 (Recommendations)
            </p>
            <Button 
              onClick={triggerFileSelect}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploading ? "Uploading..." : "Extracting..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload PDF & Extract
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Show Save Both button when both are being edited */}
      {isEditingResults && isEditingRecommendations && (
        <div className="flex justify-center">
          <Button 
            onClick={handleSaveBoth}
            disabled={updateMutation.isPending}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      )}

      {/* Inspection Results Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <CardTitle>Section 3.0 - Inspection Results</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasResults ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Available
                </Badge>
              )}
              {!isEditingResults && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleStartEditResults}
                  className="ml-2"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Findings and observations from the inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingResults ? (
            <div className="space-y-4">
              <Textarea
                value={editedResults}
                onChange={(e) => setEditedResults(e.target.value)}
                placeholder="Enter inspection results here...

Example format:
3.1 Foundation
The foundation was found to be in satisfactory condition.

3.2 Shell
The shell was inspected and found to be in good condition with no visible corrosion.

3.3 Heads
Both heads were inspected and found to be in satisfactory condition.

3.4 Appurtenances
All nozzles, manways, and other appurtenances were inspected and found to be in good condition."
                className="min-h-[300px] font-mono text-sm"
              />
              {!isEditingRecommendations && (
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelResults}
                    disabled={updateMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveResults}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateMutation.isPending ? "Saving..." : "Save Results"}
                  </Button>
                </div>
              )}
            </div>
          ) : hasResults ? (
            <div className="space-y-4">
              {resultsSections.map((section, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                  <h4 className="font-medium text-gray-900 mb-2">{section.title}</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No inspection results available.</p>
              <p className="text-sm mt-2">
                Upload a PDF above or click "Edit" to add results manually.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <CardTitle>Section 4.0 - Recommendations</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasRecommendations ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Available
                </Badge>
              )}
              {!isEditingRecommendations && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleStartEditRecommendations}
                  className="ml-2"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Recommendations for repairs, replacements, and next inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingRecommendations ? (
            <div className="space-y-4">
              <Textarea
                value={editedRecommendations}
                onChange={(e) => setEditedRecommendations(e.target.value)}
                placeholder="Enter recommendations here...

Example format:
4.1 Based on the inspection findings, the following recommendations are made:

1. Continue with the current inspection interval of 5 years.
2. Monitor corrosion rates at CML locations showing higher than average metal loss.
3. Repair or replace any gaskets showing signs of deterioration during the next turnaround.
4. Maintain the existing coating system to prevent external corrosion.

4.2 Next Inspection Date: January 2031"
                className="min-h-[200px] font-mono text-sm"
              />
              {!isEditingResults && (
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelRecommendations}
                    disabled={updateMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveRecommendations}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateMutation.isPending ? "Saving..." : "Save Recommendations"}
                  </Button>
                </div>
              )}
            </div>
          ) : hasRecommendations ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{recommendations}</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No recommendations available.</p>
              <p className="text-sm mt-2">
                Upload a PDF above or click "Edit" to add recommendations manually.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
