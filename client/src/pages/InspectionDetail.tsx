import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { Settings, ArrowLeft, FileText, Calculator, BarChart3, Eye, Upload, AlertCircle, RefreshCw, Layers, ClipboardList, Shield, AlertTriangle } from "lucide-react";
import { APP_TITLE } from "@/const";
import VesselDataTab from "@/components/inspection/VesselDataTab";
import ProfessionalReportTab from "@/components/inspection/ProfessionalReportTab";
import InspectionResultsTab from "@/components/inspection/InspectionResultsTab";
import ThicknessOrganizedView from "@/components/inspection/ThicknessOrganizedView";
import { ValidationWarnings } from "@/components/ValidationWarnings";
import { AnomalyPanel } from "@/components/inspection/AnomalyPanel";
import { toast } from "sonner";

export default function InspectionDetail() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState("vessel-data");

  const { data: inspection, isLoading } = trpc.inspections.get.useQuery({ id });
  const { data: tmlReadings } = trpc.tmlReadings.list.useQuery({ inspectionId: id });
  const utils = trpc.useUtils();

  const rescanMutation = trpc.anomalies.detectForInspection.useMutation({
    onSuccess: (result) => {
      toast.success(`Re-scan complete: ${result.anomalyCount} anomalies detected (${result.criticalCount} critical)`);
      utils.anomalies.getForInspection.invalidate({ inspectionId: id });
      utils.anomalies.getStatistics.invalidate();
    },
    onError: (error) => {
      toast.error(`Re-scan failed: ${error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "archived":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading inspection...</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-gray-600 mb-4">Inspection not found</p>
            <Button asChild>
              <Link href="/inspections">Back to Inspections</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{inspection.vesselTagNumber}</h1>
                <p className="text-sm text-gray-600">{inspection.vesselName || "No description"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={getStatusColor(inspection.status || "draft")}>
                {inspection.status || "draft"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => rescanMutation.mutate({ inspectionId: id })}
                disabled={rescanMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${rescanMutation.isPending ? 'animate-spin' : ''}`} />
                Re-scan Anomalies
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/rcra-compliance/${id}`}>
                  <Shield className="mr-2 h-4 w-4" />
                  RCRA Compliance
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/inspections">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Extraction Quality Warning Banner */}
      {inspection.extractionQuality && inspection.extractionQuality !== 'complete' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-medium text-amber-800">
                  Incomplete AI Extraction: {' '}
                  {inspection.extractionQuality === 'missing_both' && 'Both Inspection Results (Section 3.0) and Recommendations (Section 4.0) were not extracted.'}
                  {inspection.extractionQuality === 'missing_recommendations' && 'Recommendations (Section 4.0) were not extracted from the PDF.'}
                  {inspection.extractionQuality === 'missing_results' && 'Inspection Results (Section 3.0) were not extracted from the PDF.'}
                  {inspection.extractionQuality === 'needs_review' && 'This inspection needs manual review.'}
                </span>
                <span className="text-sm text-amber-700 ml-2">
                  Consider re-importing the PDF or manually entering the missing data.
                </span>
              </div>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <Link href="/import">
                  <Upload className="h-4 w-4 mr-1" />
                  Re-import
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Validation Warnings */}
        <div className="mb-6">
          <ValidationWarnings inspectionId={id} />
        </div>

        {/* Anomaly Detection */}
        <div className="mb-6">
          <AnomalyPanel inspectionId={id} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="vessel-data">
              <FileText className="h-4 w-4 mr-2" />
              Vessel Data
            </TabsTrigger>
            <TabsTrigger value="thickness">
              <Layers className="h-4 w-4 mr-2" />
              Thickness Analysis
            </TabsTrigger>
            <TabsTrigger value="results">
              <ClipboardList className="h-4 w-4 mr-2" />
              Results & Recommendations
            </TabsTrigger>
            <TabsTrigger value="professional">
              <FileText className="h-4 w-4 mr-2" />
              Professional Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vessel-data">
            <VesselDataTab inspection={inspection} />
          </TabsContent>

          <TabsContent value="thickness">
            <ThicknessOrganizedView readings={tmlReadings || []} />
          </TabsContent>

          <TabsContent value="results">
            <InspectionResultsTab 
              inspectionId={id}
              inspectionResults={inspection.inspectionResults} 
              recommendations={inspection.recommendations} 
            />
          </TabsContent>

          <TabsContent value="professional">
            <ProfessionalReportTab inspectionId={id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
