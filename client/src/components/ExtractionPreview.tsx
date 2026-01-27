import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Save, 
  X, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Code2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sortByCmlNumber } from "@/lib/cmlSort";

interface VesselInfo {
  vesselTagNumber: string;
  vesselName: string;
  manufacturer: string;
  serialNumber: string;
  yearBuilt: string;
  nbNumber: string;
  designPressure: string;
  designTemperature: string;
  operatingPressure: string;
  operatingTemperature: string;
  mdmt: string;
  materialSpec: string;
  allowableStress: string;
  jointEfficiency: string;
  insideDiameter: string;
  overallLength: string;
  headType: string;
  vesselType: string;
  vesselConfiguration: string;
  constructionCode: string;
  product: string;
  insulationType: string;
  corrosionAllowance: string;
}

interface ReportInfo {
  reportNumber: string;
  reportDate: string;
  inspectionDate: string;
  inspectionType: string;
  inspectorName: string;
  inspectorCert: string;
  clientName: string;
  clientLocation: string;
}

interface TmlReading {
  id: string;
  cmlNumber: string;
  tmlId: string;
  location: string;
  component: string;
  componentType: string;
  currentThickness: string;
  previousThickness: string;
  nominalThickness: string;
  angle: string;
  readingType: string;
}

interface Nozzle {
  id: string;
  nozzleNumber: string;
  nozzleDescription: string;
  nominalSize: string;
  schedule: string;
  actualThickness: string;
  pipeNominalThickness: string;
  minimumRequired: string;
  acceptable: boolean;
  notes: string;
}

interface ExtractionSummary {
  hasVesselInfo: boolean;
  vesselFieldsCount: number;
  tmlReadingsCount: number;
  nozzlesCount: number;
  checklistItemsCount: number;
  hasNarratives: boolean;
}

interface PreviewData {
  vesselInfo: VesselInfo;
  reportInfo: ReportInfo;
  tmlReadings: TmlReading[];
  nozzles: Nozzle[];
  checklistItems: any[];
  narratives: {
    executiveSummary: string;
    inspectionResults: string;
    recommendations: string;
  };
  tableA: any;
}

interface ExtractionPreviewProps {
  preview: PreviewData;
  summary: ExtractionSummary;
  parserUsed: string;
  onConfirm: (data: { vesselInfo: VesselInfo; reportInfo: ReportInfo; tmlReadings: TmlReading[]; nozzles: Nozzle[]; narratives: { executiveSummary: string; inspectionResults: string; recommendations: string }; checklistItems: any[] }) => void;
  onCancel: () => void;
  isConfirming: boolean;
}

// Editable field component
function EditableField({ 
  label, 
  value, 
  onChange, 
  placeholder,
  type = "text",
  className 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  const isEmpty = !value || value === '';
  
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          className={cn(
            "h-8 text-sm",
            isEmpty && "border-dashed border-orange-300 bg-orange-50/50"
          )}
        />
        {isEmpty && (
          <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
        )}
      </div>
    </div>
  );
}

