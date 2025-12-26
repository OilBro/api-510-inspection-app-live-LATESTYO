import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Check, X, Sparkles, Zap, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { findBestMatch, getConfidenceLevel, getConfidenceColor, type FieldMatch } from "@/lib/fieldMatcher";
import { useEffect, useMemo } from "react";

interface UnmatchedDataTabProps {
  inspectionId: string;
}

// Define all available fields organized by section
const FIELD_MAPPINGS = {
  vesselData: {
    label: "Vessel Information",
    fields: {
      vesselTagNumber: "Vessel Tag Number",
      vesselName: "Vessel Name",
      product: "Product/Service",
      manufacturer: "Manufacturer",
      yearBuilt: "Year Built",
      nbNumber: "NB Number",
      constructionCode: "Construction Code",
      vesselType: "Vessel Type",
      vesselConfiguration: "Vessel Configuration",
      headType: "Head Type",
      insulationType: "Insulation Type",
    },
  },
  designParameters: {
    label: "Design Parameters",
    fields: {
      designPressure: "Design Pressure (MAWP)",
      designTemperature: "Design Temperature",
      operatingPressure: "Operating Pressure",
      materialSpec: "Material Specification",
      insideDiameter: "Inside Diameter",
      overallLength: "Overall Length",
    },
  },
  reportInfo: {
    label: "Report Information",
    fields: {
      reportNumber: "Report Number",
      inspectionDate: "Inspection Date",
      reportDate: "Report Date",
      inspectionType: "Inspection Type",
      inspectionCompany: "Inspection Company",
      inspectorName: "Inspector Name",
      inspectorCert: "Inspector Certification",
    },
  },
  clientInfo: {
    label: "Client Information",
    fields: {
      clientName: "Client/Company Name",
      clientLocation: "Client Location",
    },
  },
  summary: {
    label: "Executive Summary",
    fields: {
      executiveSummary: "Executive Summary",
    },
  },
  professionalReport: {
    label: "Professional Report - Metadata",
    fields: {
      reportNumber: "Report Number",
      reportDate: "Report Date",
      inspectorName: "Inspector Name",
      inspectorCertification: "API 510 Certification",
      employerName: "Employer/Company Name",
      clientName: "Client Name",
      clientLocation: "Client Location",
      clientContact: "Client Contact",
      clientApprovalName: "Client Approval Name",
      clientApprovalTitle: "Client Approval Title",
      executiveSummary: "Executive Summary",
      governingComponent: "Governing Component",
      nextExternalInspectionClient: "Next External Inspection (Client)",
      nextExternalInspectionAPI: "Next External Inspection (API)",
      nextInternalInspection: "Next Internal Inspection",
      nextUTInspection: "Next UT Inspection",
    },
  },
  componentCalculation: {
    label: "Professional Report - Component Calculation",
    fields: {
      componentName: "Component Name",
      componentType: "Component Type (shell/head)",
      materialCode: "Material Code",
      materialName: "Material Name",
      designTemp: "Design Temperature (°F)",
      designMAWP: "Design MAWP (psi)",
      staticHead: "Static Head (ft)",
      specificGravity: "Specific Gravity",
      insideDiameter: "Inside Diameter (in)",
      nominalThickness: "Nominal Thickness (in)",
      allowableStress: "Allowable Stress (psi)",
      jointEfficiency: "Joint Efficiency",
      headType: "Head Type",
      crownRadius: "Crown Radius (in)",
      knuckleRadius: "Knuckle Radius (in)",
      previousThickness: "Previous Thickness (in)",
      actualThickness: "Actual Thickness (in)",
      timeSpan: "Time Span (years)",
      nextInspectionYears: "Years to Next Inspection",
    },
  },
  inspectionFindings: {
    label: "Professional Report - Findings",
    fields: {
      section: "Section (Foundation/Shell/Heads/Appurtenances)",
      findingType: "Finding Type (observation/defect/recommendation)",
      severity: "Severity (low/medium/high/critical)",
      description: "Description",
      location: "Location",
      measurements: "Measurements",
      photos: "Photo References",
    },
  },
  recommendations: {
    label: "Professional Report - Recommendations",
    fields: {
      category: "Category",
      priority: "Priority (low/medium/high/critical)",
      description: "Description",
      justification: "Justification",
      estimatedCost: "Estimated Cost",
      targetDate: "Target Completion Date",
    },
  },
};

