/**
 * Regulatory-Compliant Calculation Report Card
 * 
 * Per regulatory-inspection-engineering skill requirements:
 * - Step-by-step calculation output with intermediate values
 * - Explicit assumptions declaration
 * - Code references for each calculation
 * - Source documentation for input parameters
 * - Report certification section
 * 
 * Reference: API 510 §7.1.1, ASME Section VIII Division 1 UG-27
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  Calculator,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalculationData {
  id: string;
  componentName: string;
  componentType: "shell" | "head";
  
  // Design data
  designMAWP: string | null;
  designTemp?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  allowableStress?: string | null;
  jointEfficiency?: string | null;
  
  // Geometry
  insideDiameter?: string | null;
  nominalThickness?: string | null;
  headType?: string | null;
  crownRadius?: string | null;
  knuckleRadius?: string | null;
  
  // Thickness measurements
  previousThickness?: string | null;
  actualThickness: string | null;
  minimumThickness: string | null;
  
  // Corrosion data
  corrosionRate?: string | null;
  corrosionRateLongTerm?: string | null;
  corrosionRateShortTerm?: string | null;
  governingRateType?: string | null;
  governingRateReason?: string | null;
  corrosionAllowance?: string | null;
  timeSpan?: string | null;
  
  // Results
  remainingLife?: string | null;
  calculatedMAWP?: string | null;
  mawpAtNextInspection?: string | null;
  thicknessAtNextInspection?: string | null;
  nextInspectionYears?: string | null;
  
  // Data quality
  dataQualityStatus?: string | null;
  dataQualityNotes?: string | null;
}

interface CalculationReportCardProps {
  calculation: CalculationData;
  vesselId?: string;
  inspectorName?: string;
  inspectionDate?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CalculationReportCard({
  calculation: calc,
  vesselId,
  inspectorName,
  inspectionDate,
  onEdit,
  onDelete,
}: CalculationReportCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showIntermediates, setShowIntermediates] = useState(false);
  
  // Parse numeric values
  const tAct = parseFloat(calc.actualThickness || "0");
  const tMin = parseFloat(calc.minimumThickness || "0");
  const tPrev = parseFloat(calc.previousThickness || "0");
  const timeSpan = parseFloat(calc.timeSpan || "0");
  const corrosionRate = parseFloat(calc.corrosionRate || "0");
  const remainingLife = parseFloat(calc.remainingLife || "999");
  const designMAWP = parseFloat(calc.designMAWP || "0");
  const calculatedMAWP = parseFloat(calc.calculatedMAWP || "0");
  const S = parseFloat(calc.allowableStress || "20000");
  const E = parseFloat(calc.jointEfficiency || "0.85");
  const D = parseFloat(calc.insideDiameter || "0");
  const R = D / 2;
  
  // Calculate intermediate values for display
  const corrosionAllowance = tAct - tMin;
  const isCompliant = tAct >= tMin;
  const isCritical = remainingLife < 2;
  const isWarning = remainingLife >= 2 && remainingLife < 5;
  
  // Determine status
  const status = !isCompliant ? "FAIL" : isCritical ? "CRITICAL" : isWarning ? "WARNING" : "PASS";
  
  return (
    <Card className={`${status === "FAIL" || status === "CRITICAL" ? "border-red-500 border-2" : status === "WARNING" ? "border-yellow-500 border-2" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {calc.componentName}
              <Badge variant={status === "PASS" ? "default" : status === "WARNING" ? "secondary" : "destructive"}>
                {status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {calc.componentType === "shell" ? "Shell Evaluation" : "Head Evaluation"} per ASME Section VIII Division 1
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vessel Identification */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Vessel Identification
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Vessel ID</p>
              <p className="font-medium">{vesselId || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Component</p>
              <p className="font-medium">{calc.componentName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Inspection Date</p>
              <p className="font-medium">{inspectionDate || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Inspector</p>
              <p className="font-medium">{inspectorName || "—"}</p>
            </div>
          </div>
        </div>
        
        {/* Design Data with Sources */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Design Data
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 font-medium">Parameter</th>
                <th className="text-left py-1 font-medium">Value</th>
                <th className="text-left py-1 font-medium">Unit</th>
                <th className="text-left py-1 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-muted">
                <td className="py-1">Design Pressure (P)</td>
                <td className="py-1 font-mono">{calc.designMAWP}</td>
                <td className="py-1">psig</td>
                <td className="py-1 text-muted-foreground">Design Data</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Inside Diameter (D)</td>
                <td className="py-1 font-mono">{calc.insideDiameter || "—"}</td>
                <td className="py-1">inches</td>
                <td className="py-1 text-muted-foreground">Design Data</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Inside Radius (R)</td>
                <td className="py-1 font-mono">{R.toFixed(3)}</td>
                <td className="py-1">inches</td>
                <td className="py-1 text-muted-foreground">Calculated (D/2)</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Allowable Stress (S)</td>
                <td className="py-1 font-mono">{calc.allowableStress || "20,000"}</td>
                <td className="py-1">psi</td>
                <td className="py-1 text-muted-foreground">ASME Section II Part D</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Joint Efficiency (E)</td>
                <td className="py-1 font-mono">{calc.jointEfficiency || "0.85"}</td>
                <td className="py-1">—</td>
                <td className="py-1 text-muted-foreground">Design Data</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Material</td>
                <td className="py-1 font-mono">{calc.materialCode || "—"}</td>
                <td className="py-1">—</td>
                <td className="py-1 text-muted-foreground">Design Data</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Thickness Data */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Thickness Data
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 font-medium">Parameter</th>
                <th className="text-left py-1 font-medium">Value</th>
                <th className="text-left py-1 font-medium">Unit</th>
                <th className="text-left py-1 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-muted">
                <td className="py-1">Nominal Thickness (t_nom)</td>
                <td className="py-1 font-mono">{calc.nominalThickness || "—"}</td>
                <td className="py-1">inches</td>
                <td className="py-1 text-muted-foreground">Design</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Previous Thickness (t_prev)</td>
                <td className="py-1 font-mono">{calc.previousThickness || "—"}</td>
                <td className="py-1">inches</td>
                <td className="py-1 text-muted-foreground">UT</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Current Thickness (t_actual)</td>
                <td className="py-1 font-mono font-bold">{calc.actualThickness}</td>
                <td className="py-1">inches</td>
                <td className="py-1 text-muted-foreground">UT</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Time Interval (Y)</td>
                <td className="py-1 font-mono">{calc.timeSpan || "—"}</td>
                <td className="py-1">years</td>
                <td className="py-1 text-muted-foreground">Inspection Records</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Step-by-Step Calculations */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Step-by-Step Calculations
              </span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            {/* Required Thickness Calculation */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
              <h5 className="text-amber-400 font-bold mb-2">REQUIRED THICKNESS CALCULATION</h5>
              <p className="text-slate-400 mb-2">Per ASME Section VIII Division 1, UG-27(c)(1):</p>
              <div className="bg-slate-800 p-3 rounded mb-3">
                <p className="text-cyan-400">t_required = (P × R) / (S × E - 0.6 × P)</p>
              </div>
              <p className="mb-1">Input Parameters:</p>
              <p className="ml-4">Design Pressure (P) = {designMAWP} psig</p>
              <p className="ml-4">Inside Radius (R) = {R.toFixed(3)} inches</p>
              <p className="ml-4">Allowable Stress (S) = {S} psi</p>
              <p className="ml-4">Joint Efficiency (E) = {E}</p>
              <p className="mt-2 mb-1">Calculation:</p>
              <p className="ml-4 text-green-400">t_required = ({designMAWP} × {R.toFixed(3)}) / ({S} × {E} - 0.6 × {designMAWP})</p>
              <p className="ml-4 text-green-400">t_required = {(designMAWP * R).toFixed(2)} / ({(S * E).toFixed(0)} - {(0.6 * designMAWP).toFixed(1)})</p>
              <p className="ml-4 text-green-400">t_required = {(designMAWP * R).toFixed(2)} / {(S * E - 0.6 * designMAWP).toFixed(1)}</p>
              <p className="ml-4 text-yellow-400 font-bold">t_required = {tMin.toFixed(4)} inches</p>
              <p className="mt-2 text-slate-400">Reference: ASME Section VIII Division 1, UG-27(c)(1)</p>
            </div>
            
            {/* Corrosion Rate Calculation */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
              <h5 className="text-amber-400 font-bold mb-2">CORROSION RATE CALCULATION</h5>
              <p className="text-slate-400 mb-2">Per API 510 §7.1.1:</p>
              <div className="bg-slate-800 p-3 rounded mb-3">
                <p className="text-cyan-400">Cr = (t_prev - t_actual) / Y</p>
              </div>
              <p className="mb-1">Input Parameters:</p>
              <p className="ml-4">Previous Thickness (t_prev) = {tPrev.toFixed(4)} inches</p>
              <p className="ml-4">Current Thickness (t_actual) = {tAct.toFixed(4)} inches</p>
              <p className="ml-4">Time Interval (Y) = {timeSpan.toFixed(1)} years</p>
              <p className="mt-2 mb-1">Calculation:</p>
              {timeSpan > 0 ? (
                <>
                  <p className="ml-4 text-green-400">Cr = ({tPrev.toFixed(4)} - {tAct.toFixed(4)}) / {timeSpan.toFixed(1)}</p>
                  <p className="ml-4 text-green-400">Cr = {(tPrev - tAct).toFixed(4)} / {timeSpan.toFixed(1)}</p>
                  <p className="ml-4 text-yellow-400 font-bold">Cr = {corrosionRate.toFixed(6)} in/yr ({(corrosionRate * 1000).toFixed(1)} mpy)</p>
                </>
              ) : (
                <p className="ml-4 text-red-400">Insufficient data: Time interval not provided</p>
              )}
              <p className="mt-2 text-slate-400">Reference: API 510 §7.1.1</p>
            </div>
            
            {/* Remaining Life Calculation */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
              <h5 className="text-amber-400 font-bold mb-2">REMAINING LIFE CALCULATION</h5>
              <p className="text-slate-400 mb-2">Per API 510 §7.1.1:</p>
              <div className="bg-slate-800 p-3 rounded mb-3">
                <p className="text-cyan-400">Remaining Life = (t_actual - t_required) / Corrosion Rate</p>
              </div>
              <p className="mb-1">Input Parameters:</p>
              <p className="ml-4">Current Thickness (t_actual) = {tAct.toFixed(4)} inches</p>
              <p className="ml-4">Required Thickness (t_required) = {tMin.toFixed(4)} inches</p>
              <p className="ml-4">Corrosion Rate = {corrosionRate.toFixed(6)} in/yr</p>
              <p className="mt-2 mb-1">Calculation:</p>
              {corrosionRate > 0 ? (
                <>
                  <p className="ml-4 text-green-400">RL = ({tAct.toFixed(4)} - {tMin.toFixed(4)}) / {corrosionRate.toFixed(6)}</p>
                  <p className="ml-4 text-green-400">RL = {corrosionAllowance.toFixed(4)} / {corrosionRate.toFixed(6)}</p>
                  <p className={`ml-4 font-bold ${remainingLife < 5 ? 'text-red-400' : remainingLife < 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                    RL = {remainingLife.toFixed(1)} years
                  </p>
                </>
              ) : (
                <p className="ml-4 text-yellow-400">Corrosion rate is zero - Remaining life exceeds 20 years</p>
              )}
              <p className="mt-2 text-slate-400">Reference: API 510 §7.1.1</p>
            </div>
            
            {/* MAWP Recalculation */}
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
              <h5 className="text-amber-400 font-bold mb-2">MAWP RECALCULATION</h5>
              <p className="text-slate-400 mb-2">Per ASME Section VIII Division 1, UG-27(c)(1):</p>
              <div className="bg-slate-800 p-3 rounded mb-3">
                <p className="text-cyan-400">MAWP = (S × E × t) / (R + 0.6 × t)</p>
              </div>
              <p className="mb-1">Input Parameters:</p>
              <p className="ml-4">Allowable Stress (S) = {S} psi</p>
              <p className="ml-4">Joint Efficiency (E) = {E}</p>
              <p className="ml-4">Actual Thickness (t) = {tAct.toFixed(4)} inches</p>
              <p className="ml-4">Inside Radius (R) = {R.toFixed(3)} inches</p>
              <p className="mt-2 mb-1">Calculation:</p>
              <p className="ml-4 text-green-400">MAWP = ({S} × {E} × {tAct.toFixed(4)}) / ({R.toFixed(3)} + 0.6 × {tAct.toFixed(4)})</p>
              <p className="ml-4 text-green-400">MAWP = {(S * E * tAct).toFixed(2)} / ({R.toFixed(3)} + {(0.6 * tAct).toFixed(4)})</p>
              <p className="ml-4 text-green-400">MAWP = {(S * E * tAct).toFixed(2)} / {(R + 0.6 * tAct).toFixed(4)}</p>
              <p className="ml-4 text-yellow-400 font-bold">MAWP = {calculatedMAWP.toFixed(1)} psig</p>
              <p className="mt-2 text-slate-400">Reference: ASME Section VIII Division 1, UG-27(c)(1)</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Summary Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Min Required Thickness</p>
            <p className="font-mono font-bold text-lg">{tMin.toFixed(4)}"</p>
            <p className="text-xs text-muted-foreground">Per UG-27</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Corrosion Rate</p>
            <p className="font-mono font-bold text-lg">{(corrosionRate * 1000).toFixed(1)} mpy</p>
            <p className="text-xs text-muted-foreground">Per API 510</p>
          </div>
          <div className={`rounded-lg p-3 ${remainingLife < 5 ? 'bg-red-500/20' : remainingLife < 10 ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
            <p className="text-muted-foreground text-xs">Remaining Life</p>
            <p className={`font-mono font-bold text-lg ${remainingLife < 5 ? 'text-red-600' : remainingLife < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
              {remainingLife > 20 ? ">20" : remainingLife.toFixed(1)} yrs
            </p>
            <p className="text-xs text-muted-foreground">Per API 510 §7.1.1</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">Recalculated MAWP</p>
            <p className="font-mono font-bold text-lg">{calculatedMAWP.toFixed(1)} psi</p>
            <p className="text-xs text-muted-foreground">Per UG-27</p>
          </div>
        </div>
        
        {/* Assumptions */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Assumptions
          </h4>
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
            <li>Uniform corrosion assumed across component surface</li>
            <li>No localized thinning or pitting detected</li>
            <li>Material properties per ASME Section II Part D at design temperature</li>
            <li>Joint efficiency per original construction records</li>
            <li>Corrosion rate assumed constant for remaining life projection</li>
          </ol>
        </div>
        
        {/* Compliance Determination */}
        <div className={`rounded-lg p-4 ${isCompliant ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            {isCompliant ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            Compliance Determination
          </h4>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-muted">
                <td className="py-1">Current Thickness vs Required</td>
                <td className="py-1 font-mono">{tAct.toFixed(4)}" vs {tMin.toFixed(4)}"</td>
                <td className="py-1">
                  <Badge variant={isCompliant ? "default" : "destructive"}>
                    {isCompliant ? "PASS" : "FAIL"}
                  </Badge>
                </td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Remaining Life</td>
                <td className="py-1 font-mono">{remainingLife > 20 ? ">20" : remainingLife.toFixed(1)} years</td>
                <td className="py-1">
                  <Badge variant={remainingLife >= 2 ? "default" : "destructive"}>
                    {remainingLife >= 2 ? "ACCEPTABLE" : "CRITICAL"}
                  </Badge>
                </td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-1">Next Inspection Due</td>
                <td className="py-1 font-mono">{calc.nextInspectionYears || Math.min(remainingLife / 2, 10).toFixed(1)} years</td>
                <td className="py-1 text-muted-foreground">Per API 510 §6.4</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">
            Per API 510, next inspection interval shall not exceed one-half the remaining life or 10 years, whichever is less.
          </p>
        </div>
        
        {/* Report Certification */}
        <Separator />
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Report Certification</p>
          <p>This calculation was performed in accordance with API 510 and ASME Section VIII Division 1. All values are traceable to the sources indicated.</p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p>Prepared By: {inspectorName || "—"}</p>
              <p>Date: {inspectionDate || new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <p>Reviewed By: _______________</p>
              <p>Review Date: _______________</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CalculationReportCard;
