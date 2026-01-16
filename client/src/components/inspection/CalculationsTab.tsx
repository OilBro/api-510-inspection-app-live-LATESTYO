import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calculator, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { calculateShellMinimumThickness, calculateHeadMinimumThickness, formatThickness, getThicknessStatus } from "@/lib/thicknessCalculations";

interface CalculationsTabProps {
  inspectionId: string;
}

export default function CalculationsTab({ inspectionId }: CalculationsTabProps) {
  const { data: inspection } = trpc.inspections.get.useQuery({ id: inspectionId });
  const { data: calculations } = trpc.calculations.get.useQuery({ inspectionId });
  const saveMutation = trpc.calculations.save.useMutation();
  const utils = trpc.useUtils();

  // Shell calculations
  // Per skills.md: Do not default critical parameters - require explicit input
  const [shellMinThickness, setShellMinThickness] = useState({
    designPressure: "",
    insideRadius: "",
    allowableStress: "",
    jointEfficiency: "", // No default - must be explicitly provided
    corrosionAllowance: "",
    result: "",
  });

  const [shellMAWP, setShellMAWP] = useState({
    actualThickness: "",
    insideRadius: "",
    allowableStress: "",
    jointEfficiency: "", // No default - must be explicitly provided
    corrosionAllowance: "",
    result: "",
  });

  // Head calculations
  const [headMinThickness, setHeadMinThickness] = useState({
    designPressure: "",
    insideRadius: "",
    allowableStress: "",
    jointEfficiency: "", // No default - must be explicitly provided
    corrosionAllowance: "",
    headType: "hemispherical",
    result: "",
  });

  const [headMAWP, setHeadMAWP] = useState({
    actualThickness: "",
    insideRadius: "",
    allowableStress: "",
    jointEfficiency: "", // No default - must be explicitly provided
    corrosionAllowance: "",
    headType: "hemispherical",
    result: "",
  });

  const [remainingLife, setRemainingLife] = useState({
    currentThickness: "",
    requiredThickness: "",
    corrosionRate: "",
    safetyFactor: "2.0",
    result: "",
    nextInspection: "",
  });

  // Auto-calculate minimum thickness in real-time
  useEffect(() => {
    const P = parseFloat(shellMinThickness.designPressure);
    const R = parseFloat(shellMinThickness.insideRadius);
    const S = parseFloat(shellMinThickness.allowableStress);
    const E = parseFloat(shellMinThickness.jointEfficiency);
    const CA = parseFloat(shellMinThickness.corrosionAllowance) || 0;
    
    if (P && R && S && E && !isNaN(P) && !isNaN(R) && !isNaN(S) && !isNaN(E)) {
      const minThickness = calculateShellMinimumThickness({ designPressure: P, insideRadius: R, allowableStress: S, jointEfficiency: E, corrosionAllowance: CA });
      if (minThickness > 0) {
        setShellMinThickness(prev => ({ ...prev, result: minThickness.toFixed(4) }));
      }
    }
  }, [shellMinThickness.designPressure, shellMinThickness.insideRadius, shellMinThickness.allowableStress, shellMinThickness.jointEfficiency, shellMinThickness.corrosionAllowance]);
  
  // Auto-calculate head minimum thickness in real-time
  useEffect(() => {
    const P = parseFloat(headMinThickness.designPressure);
    const R = parseFloat(headMinThickness.insideRadius);
    const S = parseFloat(headMinThickness.allowableStress);
    const E = parseFloat(headMinThickness.jointEfficiency);
    const CA = parseFloat(headMinThickness.corrosionAllowance) || 0;
    
    if (P && R && S && E && !isNaN(P) && !isNaN(R) && !isNaN(S) && !isNaN(E)) {
      const minThickness = calculateHeadMinimumThickness({ 
        designPressure: P, 
        insideRadius: R, 
        allowableStress: S, 
        jointEfficiency: E, 
        corrosionAllowance: CA,
        headType: headMinThickness.headType as any
      });
      if (minThickness > 0) {
        setHeadMinThickness(prev => ({ ...prev, result: minThickness.toFixed(4) }));
      }
    }
  }, [headMinThickness.designPressure, headMinThickness.insideRadius, headMinThickness.allowableStress, headMinThickness.jointEfficiency, headMinThickness.corrosionAllowance, headMinThickness.headType]);

  // Auto-fill from inspection data
  useEffect(() => {
    if (inspection) {
      const radius = inspection.insideDiameter ? (parseFloat(inspection.insideDiameter) / 2).toString() : "";
      // Per skills.md: Do not auto-fill critical parameters - require explicit input
      const jointEff = inspection.jointEfficiency ? String(inspection.jointEfficiency) : "";
      const allowStress = inspection.allowableStress ? String(inspection.allowableStress) : "";
      
      setShellMinThickness((prev) => ({
        ...prev,
        designPressure: inspection.designPressure || "",
        insideRadius: radius,
        jointEfficiency: jointEff,
        allowableStress: allowStress,
      }));

      setShellMAWP((prev) => ({
        ...prev,
        insideRadius: radius,
        jointEfficiency: jointEff,
        allowableStress: allowStress,
      }));

      setHeadMinThickness((prev) => ({
        ...prev,
        designPressure: inspection.designPressure || "",
        insideRadius: radius,
        jointEfficiency: jointEff,
        allowableStress: allowStress,
      }));

      setHeadMAWP((prev) => ({
        ...prev,
        insideRadius: radius,
        jointEfficiency: jointEff,
        allowableStress: allowStress,
      }));
    }
  }, [inspection]);

  // Load saved calculations
  useEffect(() => {
    if (calculations) {
      // Per skills.md: Do not auto-fill critical parameters - require explicit input
      const jointEff = inspection?.jointEfficiency ? String(inspection.jointEfficiency) : "";
      const allowStress = inspection?.allowableStress ? String(inspection.allowableStress) : "";
      
      // Pre-fill shell minimum thickness fields from imported data
      setShellMinThickness(prev => ({
        ...prev,
        designPressure: calculations.minThicknessDesignPressure || prev.designPressure,
        insideRadius: calculations.mawpInsideRadius || prev.insideRadius,
        allowableStress: calculations.minThicknessAllowableStress || allowStress,
        jointEfficiency: calculations.minThicknessJointEfficiency || jointEff,
        corrosionAllowance: calculations.minThicknessCorrosionAllowance || "",
        result: calculations.minThicknessResult || "",
      }));
      
      // Pre-fill MAWP fields
      if (calculations.mawpInsideRadius) {
        setShellMAWP(prev => ({
          ...prev,
          insideRadius: String(calculations.mawpInsideRadius || ''),
          allowableStress: String(calculations.mawpAllowableStress || allowStress),
          jointEfficiency: String(calculations.mawpJointEfficiency || jointEff),
        }));
      }

      if (calculations.mawpResult) {
        setShellMAWP({
          actualThickness: calculations.mawpActualThickness || "",
          insideRadius: calculations.mawpInsideRadius || "",
          allowableStress: calculations.mawpAllowableStress || "",
          jointEfficiency: calculations.mawpJointEfficiency || jointEff,
          corrosionAllowance: calculations.mawpCorrosionAllowance || "",
          result: calculations.mawpResult || "",
        });
      }

      if (calculations.remainingLifeResult) {
        setRemainingLife({
          currentThickness: calculations.remainingLifeCurrentThickness || "",
          requiredThickness: calculations.remainingLifeRequiredThickness || "",
          corrosionRate: calculations.remainingLifeCorrosionRate || "",
          safetyFactor: calculations.remainingLifeSafetyFactor || "2.0",
          result: calculations.remainingLifeResult || "",
          nextInspection: calculations.remainingLifeNextInspection || "",
        });
      }
    }
  }, [calculations, inspection]);

  // Shell minimum thickness calculation (ASME Section VIII Div 1, UG-27)
  const calculateShellMinThickness = () => {
    const P = parseFloat(shellMinThickness.designPressure);
    const R = parseFloat(shellMinThickness.insideRadius);
    const S = parseFloat(shellMinThickness.allowableStress);
    const E = parseFloat(shellMinThickness.jointEfficiency);
    const CA = parseFloat(shellMinThickness.corrosionAllowance) || 0;

    if (isNaN(P) || isNaN(R) || isNaN(S) || isNaN(E)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // SAFETY CHECK: Verify denominator is positive
    const denominator = S * E - 0.6 * P;
    if (denominator <= 0) {
      toast.error(
        "CRITICAL: Design pressure exceeds allowable stress capability. " +
        "The vessel cannot be safely designed with these parameters. " +
        "Reduce pressure or select higher strength material."
      );
      return;
    }

    // SAFETY CHECK: Verify pressure is reasonable
    if (P <= 0) {
      toast.error("Design pressure must be greater than zero");
      return;
    }

    if (P > 5000) {
      toast.warning(
        "Design pressure exceeds 5000 psig. Verify this is correct for your application."
      );
    }

    // SAFETY CHECK: Thin-wall theory applicability per ASME UG-27
    // Thin-wall applies when P ≤ 0.385 × S × E
    if (P > 0.385 * S * E) {
      toast.error(
        "⚠️ CRITICAL: Pressure exceeds thin-wall theory limits (P > 0.385×S×E). " +
        "Use thick-wall formula (UCS-66) instead. This calculation is NOT valid."
      );
      return;
    }

    // Calculate thickness
    // t = (P * R) / (S * E - 0.6 * P) + CA
    const t = (P * R) / denominator + CA;
    
    // SAFETY CHECK: Verify thin wall theory applies
    if (t > 0.5 * R) {
      toast.warning(
        "Calculated thickness exceeds 0.5 × radius. " +
        "Thin wall theory may not apply. Consider thick wall formula."
      );
    }

    // VERIFICATION: Recalculate to verify
    const verification = (P * R) / (S * E - 0.6 * P) + CA;
    const diff = Math.abs((t - verification) / t) * 100;
    
    if (diff > 0.01) {
      toast.error("Calculation verification failed. Please try again.");
      return;
    }
    
    setShellMinThickness({ ...shellMinThickness, result: t.toFixed(4) });
    toast.success("Minimum thickness calculated and verified");
  };

  // Shell MAWP calculation (ASME Section VIII Div 1, UG-27)
  const calculateShellMAWP = () => {
    const t = parseFloat(shellMAWP.actualThickness);
    const R = parseFloat(shellMAWP.insideRadius);
    const S = parseFloat(shellMAWP.allowableStress);
    const E = parseFloat(shellMAWP.jointEfficiency);
    const CA = parseFloat(shellMAWP.corrosionAllowance) || 0;

    if (isNaN(t) || isNaN(R) || isNaN(S) || isNaN(E)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // SAFETY CHECK: Verify actual thickness exceeds corrosion allowance
    if (t <= CA) {
      toast.error(
        "CRITICAL: Actual thickness is less than or equal to corrosion allowance. " +
        "No material remains for pressure containment!"
      );
      return;
    }

    const t_actual = t - CA;

    // SAFETY CHECK: Verify remaining thickness is positive
    if (t_actual <= 0) {
      toast.error("CRITICAL: No remaining thickness after corrosion allowance");
      return;
    }

    // SAFETY CHECK: Verify minimum thickness requirement
    if (t_actual < 0.0625) {
      toast.warning(
        "Remaining thickness is less than 1/16 inch. " +
        "Verify this meets minimum requirements."
      );
    }

    // Calculate MAWP
    // P = (S * E * t) / (R + 0.6 * t)
    const P = (S * E * t_actual) / (R + 0.6 * t_actual);

    // SAFETY CHECK: Verify result is reasonable
    if (P > 5000) {
      toast.warning("Calculated MAWP exceeds 5000 psig. Verify calculation.");
    }

    if (P <= 0) {
      toast.error("Invalid MAWP calculation result");
      return;
    }

    // VERIFICATION: Recalculate
    const verification = (S * E * t_actual) / (R + 0.6 * t_actual);
    const diff = Math.abs((P - verification) / P) * 100;
    
    if (diff > 0.01) {
      toast.error("Calculation verification failed. Please try again.");
      return;
    }
    
    setShellMAWP({ ...shellMAWP, result: P.toFixed(2) });
    toast.success("MAWP calculated and verified");
  };

  // Head minimum thickness calculation (ASME Section VIII Div 1, UG-32)
  const calculateHeadMinThickness = () => {
    const P = parseFloat(headMinThickness.designPressure);
    const R = parseFloat(headMinThickness.insideRadius);
    const S = parseFloat(headMinThickness.allowableStress);
    const E = parseFloat(headMinThickness.jointEfficiency);
    const CA = parseFloat(headMinThickness.corrosionAllowance) || 0;

    if (isNaN(P) || isNaN(R) || isNaN(S) || isNaN(E)) {
      toast.error("Please fill in all required fields");
      return;
    }

    let t = 0;
    
    switch (headMinThickness.headType) {
      case "hemispherical":
        // t = (P * R) / (2 * S * E - 0.2 * P) + CA
        t = (P * R) / (2 * S * E - 0.2 * P) + CA;
        break;
      case "ellipsoidal":
        // For 2:1 ellipsoidal head per ASME VIII-1 UG-32(d)
        // t = (P × D) / (2 × S × E - 0.2 × P) + CA
        // Where D = inside diameter (not radius)
        const D_ellip = R * 2; // Convert radius to diameter
        
        // Check denominator validity
        const denom_ellip = 2 * S * E - 0.2 * P;
        if (denom_ellip <= 0) {
          toast.error("🛑 INVALID: Pressure too high for ellipsoidal head with given S and E");
          return;
        }
        
        t = (P * D_ellip) / denom_ellip + CA;
        break;
      case "torispherical":
        // For torispherical head (ASME F&D)
        // t = (0.885 * P * L) / (S * E - 0.1 * P) + CA
        // L = crown radius (typically = R for F&D heads)
        const L = R;
        t = (0.885 * P * L) / (S * E - 0.1 * P) + CA;
        break;
      default:
        t = (P * R) / (2 * S * E - 0.2 * P) + CA;
    }
    
    setHeadMinThickness({ ...headMinThickness, result: t.toFixed(4) });
    toast.success("Head minimum thickness calculated");
  };

  // Head MAWP calculation (ASME Section VIII Div 1, UG-32)
  const calculateHeadMAWP = () => {
    const t = parseFloat(headMAWP.actualThickness);
    const R = parseFloat(headMAWP.insideRadius);
    const S = parseFloat(headMAWP.allowableStress);
    const E = parseFloat(headMAWP.jointEfficiency);
    const CA = parseFloat(headMAWP.corrosionAllowance) || 0;

    if (isNaN(t) || isNaN(R) || isNaN(S) || isNaN(E)) {
      toast.error("Please fill in all required fields");
      return;
    }

    const t_actual = t - CA;
    let P = 0;
    
    switch (headMAWP.headType) {
      case "hemispherical":
        // P = (2 * S * E * t) / (R + 0.2 * t)
        P = (2 * S * E * t_actual) / (R + 0.2 * t_actual);
        break;
      case "ellipsoidal":
        // P = (2 * S * E * t) / (D + 0.2 * t), where D = 2R
        P = (S * E * t_actual) / (R + 0.1 * t_actual);
        break;
      case "torispherical":
        // P = (S * E * t) / (0.885 * L + 0.1 * t)
        const L = R;
        P = (S * E * t_actual) / (0.885 * L + 0.1 * t_actual);
        break;
      default:
        P = (2 * S * E * t_actual) / (R + 0.2 * t_actual);
    }
    
    setHeadMAWP({ ...headMAWP, result: P.toFixed(2) });
    toast.success("Head MAWP calculated");
  };

  // Remaining life calculation
  const calculateRemainingLife = () => {
    const t_current = parseFloat(remainingLife.currentThickness);
    const t_required = parseFloat(remainingLife.requiredThickness);
    const CR = parseFloat(remainingLife.corrosionRate);
    const SF = parseFloat(remainingLife.safetyFactor);

    if (isNaN(t_current) || isNaN(t_required) || isNaN(CR) || isNaN(SF)) {
      toast.error("Please fill in all required fields");
      return;
    }

    // SAFETY CHECK: Verify corrosion rate is positive
    if (CR <= 0) {
      toast.error("Corrosion rate must be greater than zero");
      return;
    }

    // SAFETY CHECK: Verify safety factor is reasonable
    if (SF < 1.0) {
      toast.error("Safety factor must be at least 1.0");
      return;
    }

    if (SF < 2.0) {
      toast.warning("Safety factor less than 2.0 is not recommended");
    }

    // Calculate remaining life
    const excessThickness = t_current - t_required;
    const yearsRemaining = excessThickness / CR;

    // CRITICAL CHECKS
    if (yearsRemaining <= 0) {
      toast.error(
        "CRITICAL SAFETY ALERT: Current thickness is below minimum required thickness! " +
        "Vessel is not safe for continued operation. Immediate action required."
      );
      setRemainingLife({
        ...remainingLife,
        result: "0.00",
        nextInspection: "IMMEDIATE ACTION REQUIRED",
      });
      return;
    }

    if (yearsRemaining < 1) {
      toast.error(
        "CRITICAL: Less than 1 year remaining life. " +
        "Immediate engineering assessment and action required."
      );
    } else if (yearsRemaining < 2) {
      toast.warning(
        "WARNING: Less than 2 years remaining life. " +
        "Begin planning for vessel retirement or repair."
      );
    }

    // Calculate next inspection interval
    // Per API 510: Should not exceed lesser of:
    // 1. Half the remaining life
    // 2. 10 years (can extend to 15 under certain conditions)
    const halfLife = yearsRemaining / SF;
    const maxInterval = 10; // years per API 510
    const nextInspection = Math.min(halfLife, maxInterval);

    // SAFETY CHECK: Minimum inspection interval warnings
    if (nextInspection < 1) {
      toast.warning("Next inspection due in less than 1 year");
    }

    // VERIFICATION
    const verifyRemaining = (t_current - t_required) / CR;
    const diff = Math.abs((yearsRemaining - verifyRemaining) / yearsRemaining) * 100;
    
    if (diff > 0.01) {
      toast.error("Calculation verification failed. Please try again.");
      return;
    }

    setRemainingLife({
      ...remainingLife,
      result: yearsRemaining.toFixed(2),
      nextInspection: nextInspection.toFixed(2),
    });
    toast.success("Remaining life calculated and verified");
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        inspectionId,
        // Shell calculations
        minThicknessDesignPressure: shellMinThickness.designPressure,
        minThicknessInsideRadius: shellMinThickness.insideRadius,
        minThicknessAllowableStress: shellMinThickness.allowableStress,
        minThicknessJointEfficiency: shellMinThickness.jointEfficiency,
        minThicknessCorrosionAllowance: shellMinThickness.corrosionAllowance,
        minThicknessResult: shellMinThickness.result,
        mawpActualThickness: shellMAWP.actualThickness,
        mawpInsideRadius: shellMAWP.insideRadius,
        mawpAllowableStress: shellMAWP.allowableStress,
        mawpJointEfficiency: shellMAWP.jointEfficiency,
        mawpCorrosionAllowance: shellMAWP.corrosionAllowance,
        mawpResult: shellMAWP.result,
        remainingLifeCurrentThickness: remainingLife.currentThickness,
        remainingLifeRequiredThickness: remainingLife.requiredThickness,
        remainingLifeCorrosionRate: remainingLife.corrosionRate,
        remainingLifeSafetyFactor: remainingLife.safetyFactor,
        remainingLifeResult: remainingLife.result,
        remainingLifeNextInspection: remainingLife.nextInspection,
      });
      utils.calculations.get.invalidate({ inspectionId });
      toast.success("Calculations saved");
    } catch (error) {
      toast.error("Failed to save calculations");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="shell" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shell">Shell Calculations</TabsTrigger>
          <TabsTrigger value="head">Head Calculations</TabsTrigger>
          <TabsTrigger value="life">Remaining Life</TabsTrigger>
        </TabsList>

        <TabsContent value="shell" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Minimum Required Thickness (Shell)</CardTitle>
              <CardDescription>ASME Section VIII Div 1, UG-27 (Cylindrical Shell)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shellMinP">Design Pressure (P) - psig</Label>
                  <Input
                    id="shellMinP"
                    type="number"
                    step="0.01"
                    value={shellMinThickness.designPressure}
                    onChange={(e) => setShellMinThickness({ ...shellMinThickness, designPressure: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMinR">Inside Radius (R) - inches</Label>
                  <Input
                    id="shellMinR"
                    type="number"
                    step="0.01"
                    value={shellMinThickness.insideRadius}
                    onChange={(e) => setShellMinThickness({ ...shellMinThickness, insideRadius: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMinS">Allowable Stress (S) - psi</Label>
                  <Input
                    id="shellMinS"
                    type="number"
                    step="1"
                    value={shellMinThickness.allowableStress}
                    onChange={(e) => setShellMinThickness({ ...shellMinThickness, allowableStress: e.target.value })}
                    placeholder="e.g., 20000 for SA-516-70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMinE">Joint Efficiency (E)</Label>
                  <Select
                    value={shellMinThickness.jointEfficiency}
                    onValueChange={(value) => setShellMinThickness({ ...shellMinThickness, jointEfficiency: value })}
                  >
                    <SelectTrigger id="shellMinE">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1.0 (Full RT, Type 1)</SelectItem>
                      <SelectItem value="0.85">0.85 (Spot RT, Type 2)</SelectItem>
                      <SelectItem value="0.70">0.70 (No RT, Type 3)</SelectItem>
                      <SelectItem value="0.60">0.60 (Single Welded Butt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMinCA">Corrosion Allowance (CA) - inches</Label>
                  <Input
                    id="shellMinCA"
                    type="number"
                    step="0.01"
                    value={shellMinThickness.corrosionAllowance}
                    onChange={(e) => setShellMinThickness({ ...shellMinThickness, corrosionAllowance: e.target.value })}
                    placeholder="e.g., 0.125"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Result - inches</Label>
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">
                      {shellMinThickness.result || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculateShellMinThickness} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Shell Minimum Thickness
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maximum Allowable Working Pressure (Shell)</CardTitle>
              <CardDescription>ASME Section VIII Div 1, UG-27 (Cylindrical Shell)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shellMawpT">Actual Thickness (t) - inches</Label>
                  <Input
                    id="shellMawpT"
                    type="number"
                    step="0.01"
                    value={shellMAWP.actualThickness}
                    onChange={(e) => setShellMAWP({ ...shellMAWP, actualThickness: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMawpR">Inside Radius (R) - inches</Label>
                  <Input
                    id="shellMawpR"
                    type="number"
                    step="0.01"
                    value={shellMAWP.insideRadius}
                    onChange={(e) => setShellMAWP({ ...shellMAWP, insideRadius: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMawpS">Allowable Stress (S) - psi</Label>
                  <Input
                    id="shellMawpS"
                    type="number"
                    step="1"
                    value={shellMAWP.allowableStress}
                    onChange={(e) => setShellMAWP({ ...shellMAWP, allowableStress: e.target.value })}
                    placeholder="e.g., 20000 for SA-516-70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMawpE">Joint Efficiency (E)</Label>
                  <Select
                    value={shellMAWP.jointEfficiency}
                    onValueChange={(value) => setShellMAWP({ ...shellMAWP, jointEfficiency: value })}
                  >
                    <SelectTrigger id="shellMawpE">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1.0 (Full RT, Type 1)</SelectItem>
                      <SelectItem value="0.85">0.85 (Spot RT, Type 2)</SelectItem>
                      <SelectItem value="0.70">0.70 (No RT, Type 3)</SelectItem>
                      <SelectItem value="0.60">0.60 (Single Welded Butt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shellMawpCA">Corrosion Allowance (CA) - inches</Label>
                  <Input
                    id="shellMawpCA"
                    type="number"
                    step="0.01"
                    value={shellMAWP.corrosionAllowance}
                    onChange={(e) => setShellMAWP({ ...shellMAWP, corrosionAllowance: e.target.value })}
                    placeholder="e.g., 0.125"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Result - psig</Label>
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">
                      {shellMAWP.result || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculateShellMAWP} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Shell MAWP
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="head" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Minimum Required Thickness (Head)</CardTitle>
              <CardDescription>ASME Section VIII Div 1, UG-32 (Formed Heads)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headType">Head Type</Label>
                  <Select
                    value={headMinThickness.headType}
                    onValueChange={(value) => setHeadMinThickness({ ...headMinThickness, headType: value })}
                  >
                    <SelectTrigger id="headType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hemispherical">Hemispherical</SelectItem>
                      <SelectItem value="ellipsoidal">Ellipsoidal (2:1)</SelectItem>
                      <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMinP">Design Pressure (P) - psig</Label>
                  <Input
                    id="headMinP"
                    type="number"
                    step="0.01"
                    value={headMinThickness.designPressure}
                    onChange={(e) => setHeadMinThickness({ ...headMinThickness, designPressure: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMinR">Inside Radius (R) - inches</Label>
                  <Input
                    id="headMinR"
                    type="number"
                    step="0.01"
                    value={headMinThickness.insideRadius}
                    onChange={(e) => setHeadMinThickness({ ...headMinThickness, insideRadius: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMinS">Allowable Stress (S) - psi</Label>
                  <Input
                    id="headMinS"
                    type="number"
                    step="1"
                    value={headMinThickness.allowableStress}
                    onChange={(e) => setHeadMinThickness({ ...headMinThickness, allowableStress: e.target.value })}
                    placeholder="e.g., 20000 for SA-516-70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMinE">Joint Efficiency (E)</Label>
                  <Select
                    value={headMinThickness.jointEfficiency}
                    onValueChange={(value) => setHeadMinThickness({ ...headMinThickness, jointEfficiency: value })}
                  >
                    <SelectTrigger id="headMinE">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1.0 (Full RT, Type 1)</SelectItem>
                      <SelectItem value="0.85">0.85 (Spot RT, Type 2)</SelectItem>
                      <SelectItem value="0.70">0.70 (No RT, Type 3)</SelectItem>
                      <SelectItem value="0.60">0.60 (Single Welded Butt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMinCA">Corrosion Allowance (CA) - inches</Label>
                  <Input
                    id="headMinCA"
                    type="number"
                    step="0.01"
                    value={headMinThickness.corrosionAllowance}
                    onChange={(e) => setHeadMinThickness({ ...headMinThickness, corrosionAllowance: e.target.value })}
                    placeholder="e.g., 0.125"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Result - inches</Label>
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">
                      {headMinThickness.result || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculateHeadMinThickness} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Head Minimum Thickness
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maximum Allowable Working Pressure (Head)</CardTitle>
              <CardDescription>ASME Section VIII Div 1, UG-32 (Formed Heads)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headMawpType">Head Type</Label>
                  <Select
                    value={headMAWP.headType}
                    onValueChange={(value) => setHeadMAWP({ ...headMAWP, headType: value })}
                  >
                    <SelectTrigger id="headMawpType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hemispherical">Hemispherical</SelectItem>
                      <SelectItem value="ellipsoidal">Ellipsoidal (2:1)</SelectItem>
                      <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMawpT">Actual Thickness (t) - inches</Label>
                  <Input
                    id="headMawpT"
                    type="number"
                    step="0.01"
                    value={headMAWP.actualThickness}
                    onChange={(e) => setHeadMAWP({ ...headMAWP, actualThickness: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMawpR">Inside Radius (R) - inches</Label>
                  <Input
                    id="headMawpR"
                    type="number"
                    step="0.01"
                    value={headMAWP.insideRadius}
                    onChange={(e) => setHeadMAWP({ ...headMAWP, insideRadius: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMawpS">Allowable Stress (S) - psi</Label>
                  <Input
                    id="headMawpS"
                    type="number"
                    step="1"
                    value={headMAWP.allowableStress}
                    onChange={(e) => setHeadMAWP({ ...headMAWP, allowableStress: e.target.value })}
                    placeholder="e.g., 20000 for SA-516-70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMawpE">Joint Efficiency (E)</Label>
                  <Select
                    value={headMAWP.jointEfficiency}
                    onValueChange={(value) => setHeadMAWP({ ...headMAWP, jointEfficiency: value })}
                  >
                    <SelectTrigger id="headMawpE">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1.0 (Full RT, Type 1)</SelectItem>
                      <SelectItem value="0.85">0.85 (Spot RT, Type 2)</SelectItem>
                      <SelectItem value="0.70">0.70 (No RT, Type 3)</SelectItem>
                      <SelectItem value="0.60">0.60 (Single Welded Butt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headMawpCA">Corrosion Allowance (CA) - inches</Label>
                  <Input
                    id="headMawpCA"
                    type="number"
                    step="0.01"
                    value={headMAWP.corrosionAllowance}
                    onChange={(e) => setHeadMAWP({ ...headMAWP, corrosionAllowance: e.target.value })}
                    placeholder="e.g., 0.125"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Result - psig</Label>
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">
                      {headMAWP.result || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculateHeadMAWP} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Head MAWP
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="life">
          <Card>
            <CardHeader>
              <CardTitle>Remaining Life Assessment</CardTitle>
              <CardDescription>Calculate remaining service life and next inspection interval</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentThickness">Current Thickness - inches</Label>
                  <Input
                    id="currentThickness"
                    type="number"
                    step="0.001"
                    value={remainingLife.currentThickness}
                    onChange={(e) => setRemainingLife({ ...remainingLife, currentThickness: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requiredThickness">Required Thickness - inches</Label>
                  <Input
                    id="requiredThickness"
                    type="number"
                    step="0.001"
                    value={remainingLife.requiredThickness}
                    onChange={(e) => setRemainingLife({ ...remainingLife, requiredThickness: e.target.value })}
                    placeholder="Use calculated minimum thickness"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="corrosionRate">Corrosion Rate - inches/year</Label>
                  <Input
                    id="corrosionRate"
                    type="number"
                    step="0.001"
                    value={remainingLife.corrosionRate}
                    onChange={(e) => setRemainingLife({ ...remainingLife, corrosionRate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="safetyFactor">Safety Factor</Label>
                  <Select
                    value={remainingLife.safetyFactor}
                    onValueChange={(value) => setRemainingLife({ ...remainingLife, safetyFactor: value })}
                  >
                    <SelectTrigger id="safetyFactor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.5">1.5</SelectItem>
                      <SelectItem value="2.0">2.0 (Recommended)</SelectItem>
                      <SelectItem value="2.5">2.5</SelectItem>
                      <SelectItem value="3.0">3.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Remaining Life - years</Label>
                  <div className="p-3 bg-green-50 rounded-md border border-green-200">
                    <p className="text-2xl font-bold text-green-700">
                      {remainingLife.result || "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Next Inspection - years</Label>
                  <div className="p-3 bg-orange-50 rounded-md border border-orange-200">
                    <p className="text-2xl font-bold text-orange-700">
                      {remainingLife.nextInspection || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={calculateRemainingLife} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Remaining Life
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save All Calculations"}
        </Button>
      </div>
    </div>
  );
}

