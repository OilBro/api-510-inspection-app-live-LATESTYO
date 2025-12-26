import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download } from "lucide-react";

export interface ReportSectionConfig {
  coverPage?: boolean;
  tableOfContents?: boolean;
  executiveSummary?: boolean;
  vesselData?: boolean;
  componentCalculations?: boolean;
  inspectionFindings?: boolean;
  recommendations?: boolean;
  thicknessReadings?: boolean;
  checklist?: boolean;
  ffsAssessment?: boolean;
  inLieuOfQualification?: boolean;
  photos?: boolean;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  config: ReportSectionConfig;
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: "full",
    name: "Full Report",
    description: "Complete report with all sections",
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: true,
    },
  },
  {
    id: "executive",
    name: "Executive Summary",
    description: "High-level summary for management",
    config: {
      coverPage: true,
      tableOfContents: false,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: false,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: false,
      checklist: false,
      ffsAssessment: false,
      inLieuOfQualification: false,
      photos: false,
    },
  },
  {
    id: "client",
    name: "Client Summary",
    description: "Client-facing report without technical details",
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: false,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: false,
      checklist: false,
      ffsAssessment: true,
      inLieuOfQualification: false,
      photos: true,
    },
  },
  {
    id: "technical",
    name: "Technical Report",
    description: "Detailed technical analysis",
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: false,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: false,
    },
  },
  {
    id: "compliance",
    name: "Compliance Report",
    description: "Regulatory compliance documentation",
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: false,
    },
  },
  {
    id: "custom",
    name: "Custom",
    description: "Select specific sections to include",
    config: {
      coverPage: true,
      tableOfContents: true,
      executiveSummary: true,
      vesselData: true,
      componentCalculations: true,
      inspectionFindings: true,
      recommendations: true,
      thicknessReadings: true,
      checklist: true,
      ffsAssessment: true,
      inLieuOfQualification: true,
      photos: true,
    },
  },
];

const SECTION_LABELS: Record<keyof ReportSectionConfig, string> = {
  coverPage: "Cover Page",
  tableOfContents: "Table of Contents",
  executiveSummary: "Executive Summary",
  vesselData: "Vessel Data",
  componentCalculations: "Component Calculations",
  inspectionFindings: "Inspection Findings",
  recommendations: "Recommendations",
  thicknessReadings: "Thickness Readings",
  checklist: "Inspection Checklist",
  ffsAssessment: "FFS Assessment",
  inLieuOfQualification: "In-Lieu-Of Qualification",
  photos: "Photos",
};

interface ReportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: ReportSectionConfig) => void;
}

export function ReportTemplateDialog({
  open,
  onOpenChange,
  onGenerate,
}: ReportTemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("full");
  const [customConfig, setCustomConfig] = useState<ReportSectionConfig>(
    TEMPLATES[0].config
  );

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setCustomConfig(template.config);
    }
  };

  const handleSectionToggle = (section: keyof ReportSectionConfig) => {
    setCustomConfig((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleGenerate = () => {
    onGenerate(customConfig);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Report Template
          </DialogTitle>
          <DialogDescription>
            Choose a predefined template or customize which sections to include in your report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Report Template</Label>
            <RadioGroup value={selectedTemplate} onValueChange={handleTemplateChange}>
              <div className="space-y-3">
                {TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleTemplateChange(template.id)}
                  >
                    <RadioGroupItem value={template.id} id={template.id} />
                    <div className="flex-1">
                      <Label
                        htmlFor={template.id}
                        className="font-medium cursor-pointer"
                      >
                        {template.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Custom Section Selection */}
          {selectedTemplate === "custom" && (
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">
                Select Sections to Include
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(SECTION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={customConfig[key as keyof ReportSectionConfig] !== false}
                      onCheckedChange={() =>
                        handleSectionToggle(key as keyof ReportSectionConfig)
                      }
                    />
                    <Label
                      htmlFor={key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Preview */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Sections to be included:
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(customConfig)
                .filter(([_, enabled]) => enabled !== false)
                .map(([key]) => (
                  <span
                    key={key}
                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                  >
                    {SECTION_LABELS[key as keyof ReportSectionConfig]}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} className="gap-2">
            <Download className="h-4 w-4" />
            Generate Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

