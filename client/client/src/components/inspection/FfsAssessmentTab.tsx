import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Calculator } from "lucide-react";
import { toast } from "sonner";

interface FfsAssessmentTabProps {
  inspectionId: string;
}

export default function FfsAssessmentTab({ inspectionId }: FfsAssessmentTabProps) {
  const [assessmentData, setAssessmentData] = useState({
    damageType: "general_metal_loss",
    remainingThickness: "",
    minimumRequired: "",
    futureCorrosionAllowance: "",
    designPressure: "",
    operatingPressure: "",
    allowableStress: "",
    jointEfficiency: "1.0",
    corrosionRate: "",
  });

  const [result, setResult] = useState<{
    acceptable: boolean;
    remainingLife: number;
    nextInspection: number;
    mawp: number;
    warnings: string[];
    recommendations: string[];
  } | null>(null);

  const handleAssess = () => {
    const remaining = parseFloat(assessmentData.remainingThickness);
    const minRequired = parseFloat(assessmentData.minimumRequired);
    const fca = parseFloat(assessmentData.futureCorrosionAllowance) || 0;
    const cr = parseFloat(assessmentData.corrosionRate);

    if (isNaN(remaining) || isNaN(minRequired) || isNaN(cr)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Simple Level 1 assessment
    const tmm = minRequired + fca;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (remaining < minRequired) {
      setResult({
        acceptable: false,
        remainingLife: 0,
        nextInspection: 0,
        mawp: 0,
        warnings: ["CRITICAL: Current thickness below minimum required"],
        recommendations: ["IMMEDIATE ACTION REQUIRED", "Vessel NOT fit for service", "Shutdown and repair/replace"],
      });
      return;
    }

    const excessThickness = remaining - tmm;
    const remainingLife = cr > 0 ? excessThickness / (cr / 1000) : Infinity;
    const nextInspection = Math.min(remainingLife / 2, 10);

    if (remainingLife < 2) {
      warnings.push("Less than 2 years remaining life");
      recommendations.push("Plan for replacement or repair");
    } else if (remainingLife < 5) {
      warnings.push("Less than 5 years remaining life");
      recommendations.push("Monitor closely");
    }

    setResult({
      acceptable: remaining >= tmm,
      remainingLife: Math.max(0, remainingLife),
      nextInspection: Math.max(0, nextInspection),
      mawp: 0, // Simplified
      warnings,
      recommendations,
    });

    toast.success("FFS assessment complete");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fitness-for-Service Assessment</CardTitle>
          <CardDescription>Level 1 screening per API 579-1/ASME FFS-1</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Damage Type</Label>
              <Select
                value={assessmentData.damageType}
                onValueChange={(value) => setAssessmentData({ ...assessmentData, damageType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_metal_loss">General Metal Loss</SelectItem>
                  <SelectItem value="local_thin_area">Local Thin Area (LTA)</SelectItem>
                  <SelectItem value="pitting">Pitting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Remaining Thickness (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.250"
                value={assessmentData.remainingThickness}
                onChange={(e) => setAssessmentData({ ...assessmentData, remainingThickness: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Required Thickness (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.200"
                value={assessmentData.minimumRequired}
                onChange={(e) => setAssessmentData({ ...assessmentData, minimumRequired: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Future Corrosion Allowance (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.125"
                value={assessmentData.futureCorrosionAllowance}
                onChange={(e) => setAssessmentData({ ...assessmentData, futureCorrosionAllowance: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Corrosion Rate (mpy)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="5.0"
                value={assessmentData.corrosionRate}
                onChange={(e) => setAssessmentData({ ...assessmentData, corrosionRate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleAssess}>
              <Calculator className="mr-2 h-4 w-4" />
              Perform Assessment
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.acceptable ? "border-green-500" : "border-red-500"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.acceptable ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Assessment: ACCEPTABLE
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Assessment: NOT ACCEPTABLE
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Remaining Life</p>
                <p className="text-2xl font-bold">{result.remainingLife.toFixed(2)} years</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Next Inspection</p>
                <p className="text-2xl font-bold">{result.nextInspection.toFixed(2)} years</p>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="font-semibold text-yellow-800 mb-2">Warnings:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-yellow-700">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="font-semibold text-blue-800 mb-2">Recommendations:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-blue-700">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