// Section header with expand/collapse
function SectionHeader({ 
  title, 
  count, 
  isExpanded, 
  onToggle,
  badge
}: { 
  title: string; 
  count?: number; 
  isExpanded: boolean; 
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {count} items
          </Badge>
        )}
        {badge && (
          <Badge variant="outline" className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
      {isExpanded ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export default function ExtractionPreview({
  preview,
  summary,
  parserUsed,
  onConfirm,
  onCancel,
  isConfirming
}: ExtractionPreviewProps) {
  const [vesselInfo, setVesselInfo] = useState<VesselInfo>(preview.vesselInfo);
  const [reportInfo, setReportInfo] = useState<ReportInfo>(preview.reportInfo);
  const [tmlReadings, setTmlReadings] = useState<TmlReading[]>(() => sortByCmlNumber(preview.tmlReadings));
  const [nozzles, setNozzles] = useState<Nozzle[]>(preview.nozzles);
  
  const [expandedSections, setExpandedSections] = useState({
    vessel: true,
    report: true,
    tml: true,
    nozzles: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateVesselField = (field: keyof VesselInfo, value: string) => {
    setVesselInfo(prev => ({ ...prev, [field]: value }));
  };

  const updateReportField = (field: keyof ReportInfo, value: string) => {
    setReportInfo(prev => ({ ...prev, [field]: value }));
  };

  const updateTmlReading = (id: string, field: keyof TmlReading, value: string) => {
    setTmlReadings(prev => prev.map(tml => 
      tml.id === id ? { ...tml, [field]: value } : tml
    ));
  };

  const deleteTmlReading = (id: string) => {
    setTmlReadings(prev => prev.filter(tml => tml.id !== id));
  };

  const addTmlReading = () => {
    const newId = `tml-new-${Date.now()}`;
    setTmlReadings(prev => [...prev, {
      id: newId,
      cmlNumber: '',
      tmlId: '',
      location: '',
      component: '',
      componentType: '',
      currentThickness: '',
      previousThickness: '',
      nominalThickness: '',
      angle: '',
      readingType: '',
    }]);
  };

  const updateNozzle = (id: string, field: keyof Nozzle, value: any) => {
    setNozzles(prev => prev.map(noz => 
      noz.id === id ? { ...noz, [field]: value } : noz
    ));
  };

  const deleteNozzle = (id: string) => {
    setNozzles(prev => prev.filter(noz => noz.id !== id));
  };

  const addNozzle = () => {
    const newId = `noz-new-${Date.now()}`;
    setNozzles(prev => [...prev, {
      id: newId,
      nozzleNumber: '',
      nozzleDescription: '',
      nominalSize: '',
      schedule: '',
      actualThickness: '',
      pipeNominalThickness: '',
      minimumRequired: '',
      acceptable: true,
      notes: '',
    }]);
  };

  const handleConfirm = () => {
    onConfirm({
      vesselInfo,
      reportInfo,
      tmlReadings,
      nozzles,
      narratives: preview.narratives,
      checklistItems: preview.checklistItems || [],
    });
  };

  // Count missing required fields
  const missingFields = !vesselInfo.vesselTagNumber ? 1 : 0;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-900">Data Extracted Successfully</p>
              <p className="text-sm text-green-700 mt-1">
                Review and edit the extracted data below before saving. Parser used: <Badge variant="outline" className="ml-1">{parserUsed}</Badge>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">
                  {summary.vesselFieldsCount} vessel fields
                </Badge>
                <Badge variant="secondary">
                  {summary.tmlReadingsCount} TML readings
                </Badge>
                <Badge variant="secondary">
                  {summary.nozzlesCount} nozzles
                </Badge>
                {summary.hasNarratives && (
                  <Badge variant="secondary">Has narratives</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning for missing required fields */}
      {missingFields > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Vessel Tag Number is required. Please fill in the highlighted field.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editable Sections */}
      <Tabs defaultValue="vessel" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="vessel">Vessel Info</TabsTrigger>
          <TabsTrigger value="report">Report Info</TabsTrigger>
          <TabsTrigger value="tml">
            TML Readings
            {tmlReadings.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{tmlReadings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="nozzles">
            Nozzles
            {nozzles.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{nozzles.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="narratives">
            Results & Recs
            {(preview.narratives.inspectionResults || preview.narratives.recommendations) && (
              <Badge variant="secondary" className="ml-1 text-xs">✓</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="raw">
            <Code2 className="h-4 w-4 mr-1" />
            Raw Data
          </TabsTrigger>
        </TabsList>

        {/* Vessel Info Tab */}
        <TabsContent value="vessel" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vessel Information</CardTitle>
              <CardDescription>Edit vessel identification and design specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <EditableField
                  label="Vessel Tag Number *"
                  value={vesselInfo.vesselTagNumber}
                  onChange={(v) => updateVesselField('vesselTagNumber', v)}
                  placeholder="e.g., V-1001"
                  className="col-span-2 md:col-span-1"
                />
                <EditableField
                  label="Vessel Name"
                  value={vesselInfo.vesselName}
                  onChange={(v) => updateVesselField('vesselName', v)}
                  className="col-span-2"
                />
                <EditableField
                  label="Manufacturer"
                  value={vesselInfo.manufacturer}
                  onChange={(v) => updateVesselField('manufacturer', v)}
                />
                <EditableField
                  label="Serial Number"
                  value={vesselInfo.serialNumber}
                  onChange={(v) => updateVesselField('serialNumber', v)}
                />
                <EditableField
                  label="Year Built"
                  value={vesselInfo.yearBuilt}
                  onChange={(v) => updateVesselField('yearBuilt', v)}
                  type="number"
                />
                <EditableField
                  label="NB Number"
                  value={vesselInfo.nbNumber}
                  onChange={(v) => updateVesselField('nbNumber', v)}
                />
                <EditableField
                  label="Design Pressure (psig)"
                  value={vesselInfo.designPressure}
                  onChange={(v) => updateVesselField('designPressure', v)}
                />
                <EditableField
                  label="Design Temperature (°F)"
                  value={vesselInfo.designTemperature}
                  onChange={(v) => updateVesselField('designTemperature', v)}
                />
                <EditableField
                  label="Operating Pressure (psig)"
                  value={vesselInfo.operatingPressure}
                  onChange={(v) => updateVesselField('operatingPressure', v)}
                />
                <EditableField
                  label="Operating Temperature (°F)"
                  value={vesselInfo.operatingTemperature}
                  onChange={(v) => updateVesselField('operatingTemperature', v)}
                />
                <EditableField
                  label="MDMT (°F)"
                  value={vesselInfo.mdmt}
                  onChange={(v) => updateVesselField('mdmt', v)}
                />
                <EditableField
                  label="Material Spec"
                  value={vesselInfo.materialSpec}
                  onChange={(v) => updateVesselField('materialSpec', v)}
                />
                <EditableField
                  label="Allowable Stress (psi)"
                  value={vesselInfo.allowableStress}
                  onChange={(v) => updateVesselField('allowableStress', v)}
                />
                <EditableField
                  label="Joint Efficiency"
                  value={vesselInfo.jointEfficiency}
                  onChange={(v) => updateVesselField('jointEfficiency', v)}
                />
                <EditableField
                  label="Inside Diameter (in)"
                  value={vesselInfo.insideDiameter}
                  onChange={(v) => updateVesselField('insideDiameter', v)}
                />
                <EditableField
                  label="Overall Length (in)"
                  value={vesselInfo.overallLength}
                  onChange={(v) => updateVesselField('overallLength', v)}
                />
                <EditableField
                  label="Head Type"
                  value={vesselInfo.headType}
                  onChange={(v) => updateVesselField('headType', v)}
                />
                <EditableField
                  label="Vessel Type"
                  value={vesselInfo.vesselType}
                  onChange={(v) => updateVesselField('vesselType', v)}
                />
                <EditableField
                  label="Configuration"
                  value={vesselInfo.vesselConfiguration}
                  onChange={(v) => updateVesselField('vesselConfiguration', v)}
                />
                <EditableField
                  label="Construction Code"
                  value={vesselInfo.constructionCode}
                  onChange={(v) => updateVesselField('constructionCode', v)}
                />
                <EditableField
                  label="Product/Service"
                  value={vesselInfo.product}
                  onChange={(v) => updateVesselField('product', v)}
                />
                <EditableField
                  label="Insulation Type"
                  value={vesselInfo.insulationType}
                  onChange={(v) => updateVesselField('insulationType', v)}
                />
                <EditableField
                  label="Corrosion Allowance (in)"
                  value={vesselInfo.corrosionAllowance}
                  onChange={(v) => updateVesselField('corrosionAllowance', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Info Tab */}
        <TabsContent value="report" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Report Information</CardTitle>
              <CardDescription>Edit inspection report details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Report Number"
                  value={reportInfo.reportNumber}
                  onChange={(v) => updateReportField('reportNumber', v)}
                />
                <EditableField
                  label="Report Date"
                  value={reportInfo.reportDate}
                  onChange={(v) => updateReportField('reportDate', v)}
                  type="date"
                />
                <EditableField
                  label="Inspection Date"
                  value={reportInfo.inspectionDate}
                  onChange={(v) => updateReportField('inspectionDate', v)}
                  type="date"
                />
                <EditableField
                  label="Inspection Type"
                  value={reportInfo.inspectionType}
                  onChange={(v) => updateReportField('inspectionType', v)}
                />
                <EditableField
                  label="Inspector Name"
                  value={reportInfo.inspectorName}
                  onChange={(v) => updateReportField('inspectorName', v)}
                />
                <EditableField
                  label="Inspector Certification"
                  value={reportInfo.inspectorCert}
                  onChange={(v) => updateReportField('inspectorCert', v)}
                />
                <EditableField
                  label="Client Name"
                  value={reportInfo.clientName}
                  onChange={(v) => updateReportField('clientName', v)}
                />
                <EditableField
                  label="Client Location"
                  value={reportInfo.clientLocation}
                  onChange={(v) => updateReportField('clientLocation', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TML Readings Tab */}
        <TabsContent value="tml" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Thickness Measurement Locations</CardTitle>
                  <CardDescription>Edit or add TML readings</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addTmlReading}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Reading
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tmlReadings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No TML readings extracted. Click "Add Reading" to add manually.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {tmlReadings.map((tml, idx) => (
                      <div key={tml.id} className="p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Reading #{idx + 1}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteTmlReading(tml.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <EditableField
                            label="CML Number"
                            value={tml.cmlNumber}
                            onChange={(v) => updateTmlReading(tml.id, 'cmlNumber', v)}
                          />
                          <EditableField
                            label="Component"
                            value={tml.component}
                            onChange={(v) => updateTmlReading(tml.id, 'component', v)}
                          />
                          <EditableField
                            label="Location"
                            value={tml.location}
                            onChange={(v) => updateTmlReading(tml.id, 'location', v)}
                          />
                          <EditableField
                            label="Component Type"
                            value={tml.componentType}
                            onChange={(v) => updateTmlReading(tml.id, 'componentType', v)}
                          />
                          <EditableField
                            label="Current Thickness"
                            value={tml.currentThickness}
                            onChange={(v) => updateTmlReading(tml.id, 'currentThickness', v)}
                          />
                          <EditableField
                            label="Previous Thickness"
                            value={tml.previousThickness}
                            onChange={(v) => updateTmlReading(tml.id, 'previousThickness', v)}
                          />
                          <EditableField
                            label="Nominal Thickness"
                            value={tml.nominalThickness}
                            onChange={(v) => updateTmlReading(tml.id, 'nominalThickness', v)}
                          />
                          <EditableField
                            label="Angle"
                            value={tml.angle}
                            onChange={(v) => updateTmlReading(tml.id, 'angle', v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nozzles Tab */}
        <TabsContent value="nozzles" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Nozzle Evaluations</CardTitle>
                  <CardDescription>Edit or add nozzle data</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addNozzle}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Nozzle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {nozzles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No nozzles extracted. Click "Add Nozzle" to add manually.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {nozzles.map((noz, idx) => (
                      <div key={noz.id} className="p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Nozzle #{idx + 1}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteNozzle(noz.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <EditableField
                            label="Nozzle Number"
                            value={noz.nozzleNumber}
                            onChange={(v) => updateNozzle(noz.id, 'nozzleNumber', v)}
                          />
                          <EditableField
                            label="Description/Service"
                            value={noz.nozzleDescription}
                            onChange={(v) => updateNozzle(noz.id, 'nozzleDescription', v)}
                          />
                          <EditableField
                            label="Nominal Size"
                            value={noz.nominalSize}
                            onChange={(v) => updateNozzle(noz.id, 'nominalSize', v)}
                          />
                          <EditableField
                            label="Schedule"
                            value={noz.schedule}
                            onChange={(v) => updateNozzle(noz.id, 'schedule', v)}
                          />
                          <EditableField
                            label="Actual Thickness"
                            value={noz.actualThickness}
                            onChange={(v) => updateNozzle(noz.id, 'actualThickness', v)}
                          />
                          <EditableField
                            label="Nominal Thickness"
                            value={noz.pipeNominalThickness}
                            onChange={(v) => updateNozzle(noz.id, 'pipeNominalThickness', v)}
                          />
                          <EditableField
                            label="Min Required"
                            value={noz.minimumRequired}
                            onChange={(v) => updateNozzle(noz.id, 'minimumRequired', v)}
                          />
                          <div className="flex items-center gap-2 pt-5">
                            <Checkbox
                              checked={noz.acceptable}
                              onCheckedChange={(checked) => updateNozzle(noz.id, 'acceptable', !!checked)}
                            />
                            <Label className="text-sm">Acceptable</Label>
                          </div>
                        </div>
                        <div className="mt-2">
                          <EditableField
                            label="Notes"
                            value={noz.notes}
                            onChange={(v) => updateNozzle(noz.id, 'notes', v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Narratives Tab - Inspection Results & Recommendations */}
        <TabsContent value="narratives" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inspection Results & Recommendations</CardTitle>
              <CardDescription>Section 3.0 and 4.0 content extracted from the PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Inspection Results - Section 3.0 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Inspection Results (Section 3.0)</Label>
                {preview.narratives.inspectionResults ? (
                  <div className="border rounded-lg p-4 bg-muted/50 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{preview.narratives.inspectionResults}</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30 text-center text-muted-foreground">
                    <p className="text-sm">No inspection results extracted from the PDF.</p>
                  </div>
                )}
              </div>

              {/* Recommendations - Section 4.0 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recommendations (Section 4.0)</Label>
                {preview.narratives.recommendations ? (
                  <div className="border rounded-lg p-4 bg-orange-50 border-orange-200 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{preview.narratives.recommendations}</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30 text-center text-muted-foreground">
                    <p className="text-sm">No recommendations extracted from the PDF.</p>
                  </div>
                )}
              </div>

              {/* Executive Summary */}
              {preview.narratives.executiveSummary && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Executive Summary</Label>
                  <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{preview.narratives.executiveSummary}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Raw Parsed Data
              </CardTitle>
              <CardDescription>
                View the raw JSON data extracted from the file. Useful for debugging and verification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full rounded-md border">
                <pre className="p-4 text-xs font-mono bg-muted/30 whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    {
                      vesselInfo,
                      reportInfo,
                      tmlReadings,
                      nozzles,
                      checklistItems: preview.checklistItems,
                      narratives: preview.narratives,
                      tableA: preview.tableA,
                    },
                    null,
                    2
                  )}
                </pre>
              </ScrollArea>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const data = JSON.stringify(
                      {
                        vesselInfo,
                        reportInfo,
                        tmlReadings,
                        nozzles,
                        checklistItems: preview.checklistItems,
                        narratives: preview.narratives,
                        tableA: preview.tableA,
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(data);
                  }}
                >
                  Copy to Clipboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const data = JSON.stringify(
                      {
                        vesselInfo,
                        reportInfo,
                        tmlReadings,
                        nozzles,
                        checklistItems: preview.checklistItems,
                        narratives: preview.narratives,
                        tableA: preview.tableA,
                      },
                      null,
                      2
                    );
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `extracted-data-${vesselInfo.vesselTagNumber || 'unknown'}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isConfirming || !vesselInfo.vesselTagNumber}
          className="flex-1"
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Confirm & Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