export default function UnmatchedDataTab({ inspectionId }: UnmatchedDataTabProps) {
  const { data: unmatchedData, isLoading } = trpc.unmatchedData.list.useQuery({ inspectionId });
  const mapMutation = trpc.unmatchedData.map.useMutation();
  const ignoreMutation = trpc.unmatchedData.ignore.useMutation();
  const utils = trpc.useUtils();

  const [selectedMappings, setSelectedMappings] = useState<Record<string, { section: string; field: string }>>({});
  const [autoMatches, setAutoMatches] = useState<Record<string, FieldMatch>>({});
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Auto-match fields when data loads
  useEffect(() => {
    if (unmatchedData) {
      const matches: Record<string, FieldMatch> = {};
      for (const data of unmatchedData) {
        const match = findBestMatch(data.fieldName, FIELD_MAPPINGS);
        if (match) {
          matches[data.id] = match;
          // Auto-populate high-confidence matches
          if (match.confidence >= 90) {
            setSelectedMappings(prev => ({
              ...prev,
              [data.id]: { section: match.section, field: match.field }
            }));
          }
        }
      }
      setAutoMatches(matches);
    }
  }, [unmatchedData]);

  // Count matches by confidence
  const matchStats = useMemo(() => {
    const high = Object.values(autoMatches).filter(m => m.confidence >= 90).length;
    const medium = Object.values(autoMatches).filter(m => m.confidence >= 70 && m.confidence < 90).length;
    const low = Object.values(autoMatches).filter(m => m.confidence < 70).length;
    return { high, medium, low, total: Object.keys(autoMatches).length };
  }, [autoMatches]);

  const handleSectionChange = (dataId: string, section: string) => {
    setSelectedMappings((prev) => ({
      ...prev,
      [dataId]: { section, field: "" },
    }));
  };

  const handleFieldChange = (dataId: string, field: string) => {
    setSelectedMappings((prev) => ({
      ...prev,
      [dataId]: { ...prev[dataId], field },
    }));
  };

  const handleMap = async (dataId: string, fieldName: string, fieldValue: string) => {
    const mapping = selectedMappings[dataId];
    if (!mapping || !mapping.section || !mapping.field) {
      toast.error("Please select both section and field");
      return;
    }

    try {
      await mapMutation.mutateAsync({
        id: dataId,
        targetSection: mapping.section,
        targetField: mapping.field,
        sourceField: fieldName,
        sourceValue: fieldValue,
        learnMapping: true,
      });
      toast.success("Field mapped successfully! System will remember this mapping.");
      
      // If mapping to professional report, provide additional guidance
      if (mapping.section === 'professionalReport' || mapping.section === 'componentCalculation') {
        toast.info("Mapped to Professional Report. Visit the Professional Report tab to see the data.");
      }
      
      utils.unmatchedData.list.invalidate({ inspectionId });
      
      // Clear the selection
      setSelectedMappings((prev) => {
        const updated = { ...prev };
        delete updated[dataId];
        return updated;
      });
    } catch (error) {
      toast.error("Failed to map field");
      console.error(error);
    }
  };

  const handleIgnore = async (dataId: string) => {
    try {
      await ignoreMutation.mutateAsync({ id: dataId });
      toast.success("Field ignored");
      utils.unmatchedData.list.invalidate({ inspectionId });
    } catch (error) {
      toast.error("Failed to ignore field");
      console.error(error);
    }
  };

  const handleAcceptAllHighConfidence = async () => {
    if (!unmatchedData) return;
    
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const data of unmatchedData) {
        const match = autoMatches[data.id];
        if (match && match.confidence >= 90 && selectedMappings[data.id]) {
          try {
            await mapMutation.mutateAsync({
              id: data.id,
              targetSection: match.section,
              targetField: match.field,
              sourceField: data.fieldName,
              sourceValue: data.fieldValue || "",
              learnMapping: true,
            });
            successCount++;
          } catch (error) {
            failCount++;
            console.error(`Failed to map ${data.fieldName}:`, error);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully mapped ${successCount} field${successCount > 1 ? 's' : ''}!`);
        utils.unmatchedData.list.invalidate({ inspectionId });
      }
      if (failCount > 0) {
        toast.error(`Failed to map ${failCount} field${failCount > 1 ? 's' : ''}`);
      }
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleAcceptSuggestion = (dataId: string) => {
    const match = autoMatches[dataId];
    if (match) {
      setSelectedMappings(prev => ({
        ...prev,
        [dataId]: { section: match.section, field: match.field }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading unmatched data...</div>
      </div>
    );
  }

  if (!unmatchedData || unmatchedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            All Data Matched
          </CardTitle>
          <CardDescription>
            All extracted data has been successfully mapped to inspection fields.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Smart Matching Summary */}
      {matchStats.total > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Smart Matching Active</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Found {matchStats.total} potential matches using AI field matching
                  </p>
                  <div className="flex gap-3 text-sm">
                    <Badge className={getConfidenceColor(95)}>
                      {matchStats.high} High Confidence (≥90%)
                    </Badge>
                    <Badge className={getConfidenceColor(80)}>
                      {matchStats.medium} Medium (70-89%)
                    </Badge>
                    <Badge className={getConfidenceColor(60)}>
                      {matchStats.low} Low (&lt;70%)
                    </Badge>
                  </div>
                </div>
              </div>
              {matchStats.high > 0 && (
                <Button
                  onClick={handleAcceptAllHighConfidence}
                  disabled={bulkProcessing}
                  className="gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Accept All High Confidence ({matchStats.high})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Unmatched Data
            <Badge variant="secondary">{unmatchedData.length} items</Badge>
          </CardTitle>
          <CardDescription>
            Review and map extracted fields. High-confidence matches are pre-selected for quick approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unmatchedData.map((data) => {
            const match = autoMatches[data.id];
            const borderColor = match && match.confidence >= 90 ? "border-l-green-500" : match && match.confidence >= 70 ? "border-l-yellow-500" : "border-l-orange-500";
            
            return (
            <Card key={data.id} className={`border-l-4 ${borderColor}`}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Smart Suggestion Banner */}
                  {match && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <div>
                          <span className="text-sm font-medium text-blue-900">Smart Suggestion: </span>
                          <span className="text-sm text-blue-700">
                            {(FIELD_MAPPINGS as any)[match.section]?.label} → {(FIELD_MAPPINGS as any)[match.section]?.fields?.[match.field] || match.field}
                          </span>
                        </div>
                        <Badge className={getConfidenceColor(match.confidence)}>
                          {match.confidence}% match
                        </Badge>
                      </div>
                      {match.confidence >= 70 && !selectedMappings[data.id] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcceptSuggestion(data.id)}
                          className="gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Field Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Field Name</div>
                      <div className="text-sm bg-gray-50 p-2 rounded border">{data.fieldName}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Extracted Value</div>
                      <div className="text-sm bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
                        {data.fieldValue || <span className="text-gray-400">No value</span>}
                      </div>
                    </div>
                  </div>

                  {/* Mapping Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Map to Section</label>
                      <Select
                        value={selectedMappings[data.id]?.section || ""}
                        onValueChange={(value) => handleSectionChange(data.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select section..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_MAPPINGS).map(([key, section]) => (
                            <SelectItem key={key} value={key}>
                              {section.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Map to Field</label>
                      <Select
                        value={selectedMappings[data.id]?.field || ""}
                        onValueChange={(value) => handleFieldChange(data.id, value)}
                        disabled={!selectedMappings[data.id]?.section}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedMappings[data.id]?.section &&
                            Object.entries(
                              FIELD_MAPPINGS[selectedMappings[data.id].section as keyof typeof FIELD_MAPPINGS].fields
                            ).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIgnore(data.id)}
                      disabled={ignoreMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Ignore
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleMap(data.id, data.fieldName, data.fieldValue || "")}
                      disabled={
                        !selectedMappings[data.id]?.section ||
                        !selectedMappings[data.id]?.field ||
                        mapMutation.isPending
                      }
                      className="gap-1"
                    >
                      <Sparkles className="h-4 w-4" />
                      Map & Learn
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <div className="font-medium mb-1">Machine Learning Enabled</div>
              <div className="text-blue-700">
                When you map a field, the system remembers your choice and will automatically apply it to similar fields in
                future imports, making your workflow faster over time.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

