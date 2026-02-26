import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PDFComparisonView from "@/components/professionalReport/PDFComparisonView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Plus, Trash2, Upload, FileText, Mail, Calculator, CheckSquare, FileSpreadsheet, TrendingUp, AlertTriangle, Pencil, Printer } from "lucide-react";
import { DataQualityIndicator, CorrosionRateDisplay } from "@/components/DataQualityIndicator";
import { CalculationReportCard } from "./CalculationReportCard";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FindingsSection from "../professionalReport/FindingsSection";
import RecommendationsSection from "../professionalReport/RecommendationsSection";
import PhotosSection from "../professionalReport/PhotosSection";
import ChecklistSection from "../professionalReport/ChecklistSection";
import FfsAssessmentSection from "../professionalReport/FfsAssessmentSection";
import InLieuOfSection from "../professionalReport/InLieuOfSection";
import UploadsSection from "../professionalReport/UploadsSection";
import NozzleEvaluationSection from "../professionalReport/NozzleEvaluationSection";
import { ReportTemplateDialog, ReportSectionConfig } from "./ReportTemplateDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfessionalReportTabProps {
  inspectionId: string;
}

export default function ProfessionalReportTab({ inspectionId }: ProfessionalReportTabProps) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("info");
  const [generating, setGenerating] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  // Get or create professional report
  const { data: report, isLoading } = trpc.professionalReport.getOrCreate.useQuery({
    inspectionId,
  });

  // Update report mutation
  const updateReport = trpc.professionalReport.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.getOrCreate.invalidate();
      toast.success("Report updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update report: ${error.message}`);
    },
  });

  // Export CSV query
  const exportCSV = trpc.professionalReport.exportCSV.useQuery(
    {
      reportId: report?.id || '',
      inspectionId,
    },
    {
      enabled: false, // Don't auto-fetch
    }
  );

  const handleExportCSV = async () => {
    if (!report) return;
    setExportingCSV(true);

    try {
      const result = await exportCSV.refetch();

      if (result.data) {
        // Create blob and download
        const blob = new Blob([result.data.csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('CSV exported successfully!');
      }
    } catch (error: any) {
      toast.error(`Failed to export CSV: ${error.message}`);
    } finally {
      setExportingCSV(false);
    }
  };

  // Generate PDF mutation
  const generatePDF = trpc.professionalReport.generatePDF.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inspection-Report-${report?.reportNumber || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Professional report generated successfully!");
      setGenerating(false);
    },
    onError: (error) => {
      toast.error(`Failed to generate PDF: ${error.message}`);
      setGenerating(false);
    },
  });

  const handleGeneratePDF = (sectionConfig?: ReportSectionConfig) => {
    if (!report) return;
    setGenerating(true);
    generatePDF.mutate({
      reportId: report.id,
      inspectionId,
      sectionConfig,
    });
  };

  const handleOpenTemplateDialog = () => {
    setTemplateDialogOpen(true);
  };

  const handleUpdateField = (field: string, value: string) => {
    if (!report) return;
    updateReport.mutate({
      reportId: report.id,
      data: { [field]: value },
    });
  };

  const handleOpenEmailDialog = () => {
    // Pre-fill subject with report info
    setEmailSubject(`Inspection Report - ${report?.reportNumber || 'Report'}`);
    setEmailMessage(`Please find attached the professional inspection report.\n\nReport Number: ${report?.reportNumber || 'N/A'}\nInspector: ${report?.inspectorName || 'N/A'}\nClient: ${report?.clientName || 'N/A'}`);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!report || !emailRecipient) {
      toast.error("Please enter recipient email address");
      return;
    }

    setSendingEmail(true);
    try {
      // Note: Backend email endpoint needs implementation
      // This is a placeholder that simulates the email sending process
      console.log('Sending email to:', emailRecipient);
      console.log('Subject:', emailSubject);
      console.log('Message:', emailMessage);

      // Simulate API call (replace with actual tRPC mutation)
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success(`Report sent to ${emailRecipient}`);
      setEmailDialogOpen(false);
      setEmailRecipient("");
    } catch (error) {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Failed to load professional report</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Professional Inspection Report</h2>
          <p className="text-sm text-muted-foreground">
            API 510 Pressure Vessel Inspection Report - Complete Documentation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleGeneratePDF()}
            disabled={generating}
            size="lg"
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate Full Report
              </>
            )}
          </Button>
          <Button
            onClick={handleOpenTemplateDialog}
            disabled={generating}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Custom Template
          </Button>
          <Button
            onClick={handleOpenEmailDialog}
            disabled={generating}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Generate & Email
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={exportingCSV}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            {exportingCSV ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
          <Button
            onClick={() => window.location.href = `/validation/${inspectionId}`}
            size="lg"
            variant="outline"
            className="gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            Validate Calculations
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calculations">Calculations</TabsTrigger>
          <TabsTrigger value="nozzles">Nozzle Evaluation</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="ffs">FFS Assessment</TabsTrigger>
          <TabsTrigger value="inlieu">In-Lieu-Of</TabsTrigger>
        </TabsList>

        {/* Report Information Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Information</CardTitle>
              <CardDescription>
                Basic report metadata and client information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportNumber">Report Number</Label>
                  <Input
                    id="reportNumber"
                    value={report.reportNumber || ""}
                    onChange={(e) => handleUpdateField("reportNumber", e.target.value)}
                    placeholder="RPT-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportDate">Report Date</Label>
                  <Input
                    id="reportDate"
                    type="date"
                    value={report.reportDate ? new Date(report.reportDate).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleUpdateField("reportDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inspectorName">Inspector Name</Label>
                  <Input
                    id="inspectorName"
                    value={report.inspectorName || ""}
                    onChange={(e) => handleUpdateField("inspectorName", e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspectorCertification">API 510 Certification</Label>
                  <Input
                    id="inspectorCertification"
                    value={report.inspectorCertification || ""}
                    onChange={(e) => handleUpdateField("inspectorCertification", e.target.value)}
                    placeholder="API-510-12345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employerName">Employer/Company Name</Label>
                <Input
                  id="employerName"
                  value={report.employerName || ""}
                  onChange={(e) => handleUpdateField("employerName", e.target.value)}
                  placeholder="OilPro Consulting LLC"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Client details and approval information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={report.clientName || ""}
                    onChange={(e) => handleUpdateField("clientName", e.target.value)}
                    placeholder="SACHEM INC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientLocation">Client Location</Label>
                  <Input
                    id="clientLocation"
                    value={report.clientLocation || ""}
                    onChange={(e) => handleUpdateField("clientLocation", e.target.value)}
                    placeholder="CLEBURNE TX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientContact">Client Contact</Label>
                <Input
                  id="clientContact"
                  value={report.clientContact || ""}
                  onChange={(e) => handleUpdateField("clientContact", e.target.value)}
                  placeholder="Contact person and phone"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientApprovalName">Client Approval Name</Label>
                  <Input
                    id="clientApprovalName"
                    value={report.clientApprovalName || ""}
                    onChange={(e) => handleUpdateField("clientApprovalName", e.target.value)}
                    placeholder="Approval signature name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientApprovalTitle">Client Approval Title</Label>
                  <Input
                    id="clientApprovalTitle"
                    value={report.clientApprovalTitle || ""}
                    onChange={(e) => handleUpdateField("clientApprovalTitle", e.target.value)}
                    placeholder="Title/Position"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
              <CardDescription>
                High-level summary of inspection findings and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="executiveSummary">Summary</Label>
                <Textarea
                  id="executiveSummary"
                  value={report.executiveSummary || ""}
                  onChange={(e) => handleUpdateField("executiveSummary", e.target.value)}
                  placeholder="A criterion for nondestructive examinations was conducted on vessel..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="governingComponent">Governing Component</Label>
                <Input
                  id="governingComponent"
                  value={report.governingComponent || ""}
                  onChange={(e) => handleUpdateField("governingComponent", e.target.value)}
                  placeholder="Shell 1, North Head, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextExternalInspectionClient">Next External Inspection (Client)</Label>
                  <Input
                    id="nextExternalInspectionClient"
                    type="date"
                    value={report.nextExternalInspectionClient ? new Date(report.nextExternalInspectionClient).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleUpdateField("nextExternalInspectionClient", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextExternalInspectionAPI">Next External Inspection (API)</Label>
                  <Input
                    id="nextExternalInspectionAPI"
                    type="date"
                    value={report.nextExternalInspectionAPI ? new Date(report.nextExternalInspectionAPI).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleUpdateField("nextExternalInspectionAPI", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextInternalInspection">Next Internal Inspection</Label>
                  <Input
                    id="nextInternalInspection"
                    type="date"
                    value={report.nextInternalInspection ? new Date(report.nextInternalInspection).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleUpdateField("nextInternalInspection", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextUTInspection">Next UT Inspection</Label>
                  <Input
                    id="nextUTInspection"
                    type="date"
                    value={report.nextUTInspection ? new Date(report.nextUTInspection).toISOString().split('T')[0] : ""}
                    onChange={(e) => handleUpdateField("nextUTInspection", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance & Risk Assessment</CardTitle>
              <CardDescription>
                Compliance status and risk classification for this inspection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="api510Compliant"
                    checked={report.api510Compliant ?? true}
                    onChange={(e) => handleUpdateField("api510Compliant", e.target.checked.toString())}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="api510Compliant" className="cursor-pointer">
                    API 510 Compliant
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="asmeCompliant"
                    checked={report.asmeCompliant ?? true}
                    onChange={(e) => handleUpdateField("asmeCompliant", e.target.checked.toString())}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="asmeCompliant" className="cursor-pointer">
                    ASME Compliant
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="riskClassification">Risk Classification</Label>
                  <Select
                    value={report.riskClassification || "medium"}
                    onValueChange={(value) => handleUpdateField("riskClassification", value)}
                  >
                    <SelectTrigger id="riskClassification">
                      <SelectValue placeholder="Select risk level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="critical">Critical Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operationalEfficiencyScore">Operational Efficiency Score (0-100)</Label>
                  <Input
                    id="operationalEfficiencyScore"
                    type="number"
                    min="0"
                    max="100"
                    value={report.operationalEfficiencyScore || ""}
                    onChange={(e) => handleUpdateField("operationalEfficiencyScore", e.target.value)}
                    placeholder="85"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="complianceNotes">Compliance Notes</Label>
                <Textarea
                  id="complianceNotes"
                  value={report.complianceNotes || ""}
                  onChange={(e) => handleUpdateField("complianceNotes", e.target.value)}
                  placeholder="Additional notes regarding compliance status or risk factors..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculations Tab */}
        <TabsContent value="calculations">
          <ComponentCalculationsSection reportId={report.id} inspectionId={inspectionId} />
        </TabsContent>

        {/* Nozzle Evaluation Tab */}
        <TabsContent value="nozzles">
          <NozzleEvaluationSection inspectionId={inspectionId} />
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          <PDFComparisonView inspectionId={inspectionId} reportId={report.id} />
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings">
          <InspectionFindingsSection reportId={report.id} />
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <RecommendationsSection reportId={report.id} />
        </TabsContent>

        {/* Uploads Tab */}
        <TabsContent value="uploads">
          <UploadsSection reportId={report.id} inspectionId={inspectionId} />
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos">
          <PhotosSection reportId={report.id} />
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist">
          <ChecklistSection reportId={report.id} />
        </TabsContent>

        {/* FFS Assessment Tab */}
        <TabsContent value="ffs">
          <FfsAssessmentSection inspectionId={inspectionId} />
        </TabsContent>

        {/* In-Lieu-Of Tab */}
        <TabsContent value="inlieu">
          <InLieuOfSection inspectionId={inspectionId} />
        </TabsContent>
      </Tabs>

      {/* Template Selection Dialog */}
      <ReportTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onGenerate={handleGeneratePDF}
      />

      {/* Email Delivery Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate & Email Report</DialogTitle>
            <DialogDescription>
              Send the professional inspection report directly to the recipient's email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-recipient">Recipient Email *</Label>
              <Input
                id="email-recipient"
                type="email"
                placeholder="client@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                rows={6}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              The PDF report will be generated and attached to this email automatically.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailRecipient}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Report
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component Calculations Section
function ComponentCalculationsSection({ reportId, inspectionId }: { reportId: string; inspectionId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [componentType, setComponentType] = useState<"shell" | "head">("shell");
  const [recalculating, setRecalculating] = useState(false);
  const [editingCalc, setEditingCalc] = useState<any>(null);
  const [detailedView, setDetailedView] = useState(false);
  const utils = trpc.useUtils();

  const { data: calculations, isLoading } = trpc.professionalReport.componentCalculations.list.useQuery({
    reportId,
  });

  // Get inspection data for vessel identification in detailed reports
  const { data: inspection } = trpc.inspections.get.useQuery({ id: inspectionId });

  const createCalculation = trpc.professionalReport.componentCalculations.create.useMutation({
    onSuccess: () => {
      utils.professionalReport.componentCalculations.list.invalidate();
      toast.success("Component calculation added");
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to add calculation: ${error.message}`);
    },
  });

  const deleteCalculation = trpc.professionalReport.componentCalculations.delete.useMutation({
    onSuccess: () => {
      utils.professionalReport.componentCalculations.list.invalidate();
      toast.success("Component calculation deleted");
    },
  });

  const updateCalculation = trpc.professionalReport.componentCalculations.update.useMutation({
    onSuccess: () => {
      utils.professionalReport.componentCalculations.list.invalidate();
      toast.success("Component calculation updated");
      setEditingCalc(null);
    },
    onError: (error) => {
      toast.error(`Failed to update calculation: ${error.message}`);
    },
  });

  const recalculate = trpc.professionalReport.recalculate.useMutation({
    onSuccess: () => {
      utils.professionalReport.componentCalculations.list.invalidate();
      toast.success("Component calculations regenerated successfully");
      setRecalculating(false);
    },
    onError: (error) => {
      toast.error(`Failed to recalculate: ${error.message}`);
      setRecalculating(false);
    },
  });

  const handleRecalculate = () => {
    setRecalculating(true);
    recalculate.mutate({ inspectionId });
  };

  const handleExportTemplate = () => {
    // Create Excel template with component calculation columns
    const headers = [
      "Component Name",
      "Component Type (shell/head)",
      "Material Code",
      "Material Name",
      "Design Temperature (°F)",
      "Design MAWP (psi)",
      "Static Head (psi)",
      "Corrosion Allowance (in)",
      "Inside Diameter (in)",
      "Nominal Thickness (in)",
      "Measured Thickness (in)",
      "Joint Efficiency",
      "Allowable Stress (psi)",
      "Head Type (ellipsoidal/hemispherical/torispherical)",
      "Crown Radius (in)",
      "Knuckle Radius (in)"
    ];

    // Create CSV content
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `component-calculations-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handlePrintCalculationReport = () => {
    if (!calculations || calculations.length === 0) {
      toast.error("No calculations to print");
      return;
    }

    // Generate PDF content for regulatory-compliant calculation report
    const vesselId = inspection?.vesselTagNumber || inspection?.vesselName || "Unknown Vessel";
    const inspectionDate = inspection?.inspectionDate
      ? new Date(inspection.inspectionDate).toLocaleDateString()
      : new Date().toLocaleDateString();
    const reportDate = new Date().toLocaleDateString();

    // Build HTML content for printing
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Calculation Report - ${vesselId}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #333; }
    .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #1e40af; margin: 0 0 5px 0; font-size: 18pt; }
    .header h2 { color: #374151; margin: 0; font-size: 12pt; font-weight: normal; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 9pt; }
    .meta-info div { flex: 1; }
    .component { border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; margin-bottom: 20px; page-break-before: auto; }
    .component-header { background: #f3f4f6; margin: -15px -15px 15px -15px; padding: 10px 15px; border-radius: 8px 8px 0 0; border-bottom: 1px solid #d1d5db; }
    .component-header h3 { margin: 0; color: #1f2937; font-size: 12pt; }
    .component-header .type { color: #6b7280; font-size: 9pt; }
    .section { margin-bottom: 15px; page-break-inside: avoid; break-inside: avoid; }
    .section-title { font-weight: bold; color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; font-size: 10pt; }
    .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .data-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #e5e7eb; }
    .data-label { color: #6b7280; font-size: 9pt; }
    .data-value { font-weight: 500; text-align: right; }
    .formula-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; margin: 8px 0; font-family: 'Courier New', monospace; font-size: 9pt; page-break-inside: avoid; break-inside: avoid; }
    .formula-title { font-weight: bold; color: #475569; margin-bottom: 5px; }
    .formula-step { margin: 3px 0; }
    .result-box { background: #ecfdf5; border: 1px solid #10b981; border-radius: 4px; padding: 10px; margin-top: 10px; page-break-inside: avoid; break-inside: avoid; }
    .result-box.warning { background: #fef3c7; border-color: #f59e0b; }
    .result-box.danger { background: #fee2e2; border-color: #ef4444; }
    .result-title { font-weight: bold; color: #059669; }
    .result-box.warning .result-title { color: #d97706; }
    .result-box.danger .result-title { color: #dc2626; }
    .assumptions { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 10px; margin: 10px 0; page-break-inside: avoid; break-inside: avoid; }
    .assumptions-title { font-weight: bold; color: #92400e; margin-bottom: 5px; }
    .assumptions ul { margin: 0; padding-left: 20px; }
    .code-ref { color: #6366f1; font-style: italic; font-size: 8pt; }
    .certification { border: 2px solid #1e40af; border-radius: 8px; padding: 15px; margin-top: 30px; page-break-inside: avoid; break-inside: avoid; }
    .certification-title { font-weight: bold; color: #1e40af; font-size: 11pt; margin-bottom: 10px; }
    .signature-line { border-bottom: 1px solid #333; width: 250px; margin: 30px 0 5px 0; }
    .signature-label { font-size: 9pt; color: #6b7280; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>MECHANICAL INTEGRITY CALCULATION REPORT</h1>
    <h2>API 510 Pressure Vessel Inspection</h2>
  </div>
  
  <div class="meta-info">
    <div><strong>Vessel ID:</strong> ${vesselId}</div>
    <div><strong>Inspection Date:</strong> ${inspectionDate}</div>
    <div><strong>Report Date:</strong> ${reportDate}</div>
  </div>

  ${calculations.map(calc => {
      const tAct = parseFloat(calc.actualThickness || '0');
      const tMin = parseFloat(calc.minimumThickness || '0');
      const cr = parseFloat(calc.corrosionRate || '0');
      const rl = parseFloat(calc.remainingLife || '0');
      const mawp = parseFloat(calc.calculatedMAWP || '0');
      const designMawp = parseFloat(calc.designMAWP || '0');
      const isBelowMin = tAct < tMin;
      const isLowLife = rl < 2;

      return `
    <div class="component">
      <div class="component-header">
        <h3>${calc.componentName}</h3>
        <span class="type">${calc.componentType === 'shell' ? 'Shell Evaluation per ASME VIII-1 UG-27' : 'Head Evaluation per ASME VIII-1 UG-32'}</span>
      </div>
      
      <div class="section">
        <div class="section-title">1. DESIGN DATA</div>
        <div class="data-grid">
          <div class="data-item"><span class="data-label">Design MAWP:</span><span class="data-value">${calc.designMAWP || '-'} psi</span></div>
          <div class="data-item"><span class="data-label">Design Temperature:</span><span class="data-value">${calc.designTemp || '-'} °F</span></div>
          <div class="data-item"><span class="data-label">Material:</span><span class="data-value">${calc.materialName || calc.materialCode || '-'}</span></div>
          <div class="data-item"><span class="data-label">Allowable Stress (S):</span><span class="data-value">${calc.allowableStress || '-'} psi</span></div>
          <div class="data-item"><span class="data-label">Joint Efficiency (E):</span><span class="data-value">${calc.jointEfficiency || '-'}</span></div>
          <div class="data-item"><span class="data-label">Inside Diameter:</span><span class="data-value">${calc.insideDiameter || '-'} in</span></div>
        </div>
        <p class="code-ref">Source: Manufacturer's Data Report (U-1), ASME Section II Part D</p>
      </div>
      
      <div class="section">
        <div class="section-title">2. THICKNESS DATA</div>
        <div class="data-grid">
          <div class="data-item"><span class="data-label">Nominal Thickness:</span><span class="data-value">${calc.nominalThickness || '-'} in</span></div>
          <div class="data-item"><span class="data-label">Previous Thickness:</span><span class="data-value">${calc.previousThickness || '-'} in</span></div>
          <div class="data-item"><span class="data-label">Current Thickness (t_act):</span><span class="data-value">${calc.actualThickness || '-'} in</span></div>
          <div class="data-item"><span class="data-label">Time Between Readings:</span><span class="data-value">${calc.timeSpan || '-'} years</span></div>
        </div>
        <p class="code-ref">Source: UT Thickness Measurements per API 510 §7.1</p>
      </div>
      
      <div class="section">
        <div class="section-title">3. MINIMUM THICKNESS CALCULATION</div>
        <div class="formula-box">
          <div class="formula-title">Formula: ${calc.componentType === 'shell' ? 't_min = PR / (SE - 0.6P)' : 't_min = PLM / (2SE - 0.2P)'}</div>
          <div class="formula-step">Where:</div>
          <div class="formula-step">  P = Design Pressure = ${calc.designMAWP || '-'} psi</div>
          <div class="formula-step">  R = Inside Radius = ${calc.insideDiameter ? (parseFloat(calc.insideDiameter) / 2).toFixed(3) : '-'} in</div>
          <div class="formula-step">  S = Allowable Stress = ${calc.allowableStress || '-'} psi</div>
          <div class="formula-step">  E = Joint Efficiency = ${calc.jointEfficiency || '-'}</div>
          <div class="formula-step" style="margin-top: 8px; font-weight: bold;">Result: t_min = ${calc.minimumThickness || '-'} in</div>
        </div>
        <p class="code-ref">Reference: ASME Section VIII Division 1, ${calc.componentType === 'shell' ? 'UG-27' : 'UG-32'}</p>
      </div>
      
      <div class="section">
        <div class="section-title">4. CORROSION RATE CALCULATION</div>
        <div class="formula-box">
          <div class="formula-title">Formula: Cr = (t_prev - t_act) / Years</div>
          <div class="formula-step">Cr = (${calc.previousThickness || '-'} - ${calc.actualThickness || '-'}) / ${calc.timeSpan || '-'}</div>
          <div class="formula-step" style="margin-top: 8px; font-weight: bold;">Result: Cr = ${calc.corrosionRate || '-'} in/yr</div>
          ${calc.governingRateType && calc.governingRateType !== 'nominal' ? `<div class="formula-step" style="color: #d97706;">Governing Rate: ${calc.governingRateType === 'long_term' ? 'Long-Term' : 'Short-Term'} ${calc.governingRateReason ? '- ' + calc.governingRateReason : ''}</div>` : ''}
        </div>
        <p class="code-ref">Reference: API 510 §7.1.1</p>
      </div>
      
      <div class="section">
        <div class="section-title">5. REMAINING LIFE CALCULATION</div>
        <div class="formula-box">
          <div class="formula-title">Formula: RL = (t_act - t_min) / Cr</div>
          <div class="formula-step">Corrosion Allowance: Ca = t_act - t_min = ${calc.actualThickness || '-'} - ${calc.minimumThickness || '-'} = ${calc.corrosionAllowance || (tAct - tMin).toFixed(4)} in</div>
          <div class="formula-step">RL = ${calc.corrosionAllowance || (tAct - tMin).toFixed(4)} / ${calc.corrosionRate || '-'}</div>
          <div class="formula-step" style="margin-top: 8px; font-weight: bold;">Result: RL = ${calc.remainingLife || '-'} years</div>
        </div>
        <p class="code-ref">Reference: API 510 §7.1.1</p>
      </div>
      
      <div class="section">
        <div class="section-title">6. MAWP CALCULATION</div>
        <div class="formula-box">
          <div class="formula-title">Formula: ${calc.componentType === 'shell' ? 'MAWP = (SE × t_act) / (R + 0.6 × t_act)' : 'MAWP = (2SE × t_act) / (LM + 0.2 × t_act)'}</div>
          <div class="formula-step" style="margin-top: 8px; font-weight: bold;">Result: MAWP = ${calc.calculatedMAWP || '-'} psi</div>
          ${mawp >= designMawp ? '<div class="formula-step" style="color: #059669;">✓ Calculated MAWP exceeds Design MAWP</div>' : '<div class="formula-step" style="color: #dc2626;">⚠ Calculated MAWP is below Design MAWP - DERATE REQUIRED</div>'}
        </div>
        <p class="code-ref">Reference: ASME Section VIII Division 1, ${calc.componentType === 'shell' ? 'UG-27' : 'UG-32'}</p>
      </div>
      
      <div class="assumptions">
        <div class="assumptions-title">ASSUMPTIONS</div>
        <ul>
          <li>Uniform corrosion assumed unless otherwise noted</li>
          <li>No localized pitting or stress corrosion cracking observed</li>
          <li>Material properties per ASME Section II Part D at design temperature</li>
          <li>Weld joint efficiency per original construction records</li>
          ${calc.dataQualityNotes ? `<li>${calc.dataQualityNotes}</li>` : ''}
        </ul>
      </div>
      
      <div class="result-box ${isBelowMin ? 'danger' : isLowLife ? 'warning' : ''}">
        <div class="result-title">EVALUATION SUMMARY</div>
        <div class="data-grid" style="margin-top: 8px;">
          <div class="data-item"><span class="data-label">Current Thickness:</span><span class="data-value">${calc.actualThickness || '-'} in</span></div>
          <div class="data-item"><span class="data-label">Minimum Required:</span><span class="data-value">${calc.minimumThickness || '-'} in</span></div>
          <div class="data-item"><span class="data-label">Calculated MAWP:</span><span class="data-value">${calc.calculatedMAWP || '-'} psi</span></div>
          <div class="data-item"><span class="data-label">Remaining Life:</span><span class="data-value">${calc.remainingLife || '-'} years</span></div>
        </div>
        <p style="margin-top: 10px; font-weight: bold;">
          ${isBelowMin ? '⚠ COMPONENT IS BELOW MINIMUM THICKNESS - IMMEDIATE ACTION REQUIRED' :
          isLowLife ? '⚠ REMAINING LIFE IS LOW - SCHEDULE REPAIR OR REPLACEMENT' :
            '✓ Component is acceptable for continued service'}
        </p>
      </div>
    </div>
    `;
    }).join('')}
  
  <div class="certification">
    <div class="certification-title">REPORT CERTIFICATION</div>
    <p>I hereby certify that the calculations presented in this report have been performed in accordance with the applicable codes and standards referenced herein. All input data has been verified against available records and field measurements.</p>
    <p><strong>Applicable Codes:</strong> API 510 (Pressure Vessel Inspection Code), ASME Section VIII Division 1</p>
    <div class="signature-line"></div>
    <div class="signature-label">API 510 Authorized Inspector / Date</div>
    <div class="signature-line" style="margin-top: 20px;"></div>
    <div class="signature-label">Reviewed By / Date</div>
  </div>
</body>
</html>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      toast.success("Print dialog opened");
    } else {
      toast.error("Could not open print window. Please allow popups.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file. Click 'Export Template' to get the correct format.");
      e.target.value = "";
      return;
    }

    toast.info("Importing components...");

    try {
      // Read CSV/Excel file
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());

      if (lines.length < 2) {
        toast.error("File is empty or invalid");
        return;
      }

      const headers = lines[0].split(",");
      const dataLines = lines.slice(1);

      for (const line of dataLines) {
        const values = line.split(",");
        const componentData: any = {
          componentName: values[0]?.trim() || "",
          componentType: values[1]?.trim().toLowerCase() === "head" ? "head" : "shell",
          materialCode: values[2]?.trim() || "",
          materialName: values[3]?.trim() || "",
          designTemp: values[4]?.trim() || "",
          designMAWP: values[5]?.trim() || "",
          staticHead: values[6]?.trim() || "0",
          corrosionAllowance: values[7]?.trim() || "",
          insideDiameter: values[8]?.trim() || "",
          nominalThickness: values[9]?.trim() || "",
          measuredThickness: values[10]?.trim() || "",
          jointEfficiency: values[11]?.trim() || "",
          allowableStress: values[12]?.trim() || "",
        };

        if (componentData.componentType === "head") {
          componentData.headType = values[13]?.trim() || "ellipsoidal";
          componentData.crownRadius = values[14]?.trim() || "";
          componentData.knuckleRadius = values[15]?.trim() || "";
        }

        if (componentData.componentName) {
          await createCalculation.mutateAsync({ reportId, ...componentData });
        }
      }

      toast.success(`Imported ${dataLines.length} components`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import file");
    }

    // Reset input
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Mechanical Integrity Calculations</h3>
          <p className="text-sm text-muted-foreground">
            Shell and head evaluations per ASME Section VIII
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={detailedView ? "default" : "outline"}
            className="gap-2"
            onClick={() => setDetailedView(!detailedView)}
          >
            <FileText className="h-4 w-4" />
            {detailedView ? "Summary View" : "Detailed Report"}
          </Button>
          {detailedView && calculations && calculations.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handlePrintCalculationReport()}
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => handleExportTemplate()}>
            <Download className="h-4 w-4" />
            Export Template
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => document.getElementById('component-import-input')?.click()}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button
            onClick={handleRecalculate}
            disabled={recalculating}
            variant="outline"
            className="gap-2"
          >
            {recalculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            Recalculate
          </Button>
          <input
            id="component-import-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Component
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Component Calculation</DialogTitle>
                <DialogDescription>
                  Enter component data for mechanical integrity evaluation
                </DialogDescription>
              </DialogHeader>
              <ComponentCalculationForm
                reportId={reportId}
                componentType={componentType}
                onComponentTypeChange={setComponentType}
                onSubmit={(data) => createCalculation.mutate({ reportId, ...data })}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {calculations && calculations.length > 0 ? (
        <div className="grid gap-4">
          {calculations.map((calc) => {
            const ltRate = parseFloat(calc.corrosionRateLongTerm || '0');
            const stRate = parseFloat(calc.corrosionRateShortTerm || '0');
            const govRate = parseFloat(calc.corrosionRate || '0');
            const govType = (calc.governingRateType || 'nominal') as 'long_term' | 'short_term' | 'nominal';
            const dataStatus = (calc.dataQualityStatus || 'good') as 'good' | 'anomaly' | 'growth_error' | 'below_minimum' | 'confirmed';

            // Render detailed regulatory-compliant report card
            if (detailedView) {
              return (
                <CalculationReportCard
                  key={calc.id}
                  calculation={{
                    ...calc,
                    componentType: calc.componentType as "shell" | "head",
                  }}
                  vesselId={inspection?.vesselTagNumber || inspection?.vesselName || undefined}
                  inspectorName={undefined}
                  inspectionDate={inspection?.inspectionDate ? new Date(inspection.inspectionDate).toLocaleDateString() : undefined}
                  onEdit={() => setEditingCalc(calc)}
                  onDelete={() => deleteCalculation.mutate({ calcId: calc.id })}
                />
              );
            }
            // Render summary card (original view)
            return (
              <Card key={calc.id} className={dataStatus === 'below_minimum' ? 'border-red-500 border-2' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {calc.componentName}
                          {govType !== 'nominal' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant={govType === 'short_term' ? 'destructive' : 'secondary'} className="text-xs">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    {govType === 'long_term' ? 'LT' : 'ST'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    {govType === 'long_term' ? 'Long-term rate is governing' : 'Short-term rate is governing (accelerated corrosion)'}
                                    {calc.governingRateReason && <><br /><br />{calc.governingRateReason}</>}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {dataStatus === 'below_minimum' && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              UNSAFE
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {calc.componentType === "shell" ? "Shell Evaluation" : "Head Evaluation"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingCalc(calc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCalculation.mutate({ calcId: calc.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Data Quality Alert */}
                  {dataStatus !== 'good' && (
                    <DataQualityIndicator
                      status={dataStatus}
                      notes={calc.dataQualityNotes || undefined}
                    />
                  )}

                  {/* Dual Corrosion Rates */}
                  {(ltRate > 0 || stRate > 0) && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Corrosion Rate Analysis
                      </h4>
                      <CorrosionRateDisplay
                        longTermRate={ltRate}
                        shortTermRate={stRate}
                        governingRate={govRate}
                        governingType={govType}
                        governingReason={calc.governingRateReason || undefined}
                      />
                    </div>
                  )}

                  {/* Main Calculation Results */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Material</p>
                      <p className="font-medium">{calc.materialCode || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Design MAWP</p>
                      <p className="font-medium">{calc.designMAWP} psi</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Thickness</p>
                      <p className="font-medium">{calc.minimumThickness} in</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining Life</p>
                      <p className={`font-medium ${parseFloat(calc.remainingLife || '999') < 5 ? 'text-red-600 font-bold' : parseFloat(calc.remainingLife || '999') < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {calc.remainingLife} years
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Governing Rate</p>
                      <p className="font-medium">{(govRate * 1000).toFixed(1)} mpy</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MAWP @ Next Insp</p>
                      <p className="font-medium">{calc.mawpAtNextInspection} psi</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual Thickness</p>
                      <p className="font-medium">{calc.actualThickness} in</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next Inspection</p>
                      <p className="font-medium">{calc.nextInspectionYears} years</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No component calculations added yet
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Component
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Component Dialog */}
      <Dialog open={!!editingCalc} onOpenChange={(open) => !open && setEditingCalc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Component: {editingCalc?.componentName}</DialogTitle>
            <DialogDescription>
              Update the component values. Calculations will be recalculated automatically.
            </DialogDescription>
          </DialogHeader>
          {editingCalc && (
            <ComponentEditForm
              calculation={editingCalc}
              onSave={(data) => {
                updateCalculation.mutate({ calcId: editingCalc.id, data });
              }}
              onCancel={() => setEditingCalc(null)}
              isSaving={updateCalculation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component Edit Form
function ComponentEditForm({
  calculation,
  onSave,
  onCancel,
  isSaving
}: {
  calculation: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    componentName: calculation.componentName || '',
    materialCode: calculation.materialCode || '',
    materialName: calculation.materialName || '',
    designTemp: calculation.designTemp || '',
    designMAWP: calculation.designMAWP || '',
    staticHead: calculation.staticHead || '0',
    specificGravity: calculation.specificGravity || '1.0',
    insideDiameter: calculation.insideDiameter || '',
    nominalThickness: calculation.nominalThickness || '',
    allowableStress: calculation.allowableStress || '',
    jointEfficiency: calculation.jointEfficiency || '1.0',
    headType: calculation.headType || 'torispherical',
    crownRadius: calculation.crownRadius || '',
    knuckleRadius: calculation.knuckleRadius || '',
    previousThickness: calculation.previousThickness || '',
    actualThickness: calculation.actualThickness || '',
    timeSpan: calculation.timeSpan || '',
    nextInspectionYears: calculation.nextInspectionYears || '5',
    // Calculated result fields — preserved on save so they don't get wiped
    minimumThickness: calculation.minimumThickness || '',
    corrosionRate: calculation.corrosionRate || '',
    corrosionRateLongTerm: calculation.corrosionRateLongTerm || '',
    corrosionRateShortTerm: calculation.corrosionRateShortTerm || '',
    governingRateType: calculation.governingRateType || '',
    remainingLife: calculation.remainingLife || '',
    corrosionAllowance: calculation.corrosionAllowance || '',
    calculatedMAWP: calculation.calculatedMAWP || '',
    mawpAtNextInspection: calculation.mawpAtNextInspection || '',
    thicknessAtNextInspection: calculation.thicknessAtNextInspection || '',
    pressureAtNextInspection: calculation.pressureAtNextInspection || '',
    dataQualityStatus: calculation.dataQualityStatus || '',
    dataQualityNotes: calculation.dataQualityNotes || '',
    governingRateReason: calculation.governingRateReason || '',
    headFactor: calculation.headFactor || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-componentName">Component Name</Label>
          <Input
            id="edit-componentName"
            value={formData.componentName}
            onChange={(e) => handleChange('componentName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-materialCode">Material Code</Label>
          <Input
            id="edit-materialCode"
            value={formData.materialCode}
            onChange={(e) => handleChange('materialCode', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-designTemp">Design Temp (°F)</Label>
          <Input
            id="edit-designTemp"
            value={formData.designTemp}
            onChange={(e) => handleChange('designTemp', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-designMAWP">Design MAWP (psi)</Label>
          <Input
            id="edit-designMAWP"
            value={formData.designMAWP}
            onChange={(e) => handleChange('designMAWP', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-insideDiameter">Inside Diameter (in)</Label>
          <Input
            id="edit-insideDiameter"
            value={formData.insideDiameter}
            onChange={(e) => handleChange('insideDiameter', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-nominalThickness">Nominal Thickness (in)</Label>
          <Input
            id="edit-nominalThickness"
            value={formData.nominalThickness}
            onChange={(e) => handleChange('nominalThickness', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-actualThickness">Actual Thickness (in)</Label>
          <Input
            id="edit-actualThickness"
            value={formData.actualThickness}
            onChange={(e) => handleChange('actualThickness', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-previousThickness">Previous Thickness (in)</Label>
          <Input
            id="edit-previousThickness"
            value={formData.previousThickness}
            onChange={(e) => handleChange('previousThickness', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-allowableStress">Allowable Stress (psi)</Label>
          <Input
            id="edit-allowableStress"
            value={formData.allowableStress}
            onChange={(e) => handleChange('allowableStress', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-jointEfficiency">Joint Efficiency</Label>
          <Input
            id="edit-jointEfficiency"
            value={formData.jointEfficiency}
            onChange={(e) => handleChange('jointEfficiency', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-timeSpan">Time Span (years)</Label>
          <Input
            id="edit-timeSpan"
            value={formData.timeSpan}
            onChange={(e) => handleChange('timeSpan', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-staticHead">Static Head (psi)</Label>
          <Input
            id="edit-staticHead"
            value={formData.staticHead}
            onChange={(e) => handleChange('staticHead', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-specificGravity">Specific Gravity</Label>
          <Input
            id="edit-specificGravity"
            value={formData.specificGravity}
            onChange={(e) => handleChange('specificGravity', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-nextInspectionYears">Next Inspection (years)</Label>
          <Input
            id="edit-nextInspectionYears"
            value={formData.nextInspectionYears}
            onChange={(e) => handleChange('nextInspectionYears', e.target.value)}
          />
        </div>
      </div>

      {calculation.componentType === 'head' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-headType">Head Type</Label>
            <Select
              value={formData.headType}
              onValueChange={(value) => handleChange('headType', value)}
            >
              <SelectTrigger id="edit-headType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ellipsoidal">Ellipsoidal (2:1)</SelectItem>
                <SelectItem value="hemispherical">Hemispherical</SelectItem>
                <SelectItem value="torispherical">Torispherical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-crownRadius">Crown Radius (in)</Label>
            <Input
              id="edit-crownRadius"
              value={formData.crownRadius}
              onChange={(e) => handleChange('crownRadius', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-knuckleRadius">Knuckle Radius (in)</Label>
            <Input
              id="edit-knuckleRadius"
              value={formData.knuckleRadius}
              onChange={(e) => handleChange('knuckleRadius', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Calculated Results — Manual Override Section */}
      <div className="border-t pt-4 mt-4">
        <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
          📊 Calculated Results (Override)
          <span className="text-xs font-normal text-muted-foreground">Edit these to manually override final report values</span>
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-minimumThickness">Min Thickness / t_min (in)</Label>
            <Input
              id="edit-minimumThickness"
              value={formData.minimumThickness}
              onChange={(e) => handleChange('minimumThickness', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-corrosionRate">Corrosion Rate (in/yr)</Label>
            <Input
              id="edit-corrosionRate"
              value={formData.corrosionRate}
              onChange={(e) => handleChange('corrosionRate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-remainingLife">Remaining Life (years)</Label>
            <Input
              id="edit-remainingLife"
              value={formData.remainingLife}
              onChange={(e) => handleChange('remainingLife', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div className="space-y-2">
            <Label htmlFor="edit-corrosionAllowance">Corrosion Allowance (in)</Label>
            <Input
              id="edit-corrosionAllowance"
              value={formData.corrosionAllowance}
              onChange={(e) => handleChange('corrosionAllowance', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-calculatedMAWP">Calculated MAWP (psi)</Label>
            <Input
              id="edit-calculatedMAWP"
              value={formData.calculatedMAWP}
              onChange={(e) => handleChange('calculatedMAWP', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-mawpAtNextInspection">MAWP @ Next Inspection (psi)</Label>
            <Input
              id="edit-mawpAtNextInspection"
              value={formData.mawpAtNextInspection}
              onChange={(e) => handleChange('mawpAtNextInspection', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}

// Component Calculation Form
interface ComponentCalculationFormProps {
  reportId: string;
  componentType: "shell" | "head";
  onComponentTypeChange: (type: "shell" | "head") => void;
  onSubmit: (data: any) => void;
}

function ComponentCalculationForm({
  componentType,
  onComponentTypeChange,
  onSubmit,
}: ComponentCalculationFormProps) {
  const [formData, setFormData] = useState<any>({
    componentName: "",
    componentType,
    materialSpec: "",
    designTemp: "",
    designMAWP: "",
    staticHead: "0",
    specificGravity: "1.0",
    insideDiameter: "",
    nominalThickness: "",
    allowableStress: "",
    jointEfficiency: "1.0",
    headType: "torispherical",
    crownRadius: "",
    knuckleRadius: "",
    previousThickness: "",
    actualThickness: "",
    timeSpan: "",
    nextInspectionYears: "5",
    externalPressure: "",
    unsupportedLength: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, componentType });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Component Type</Label>
        <Select
          value={componentType}
          onValueChange={(value) => {
            onComponentTypeChange(value as "shell" | "head");
            setFormData((prev: any) => ({ ...prev, componentType: value }));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shell">Shell</SelectItem>
            <SelectItem value="head">Head</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="componentName">Component Name *</Label>
          <Input
            id="componentName"
            value={formData.componentName}
            onChange={(e) => handleChange("componentName", e.target.value)}
            placeholder="Shell 1, North Head, etc."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="materialSpec">Material Specification *</Label>
          <Select
            value={formData.materialSpec || ""}
            onValueChange={(value) => handleChange("materialSpec", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select material..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SA-516-70">SA-516 Grade 70 (Carbon Steel)</SelectItem>
              <SelectItem value="SA-106-B">SA-106 Grade B (Pipe)</SelectItem>
              <SelectItem value="SA-105">SA-105 (Forgings)</SelectItem>
              <SelectItem value="SA-240-304">SA-240 Type 304 (Stainless)</SelectItem>
              <SelectItem value="SA-240-316">SA-240 Type 316 (Stainless)</SelectItem>
              <SelectItem value="SA-387-11-2">SA-387 Grade 11 Class 2 (Chrome-Moly)</SelectItem>
              <SelectItem value="SA-387-22-2">SA-387 Grade 22 Class 2 (Chrome-Moly)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="designTemp">Design Temp (°F) *</Label>
          <Input
            id="designTemp"
            value={formData.designTemp}
            onChange={(e) => handleChange("designTemp", e.target.value)}
            placeholder="250"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designMAWP">Design MAWP (psi) *</Label>
          <Input
            id="designMAWP"
            value={formData.designMAWP}
            onChange={(e) => handleChange("designMAWP", e.target.value)}
            placeholder="250"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insideDiameter">Inside Diameter (in) *</Label>
          <Input
            id="insideDiameter"
            value={formData.insideDiameter}
            onChange={(e) => handleChange("insideDiameter", e.target.value)}
            placeholder="72.000"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nominalThickness">Nominal Thickness (in) *</Label>
          <Input
            id="nominalThickness"
            value={formData.nominalThickness}
            onChange={(e) => handleChange("nominalThickness", e.target.value)}
            placeholder="0.500"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="allowableStress">Allowable Stress (psi) *</Label>
          <Input
            id="allowableStress"
            value={formData.allowableStress}
            onChange={(e) => handleChange("allowableStress", e.target.value)}
            placeholder="20000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jointEfficiency">Joint Efficiency *</Label>
          <Select
            value={formData.jointEfficiency}
            onValueChange={(value) => handleChange("jointEfficiency", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.0">1.0 (Fully RT)</SelectItem>
              <SelectItem value="0.85">0.85 (Spot RT)</SelectItem>
              <SelectItem value="0.70">0.70 (No RT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {componentType === "head" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="headType">Head Type</Label>
            <Select
              value={formData.headType}
              onValueChange={(value) => handleChange("headType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hemispherical">Hemispherical</SelectItem>
                <SelectItem value="ellipsoidal">Ellipsoidal 2:1</SelectItem>
                <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crownRadius">Crown Radius (in)</Label>
            <Input
              id="crownRadius"
              value={formData.crownRadius}
              onChange={(e) => handleChange("crownRadius", e.target.value)}
              placeholder="72.000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="knuckleRadius">Knuckle Radius (in)</Label>
            <Input
              id="knuckleRadius"
              value={formData.knuckleRadius}
              onChange={(e) => handleChange("knuckleRadius", e.target.value)}
              placeholder="4.320"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="previousThickness">Previous Thickness (in) *</Label>
          <Input
            id="previousThickness"
            value={formData.previousThickness}
            onChange={(e) => handleChange("previousThickness", e.target.value)}
            placeholder="0.500"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actualThickness">Actual Thickness (in) *</Label>
          <Input
            id="actualThickness"
            value={formData.actualThickness}
            onChange={(e) => handleChange("actualThickness", e.target.value)}
            placeholder="0.480"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeSpan">Time Span (years) *</Label>
          <Input
            id="timeSpan"
            value={formData.timeSpan}
            onChange={(e) => handleChange("timeSpan", e.target.value)}
            placeholder="10"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="staticHead">Static Head (ft)</Label>
          <Input
            id="staticHead"
            value={formData.staticHead}
            onChange={(e) => handleChange("staticHead", e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specificGravity">Specific Gravity</Label>
          <Input
            id="specificGravity"
            value={formData.specificGravity}
            onChange={(e) => handleChange("specificGravity", e.target.value)}
            placeholder="1.0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nextInspectionYears">Next Inspection (years) *</Label>
          <Input
            id="nextInspectionYears"
            value={formData.nextInspectionYears}
            onChange={(e) => handleChange("nextInspectionYears", e.target.value)}
            placeholder="5"
            required
          />
        </div>
      </div>

      {/* External Pressure Section (Shell Only) */}
      {componentType === "shell" && (
        <div className="border-t pt-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="externalPressure"
              checked={formData.externalPressure || false}
              onChange={(e) => handleChange("externalPressure", e.target.checked ? "true" : "")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="externalPressure" className="font-semibold">
              External Pressure / Vacuum Service
            </Label>
          </div>
          {formData.externalPressure && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unsupportedLength">Unsupported Length L (in) *</Label>
                <Input
                  id="unsupportedLength"
                  value={formData.unsupportedLength || ""}
                  onChange={(e) => handleChange("unsupportedLength", e.target.value)}
                  placeholder="120 (distance between stiffeners)"
                  required={formData.externalPressure}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Calculation Method</Label>
                <p className="text-sm">ASME UG-28 with X-Chart CS-1</p>
              </div>
            </div>
          )}
        </div>
      )}

      <Button type="submit" className="w-full">
        Add Component Calculation
      </Button>
    </form>
  );
}

// Placeholder sections (to be implemented)
function InspectionFindingsSection({ reportId }: { reportId: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        Inspection findings section - Coming soon
      </CardContent>
    </Card>
  );
}



