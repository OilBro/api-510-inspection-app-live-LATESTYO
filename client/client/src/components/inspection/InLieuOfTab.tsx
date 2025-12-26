import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, Calculator } from "lucide-react";
import { toast } from "sonner";

interface InLieuOfTabProps {
  inspectionId: string;
}

export default function InLieuOfTab({ inspectionId }: InLieuOfTabProps) {
  const [criteria, setCriteria] = useState({
    cleanService: false,
    noCorrosionHistory: false,
    effectiveExternalInspection: false,
    thicknessMonitoring: false,
    processMonitoring: false,
    designMargin: "",
    serviceYears: "",
  });

  const [result, setResult] = useState<{
    qualified: boolean;
    maxInterval: number;
    justification: string[];
    requirements: string[];
    warnings: string[];
  } | null>(null);

  const handleAssess = () => {
    const mandatoryCriteria = [
      { met: criteria.cleanService, name: "Clean, non-corrosive service" },
      { met: criteria.noCorrosionHistory, name: "No history of internal corrosion" },
      { met: criteria.effectiveExternalInspection, name: "Effective external inspection program" },
      { met: criteria.thicknessMonitoring, name: "Ongoing thickness monitoring" },
      { met: criteria.processMonitoring, name: "Process parameter monitoring" },
    ];

    const unmetCriteria = mandatoryCriteria.filter(c => !c.met);

    if (unmetCriteria.length > 0) {
      setResult({
        qualified: false,
        maxInterval: 0,
        justification: [],
        requirements: unmetCriteria.map(c => `REQUIRED: ${c.name}`),
        warnings: ["Vessel does not qualify for In-Lieu-Of internal inspection"],
      });
      toast.error("Vessel does not meet qualification criteria");
      return;
    }

    // Determine interval based on design margin
    const margin = parseFloat(criteria.designMargin) || 0;
    let maxInterval = 10;
    const justification: string[] = [];
    const warnings: string[] = [];

    if (margin >= 50) {
      maxInterval = 15;
      justification.push("Design margin >50% allows extended 15-year interval");
    } else if (margin >= 25) {
      maxInterval = 12;
      justification.push("Design margin >25% supports 12-year interval");
    } else if (margin < 10) {
      maxInterval = 8;
      warnings.push("Low design margin (<10%) limits interval to 8 years");
    }

    justification.push("All mandatory API 510 Section 6.4 criteria met");
    justification.push("Vessel operates in clean, non-corrosive service");
    justification.push("Effective monitoring programs in place");

    setResult({
      qualified: true,
      maxInterval,
      justification,
      requirements: [
        "Maintain effective external inspection program",
        "Continue thickness monitoring at critical locations",
        "Monitor process parameters continuously",
        "Review qualification annually",
      ],
      warnings,
    });

    toast.success("Vessel qualifies for In-Lieu-Of internal inspection");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>In-Lieu-Of Internal Inspection Assessment</CardTitle>
          <CardDescription>Qualification per API 510 Section 6.4</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cleanService"
                checked={criteria.cleanService}
                onCheckedChange={(checked) => setCriteria({ ...criteria, cleanService: checked as boolean })}
              />
              <Label htmlFor="cleanService" className="cursor-pointer">
                Clean, non-corrosive service (no history of internal fouling or corrosion)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="noCorrosionHistory"
                checked={criteria.noCorrosionHistory}
                onCheckedChange={(checked) => setCriteria({ ...criteria, noCorrosionHistory: checked as boolean })}
              />
              <Label htmlFor="noCorrosionHistory" className="cursor-pointer">
                No documented history of internal corrosion
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="effectiveExternalInspection"
                checked={criteria.effectiveExternalInspection}
                onCheckedChange={(checked) => setCriteria({ ...criteria, effectiveExternalInspection: checked as boolean })}
              />
              <Label htmlFor="effectiveExternalInspection" className="cursor-pointer">
                Effective external inspection program in place
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="thicknessMonitoring"
                checked={criteria.thicknessMonitoring}
                onCheckedChange={(checked) => setCriteria({ ...criteria, thicknessMonitoring: checked as boolean })}
              />
              <Label htmlFor="thicknessMonitoring" className="cursor-pointer">
                Ongoing thickness monitoring program at critical locations
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="processMonitoring"
                checked={criteria.processMonitoring}
                onCheckedChange={(checked) => setCriteria({ ...criteria, processMonitoring: checked as boolean })}
              />
              <Label htmlFor="processMonitoring" className="cursor-pointer">
                Process parameters monitored and controlled
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Design Margin (%)</Label>
              <Input
                type="number"
                step="1"
                placeholder="25"
                value={criteria.designMargin}
                onChange={(e) => setCriteria({ ...criteria, designMargin: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Percentage that current thickness exceeds minimum required
              </p>
            </div>

            <div className="space-y-2">
              <Label>Years in Service</Label>
              <Input
                type="number"
                step="1"
                placeholder="15"
                value={criteria.serviceYears}
                onChange={(e) => setCriteria({ ...criteria, serviceYears: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleAssess}>
              <Calculator className="mr-2 h-4 w-4" />
              Assess Qualification
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.qualified ? "border-green-500" : "border-red-500"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.qualified ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  QUALIFIED for In-Lieu-Of Internal Inspection
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  NOT QUALIFIED
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.qualified && (
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="font-semibold text-green-800 mb-2">
                  Maximum Interval: {result.maxInterval} years
                </p>
              </div>
            )}

            {result.justification.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="font-semibold text-blue-800 mb-2">Justification:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.justification.map((j, i) => (
                    <li key={i} className="text-sm text-blue-700">{j}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.requirements.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <p className="font-semibold text-gray-800 mb-2">Ongoing Requirements:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.requirements.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700">{r}</li>
                  ))}
                </ul>
              </div>
            )}

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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

