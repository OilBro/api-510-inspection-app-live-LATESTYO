import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface InspectionFindingsTabProps {
  inspectionId: string;
}

export default function InspectionFindingsTab({ inspectionId }: InspectionFindingsTabProps) {
  const { data: externalInspection } = trpc.externalInspection.get.useQuery({ inspectionId });
  const { data: internalInspection } = trpc.internalInspection.get.useQuery({ inspectionId });
  
  const saveExternalMutation = trpc.externalInspection.save.useMutation();
  const saveInternalMutation = trpc.internalInspection.save.useMutation();
  const utils = trpc.useUtils();

  const [externalData, setExternalData] = useState({
    visualCondition: "",
    corrosionObserved: false,
    damageMechanism: "",
    findings: "",
    recommendations: "",
  });

  const [internalData, setInternalData] = useState({
    internalCondition: "",
    corrosionPattern: "",
    findings: "",
    recommendations: "",
  });

  useEffect(() => {
    if (externalInspection) {
      setExternalData({
        visualCondition: externalInspection.visualCondition || "",
        corrosionObserved: externalInspection.corrosionObserved || false,
        damageMechanism: externalInspection.damageMechanism || "",
        findings: externalInspection.findings || "",
        recommendations: externalInspection.recommendations || "",
      });
    }
  }, [externalInspection]);

  useEffect(() => {
    if (internalInspection) {
      setInternalData({
        internalCondition: internalInspection.internalCondition || "",
        corrosionPattern: internalInspection.corrosionPattern || "",
        findings: internalInspection.findings || "",
        recommendations: internalInspection.recommendations || "",
      });
    }
  }, [internalInspection]);

  const handleSaveExternal = async () => {
    try {
      await saveExternalMutation.mutateAsync({
        inspectionId,
        ...externalData,
      });
      utils.externalInspection.get.invalidate({ inspectionId });
      toast.success("External inspection saved");
    } catch (error) {
      toast.error("Failed to save external inspection");
      console.error(error);
    }
  };

  const handleSaveInternal = async () => {
    try {
      await saveInternalMutation.mutateAsync({
        inspectionId,
        ...internalData,
      });
      utils.internalInspection.get.invalidate({ inspectionId });
      toast.success("Internal inspection saved");
    } catch (error) {
      toast.error("Failed to save internal inspection");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>External Inspection Findings</CardTitle>
          <CardDescription>Document external visual inspection observations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visualCondition">Visual Condition</Label>
            <Textarea
              id="visualCondition"
              placeholder="Describe the overall visual condition of the vessel exterior..."
              rows={4}
              value={externalData.visualCondition}
              onChange={(e) => setExternalData({ ...externalData, visualCondition: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="corrosionObserved"
              checked={externalData.corrosionObserved}
              onCheckedChange={(checked) => 
                setExternalData({ ...externalData, corrosionObserved: checked as boolean })
              }
            />
            <Label htmlFor="corrosionObserved" className="cursor-pointer">
              Corrosion Observed
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="damageMechanism">Damage Mechanism</Label>
            <Textarea
              id="damageMechanism"
              placeholder="Identify primary damage mechanisms (e.g., general corrosion, pitting, stress corrosion cracking)..."
              rows={3}
              value={externalData.damageMechanism}
              onChange={(e) => setExternalData({ ...externalData, damageMechanism: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalFindings">Findings</Label>
            <Textarea
              id="externalFindings"
              placeholder="Detail specific findings, defects, or areas of concern..."
              rows={5}
              value={externalData.findings}
              onChange={(e) => setExternalData({ ...externalData, findings: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalRecommendations">Recommendations</Label>
            <Textarea
              id="externalRecommendations"
              placeholder="Provide recommendations for repairs, monitoring, or next inspection..."
              rows={4}
              value={externalData.recommendations}
              onChange={(e) => setExternalData({ ...externalData, recommendations: e.target.value })}
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSaveExternal} disabled={saveExternalMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveExternalMutation.isPending ? "Saving..." : "Save External Inspection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal Inspection Findings</CardTitle>
          <CardDescription>Document internal inspection observations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="internalCondition">Internal Condition</Label>
            <Textarea
              id="internalCondition"
              placeholder="Describe the overall internal condition of the vessel..."
              rows={4}
              value={internalData.internalCondition}
              onChange={(e) => setInternalData({ ...internalData, internalCondition: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="corrosionPattern">Corrosion Pattern</Label>
            <Textarea
              id="corrosionPattern"
              placeholder="Describe corrosion patterns observed (e.g., localized, general, preferential)..."
              rows={3}
              value={internalData.corrosionPattern}
              onChange={(e) => setInternalData({ ...internalData, corrosionPattern: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalFindings">Findings</Label>
            <Textarea
              id="internalFindings"
              placeholder="Detail specific internal findings, defects, or areas of concern..."
              rows={5}
              value={internalData.findings}
              onChange={(e) => setInternalData({ ...internalData, findings: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalRecommendations">Recommendations</Label>
            <Textarea
              id="internalRecommendations"
              placeholder="Provide recommendations for repairs, monitoring, or next inspection..."
              rows={4}
              value={internalData.recommendations}
              onChange={(e) => setInternalData({ ...internalData, recommendations: e.target.value })}
            />
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSaveInternal} disabled={saveInternalMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveInternalMutation.isPending ? "Saving..." : "Save Internal Inspection"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

