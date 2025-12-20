import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, CircleDot, Cylinder, Clock, Gauge, ArrowLeft, Info } from "lucide-react";
import { Link } from "wouter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Material stress data
const MATERIALS: Record<string, { name: string; stressData: Record<number, number> }> = {
  "SA-612": {
    name: "SA-612 (High Strength Carbon Steel)",
    stressData: { "-40": 23800, 100: 23800, 200: 23800, 300: 23800, 400: 23800, 500: 21000, 600: 18900, 650: 17600, 700: 16400 }
  },
  "SA-516-70": {
    name: "SA-516 Grade 70 (Carbon Steel)",
    stressData: { "-20": 20000, 100: 20000, 200: 20000, 300: 20000, 400: 20000, 500: 19400, 600: 17500, 650: 16600, 700: 14800 }
  },
  "SA-285-C": {
    name: "SA-285 Grade C (Carbon Steel)",
    stressData: { "-20": 13750, 100: 13750, 200: 13750, 300: 13750, 400: 13750, 500: 13750, 600: 13750, 650: 13750, 700: 12100 }
  },
  "SA-387-11": {
    name: "SA-387 Grade 11 Class 2 (Chrome-Moly)",
    stressData: { "-20": 17500, 100: 17500, 200: 17500, 300: 17500, 400: 17500, 500: 17500, 600: 17500, 700: 17500, 800: 16300 }
  },
  "SA-240-304": {
    name: "SA-240 Type 304 (Stainless Steel)",
    stressData: { "-20": 20000, 100: 20000, 200: 18100, 300: 16600, 400: 15600, 500: 14900, 600: 14400, 700: 14000, 800: 13500 }
  },
};

// Joint efficiency values
const JOINT_EFFICIENCIES: Record<string, { value: number; description: string }> = {
  "RT-1": { value: 1.00, description: "Full Radiography" },
  "RT-2": { value: 0.85, description: "Spot Radiography" },
  "RT-3": { value: 0.70, description: "Limited Radiography" },
  "RT-4": { value: 0.60, description: "No Radiography" },
};

// Helper to interpolate stress at temperature
function getStressAtTemp(material: string, temp: number): number {
  const data = MATERIALS[material]?.stressData;
  if (!data) return 20000;
  
  const temps = Object.keys(data).map(Number).sort((a, b) => a - b);
  
  if (temp <= temps[0]) return data[temps[0]];
  if (temp >= temps[temps.length - 1]) return data[temps[temps.length - 1]];
  
  for (let i = 0; i < temps.length - 1; i++) {
    if (temp >= temps[i] && temp <= temps[i + 1]) {
      const t1 = temps[i], t2 = temps[i + 1];
      const s1 = data[t1], s2 = data[t2];
      return s1 + (s2 - s1) * (temp - t1) / (t2 - t1);
    }
  }
  return 20000;
}

// Calculation functions
function calcShellTmin(P: number, R: number, S: number, E: number): number {
  const denom = S * E - 0.6 * P;
  if (denom <= 0) return 0;
  return (P * R) / denom;
}

function calcHeadTmin(P: number, D: number, S: number, E: number, headType: string, L?: number, r?: number): number {
  const R = D / 2;
  
  switch (headType) {
    case "hemispherical":
      const denomHemi = 2 * S * E - 0.2 * P;
      return denomHemi > 0 ? (P * R) / denomHemi : 0;
    case "ellipsoidal":
      const denomEllip = 2 * S * E - 0.2 * P;
      return denomEllip > 0 ? (P * D) / denomEllip : 0;
    case "torispherical":
      const crownR = L || D;
      const knuckleR = r || 0.06 * D;
      const M = 0.25 * (3 + Math.sqrt(crownR / knuckleR));
      const denomTori = 2 * S * E - 0.2 * P;
      return denomTori > 0 ? (P * crownR * M) / denomTori : 0;
    default:
      return 0;
  }
}

function calcShellMAWP(t: number, R: number, S: number, E: number): { hoop: number; long: number; governing: number } {
  const P_hoop = (S * E * t) / (R + 0.6 * t);
  const denomLong = R - 0.4 * t;
  const P_long = denomLong > 0 ? (2 * S * E * t) / denomLong : Infinity;
  return {
    hoop: P_hoop,
    long: P_long,
    governing: Math.min(P_hoop, P_long)
  };
}

function calcHeadMAWP(t: number, D: number, S: number, E: number, headType: string, L?: number, r?: number): number {
  const R = D / 2;
  
  switch (headType) {
    case "hemispherical":
      return (2 * S * E * t) / (R + 0.2 * t);
    case "ellipsoidal":
      return (2 * S * E * t) / (D + 0.2 * t);
    case "torispherical":
      const crownR = L || D;
      const knuckleR = r || 0.06 * D;
      const M = 0.25 * (3 + Math.sqrt(crownR / knuckleR));
      return (2 * S * E * t) / (crownR * M + 0.2 * t);
    default:
      return 0;
  }
}

function calcCorrosionRate(tPrev: number, tAct: number, years: number): number {
  if (years <= 0) return 0;
  return (tPrev - tAct) / years;
}

function calcRemainingLife(tAct: number, tMin: number, Cr: number): number {
  if (Cr <= 0) return 999;
  const CA = tAct - tMin;
  if (CA <= 0) return 0;
  return CA / Cr;
}

function calcStaticHead(SG: number, h: number): number {
  return SG * h * 0.433;
}

// Info tooltip component
function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Result display component
function ResultCard({ label, value, unit, formula, status }: { 
  label: string; 
  value: number | string; 
  unit: string; 
  formula?: string;
  status?: "good" | "warning" | "critical";
}) {
  const statusColors = {
    good: "bg-green-100 text-green-800 border-green-300",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
    critical: "bg-red-100 text-red-800 border-red-300",
  };
  
  return (
    <div className={`p-4 rounded-lg border ${status ? statusColors[status] : "bg-muted/50"}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">
        {typeof value === "number" ? value.toFixed(4) : value} <span className="text-base font-normal">{unit}</span>
      </div>
      {formula && <div className="text-xs text-muted-foreground mt-1 font-mono">{formula}</div>}
    </div>
  );
}

export default function API510Calculator() {
  // Shell calculator state
  const [shellInputs, setShellInputs] = useState({
    P: 225,
    D: 130.25,
    material: "SA-612",
    temp: 125,
    rtType: "RT-1",
    tAct: 0.800,
  });

  // Head calculator state
  const [headInputs, setHeadInputs] = useState({
    P: 225,
    D: 130.25,
    material: "SA-612",
    temp: 125,
    rtType: "RT-1",
    headType: "hemispherical",
    tAct: 0.502,
    L: 130.25,
    r: 7.815,
  });

  // Corrosion calculator state
  const [corrInputs, setCorrInputs] = useState({
    tPrev: 0.530,
    tAct: 0.502,
    years: 10,
    tMin: 0.421,
  });

  // MAWP calculator state
  const [mawpInputs, setMawpInputs] = useState({
    t: 0.800,
    D: 130.25,
    material: "SA-612",
    temp: 125,
    rtType: "RT-1",
    componentType: "shell",
    headType: "ellipsoidal",
    SG: 0.92,
    h: 10,
  });

  // Shell calculations
  const shellResults = useMemo(() => {
    const R = shellInputs.D / 2;
    const S = getStressAtTemp(shellInputs.material, shellInputs.temp);
    const E = JOINT_EFFICIENCIES[shellInputs.rtType].value;
    const tMin = calcShellTmin(shellInputs.P, R, S, E);
    const CA = shellInputs.tAct - tMin;
    
    return {
      R,
      S,
      E,
      tMin,
      CA,
      status: CA < 0 ? "critical" : CA < 0.0625 ? "warning" : "good" as "good" | "warning" | "critical",
    };
  }, [shellInputs]);

  // Head calculations
  const headResults = useMemo(() => {
    const S = getStressAtTemp(headInputs.material, headInputs.temp);
    const E = JOINT_EFFICIENCIES[headInputs.rtType].value;
    const tMin = calcHeadTmin(headInputs.P, headInputs.D, S, E, headInputs.headType, headInputs.L, headInputs.r);
    const CA = headInputs.tAct - tMin;
    
    // Calculate M factor for torispherical
    let M = 1;
    if (headInputs.headType === "torispherical") {
      const L = headInputs.L || headInputs.D;
      const r = headInputs.r || 0.06 * headInputs.D;
      M = 0.25 * (3 + Math.sqrt(L / r));
    }
    
    return {
      S,
      E,
      tMin,
      CA,
      M,
      status: CA < 0 ? "critical" : CA < 0.0625 ? "warning" : "good" as "good" | "warning" | "critical",
    };
  }, [headInputs]);

  // Corrosion calculations
  const corrResults = useMemo(() => {
    const Cr = calcCorrosionRate(corrInputs.tPrev, corrInputs.tAct, corrInputs.years);
    const CA = corrInputs.tAct - corrInputs.tMin;
    const RL = calcRemainingLife(corrInputs.tAct, corrInputs.tMin, Cr);
    const nextInspection = RL / 2;
    
    return {
      Cr,
      CrMpy: Cr * 1000,
      CA,
      RL,
      nextInspection: Math.min(nextInspection, 10),
      status: RL < 2 ? "critical" : RL < 5 ? "warning" : "good" as "good" | "warning" | "critical",
    };
  }, [corrInputs]);

  // MAWP calculations
  const mawpResults = useMemo(() => {
    const S = getStressAtTemp(mawpInputs.material, mawpInputs.temp);
    const E = JOINT_EFFICIENCIES[mawpInputs.rtType].value;
    const staticHead = calcStaticHead(mawpInputs.SG, mawpInputs.h);
    
    let mawp: number;
    let details: any = {};
    
    if (mawpInputs.componentType === "shell") {
      const R = mawpInputs.D / 2;
      const result = calcShellMAWP(mawpInputs.t, R, S, E);
      mawp = result.governing - staticHead;
      details = { ...result, staticHead };
    } else {
      mawp = calcHeadMAWP(mawpInputs.t, mawpInputs.D, S, E, mawpInputs.headType) - staticHead;
      details = { staticHead };
    }
    
    return {
      S,
      E,
      mawp,
      mawpGross: mawp + staticHead,
      staticHead,
      ...details,
    };
  }, [mawpInputs]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calculator className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">API 510 Calculator</h1>
            </div>
            <Badge variant="outline" className="ml-auto">ASME Section VIII Div 1</Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <Tabs defaultValue="shell" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="shell" className="gap-2">
              <Cylinder className="h-4 w-4" />
              Shell
            </TabsTrigger>
            <TabsTrigger value="head" className="gap-2">
              <CircleDot className="h-4 w-4" />
              Head
            </TabsTrigger>
            <TabsTrigger value="corrosion" className="gap-2">
              <Clock className="h-4 w-4" />
              Corrosion
            </TabsTrigger>
            <TabsTrigger value="mawp" className="gap-2">
              <Gauge className="h-4 w-4" />
              MAWP
            </TabsTrigger>
          </TabsList>

          {/* Shell Calculator */}
          <TabsContent value="shell">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Shell Minimum Thickness Calculator</CardTitle>
                  <CardDescription>ASME Section VIII, Division 1, UG-27(c)(1)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Design Pressure (P) <InfoTooltip content="Internal design pressure in psi" /></Label>
                      <Input
                        type="number"
                        value={shellInputs.P}
                        onChange={(e) => setShellInputs({ ...shellInputs, P: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">psi</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Inside Diameter (D) <InfoTooltip content="Inside diameter of the shell" /></Label>
                      <Input
                        type="number"
                        value={shellInputs.D}
                        onChange={(e) => setShellInputs({ ...shellInputs, D: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Material Specification</Label>
                    <Select
                      value={shellInputs.material}
                      onValueChange={(v) => setShellInputs({ ...shellInputs, material: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MATERIALS).map(([key, mat]) => (
                          <SelectItem key={key} value={key}>{mat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Design Temperature <InfoTooltip content="Temperature for stress lookup" /></Label>
                      <Input
                        type="number"
                        value={shellInputs.temp}
                        onChange={(e) => setShellInputs({ ...shellInputs, temp: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">°F</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Radiography Type</Label>
                      <Select
                        value={shellInputs.rtType}
                        onValueChange={(v) => setShellInputs({ ...shellInputs, rtType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOINT_EFFICIENCIES).map(([key, je]) => (
                            <SelectItem key={key} value={key}>{key} - {je.description} (E={je.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Actual Measured Thickness <InfoTooltip content="Minimum measured thickness from inspection" /></Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={shellInputs.tAct}
                      onChange={(e) => setShellInputs({ ...shellInputs, tAct: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">inches</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Calculated values per ASME formulas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <ResultCard label="Inside Radius (R)" value={shellResults.R} unit="in" formula="R = D / 2" />
                    <ResultCard label="Allowable Stress (S)" value={shellResults.S} unit="psi" formula={`At ${shellInputs.temp}°F`} />
                    <ResultCard label="Joint Efficiency (E)" value={shellResults.E} unit="" formula={shellInputs.rtType} />
                  </div>
                  
                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Minimum Required Thickness (t_min)" 
                      value={shellResults.tMin} 
                      unit="in" 
                      formula="t_min = PR / (SE - 0.6P)"
                      status={shellResults.status}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Remaining Corrosion Allowance (CA)" 
                      value={shellResults.CA} 
                      unit="in" 
                      formula="CA = t_act - t_min"
                      status={shellResults.status}
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">Formula Applied:</h4>
                    <code className="text-sm text-blue-700">
                      t_min = ({shellInputs.P} × {shellResults.R.toFixed(3)}) / ({shellResults.S} × {shellResults.E} - 0.6 × {shellInputs.P})
                    </code>
                    <div className="text-sm text-blue-600 mt-2">
                      = {(shellInputs.P * shellResults.R).toFixed(2)} / {(shellResults.S * shellResults.E - 0.6 * shellInputs.P).toFixed(2)}
                    </div>
                    <div className="text-sm font-bold text-blue-800 mt-1">
                      = {shellResults.tMin.toFixed(4)} inches
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Head Calculator */}
          <TabsContent value="head">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Head Minimum Thickness Calculator</CardTitle>
                  <CardDescription>ASME Section VIII, Division 1, UG-32</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Head Type</Label>
                    <Select
                      value={headInputs.headType}
                      onValueChange={(v) => setHeadInputs({ ...headInputs, headType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hemispherical">Hemispherical</SelectItem>
                        <SelectItem value="ellipsoidal">2:1 Ellipsoidal</SelectItem>
                        <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Design Pressure (P)</Label>
                      <Input
                        type="number"
                        value={headInputs.P}
                        onChange={(e) => setHeadInputs({ ...headInputs, P: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">psi</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Inside Diameter (D)</Label>
                      <Input
                        type="number"
                        value={headInputs.D}
                        onChange={(e) => setHeadInputs({ ...headInputs, D: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                  </div>

                  {headInputs.headType === "torispherical" && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Crown Radius (L) <InfoTooltip content="Inside crown radius, typically = D for standard F&D" /></Label>
                        <Input
                          type="number"
                          value={headInputs.L}
                          onChange={(e) => setHeadInputs({ ...headInputs, L: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">inches</span>
                      </div>
                      <div className="space-y-2">
                        <Label>Knuckle Radius (r) <InfoTooltip content="Inside knuckle radius, typically = 0.06D for standard F&D" /></Label>
                        <Input
                          type="number"
                          value={headInputs.r}
                          onChange={(e) => setHeadInputs({ ...headInputs, r: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">inches</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Material Specification</Label>
                    <Select
                      value={headInputs.material}
                      onValueChange={(v) => setHeadInputs({ ...headInputs, material: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MATERIALS).map(([key, mat]) => (
                          <SelectItem key={key} value={key}>{mat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Design Temperature</Label>
                      <Input
                        type="number"
                        value={headInputs.temp}
                        onChange={(e) => setHeadInputs({ ...headInputs, temp: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">°F</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Radiography Type</Label>
                      <Select
                        value={headInputs.rtType}
                        onValueChange={(v) => setHeadInputs({ ...headInputs, rtType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOINT_EFFICIENCIES).map(([key, je]) => (
                            <SelectItem key={key} value={key}>{key} (E={je.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Actual Measured Thickness</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={headInputs.tAct}
                      onChange={(e) => setHeadInputs({ ...headInputs, tAct: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-xs text-muted-foreground">inches</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Calculated values per ASME formulas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <ResultCard label="Allowable Stress (S)" value={headResults.S} unit="psi" />
                    <ResultCard label="Joint Efficiency (E)" value={headResults.E} unit="" />
                    {headInputs.headType === "torispherical" && (
                      <ResultCard label="M-Factor" value={headResults.M} unit="" formula="M = 0.25(3 + √(L/r))" />
                    )}
                  </div>
                  
                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Minimum Required Thickness (t_min)" 
                      value={headResults.tMin} 
                      unit="in" 
                      formula={
                        headInputs.headType === "hemispherical" ? "t = PL/(2SE-0.2P)" :
                        headInputs.headType === "ellipsoidal" ? "t = PD/(2SE-0.2P)" :
                        "t = PLM/(2SE-0.2P)"
                      }
                      status={headResults.status}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Remaining Corrosion Allowance (CA)" 
                      value={headResults.CA} 
                      unit="in" 
                      formula="CA = t_act - t_min"
                      status={headResults.status}
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      {headInputs.headType.charAt(0).toUpperCase() + headInputs.headType.slice(1)} Head Formula:
                    </h4>
                    {headInputs.headType === "hemispherical" && (
                      <>
                        <code className="text-sm text-blue-700">t_min = PL / (2SE - 0.2P)</code>
                        <div className="text-sm text-blue-600 mt-2">
                          = ({headInputs.P} × {(headInputs.D/2).toFixed(3)}) / (2 × {headResults.S} × {headResults.E} - 0.2 × {headInputs.P})
                        </div>
                      </>
                    )}
                    {headInputs.headType === "ellipsoidal" && (
                      <>
                        <code className="text-sm text-blue-700">t_min = PD / (2SE - 0.2P)</code>
                        <div className="text-sm text-blue-600 mt-2">
                          = ({headInputs.P} × {headInputs.D}) / (2 × {headResults.S} × {headResults.E} - 0.2 × {headInputs.P})
                        </div>
                      </>
                    )}
                    {headInputs.headType === "torispherical" && (
                      <>
                        <code className="text-sm text-blue-700">t_min = PLM / (2SE - 0.2P)</code>
                        <div className="text-sm text-blue-600 mt-2">
                          M = 0.25 × (3 + √({headInputs.L}/{headInputs.r})) = {headResults.M.toFixed(4)}
                        </div>
                      </>
                    )}
                    <div className="text-sm font-bold text-blue-800 mt-1">
                      = {headResults.tMin.toFixed(4)} inches
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Corrosion Calculator */}
          <TabsContent value="corrosion">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Corrosion Rate & Remaining Life Calculator</CardTitle>
                  <CardDescription>API 510 remaining life assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Previous Thickness (t_prev) <InfoTooltip content="Thickness at previous inspection" /></Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={corrInputs.tPrev}
                        onChange={(e) => setCorrInputs({ ...corrInputs, tPrev: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Current Thickness (t_act) <InfoTooltip content="Minimum measured thickness at current inspection" /></Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={corrInputs.tAct}
                        onChange={(e) => setCorrInputs({ ...corrInputs, tAct: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Time Between Inspections (Y) <InfoTooltip content="Years between previous and current inspection" /></Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={corrInputs.years}
                        onChange={(e) => setCorrInputs({ ...corrInputs, years: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">years</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Required Thickness (t_min) <InfoTooltip content="Calculated minimum thickness from shell/head calculator" /></Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={corrInputs.tMin}
                        onChange={(e) => setCorrInputs({ ...corrInputs, tMin: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Corrosion analysis per API 510</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <ResultCard 
                      label="Corrosion Rate (Cr)" 
                      value={corrResults.Cr} 
                      unit="in/yr" 
                      formula="Cr = (t_prev - t_act) / Y"
                    />
                    <ResultCard 
                      label="Corrosion Rate" 
                      value={corrResults.CrMpy} 
                      unit="mpy" 
                      formula="mils per year"
                    />
                  </div>
                  
                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Remaining Corrosion Allowance (CA)" 
                      value={corrResults.CA} 
                      unit="in" 
                      formula="CA = t_act - t_min"
                    />
                  </div>

                  <div className="border-t pt-4 grid grid-cols-2 gap-4">
                    <ResultCard 
                      label="Remaining Life (RL)" 
                      value={corrResults.RL > 100 ? ">100" : corrResults.RL.toFixed(2)} 
                      unit="years" 
                      formula="RL = CA / Cr"
                      status={corrResults.status}
                    />
                    <ResultCard 
                      label="Next Inspection" 
                      value={corrResults.nextInspection.toFixed(1)} 
                      unit="years" 
                      formula="RL / 2 (max 10 yrs)"
                      status={corrResults.status}
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">Calculation Steps:</h4>
                    <div className="space-y-1 text-sm text-blue-700">
                      <div>1. Cr = ({corrInputs.tPrev} - {corrInputs.tAct}) / {corrInputs.years} = {corrResults.Cr.toFixed(6)} in/yr</div>
                      <div>2. CA = {corrInputs.tAct} - {corrInputs.tMin} = {corrResults.CA.toFixed(4)} in</div>
                      <div>3. RL = {corrResults.CA.toFixed(4)} / {corrResults.Cr.toFixed(6)} = {corrResults.RL > 100 ? ">100" : corrResults.RL.toFixed(2)} years</div>
                      <div>4. Next Inspection = {corrResults.RL.toFixed(2)} / 2 = {(corrResults.RL/2).toFixed(2)} years (max 10)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* MAWP Calculator */}
          <TabsContent value="mawp">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>MAWP Calculator</CardTitle>
                  <CardDescription>Maximum Allowable Working Pressure per ASME UG-27/UG-32</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Component Type</Label>
                    <Select
                      value={mawpInputs.componentType}
                      onValueChange={(v) => setMawpInputs({ ...mawpInputs, componentType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shell">Cylindrical Shell</SelectItem>
                        <SelectItem value="head">Head</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {mawpInputs.componentType === "head" && (
                    <div className="space-y-2">
                      <Label>Head Type</Label>
                      <Select
                        value={mawpInputs.headType}
                        onValueChange={(v) => setMawpInputs({ ...mawpInputs, headType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hemispherical">Hemispherical</SelectItem>
                          <SelectItem value="ellipsoidal">2:1 Ellipsoidal</SelectItem>
                          <SelectItem value="torispherical">Torispherical (F&D)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Actual Thickness (t)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={mawpInputs.t}
                        onChange={(e) => setMawpInputs({ ...mawpInputs, t: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Inside Diameter (D)</Label>
                      <Input
                        type="number"
                        value={mawpInputs.D}
                        onChange={(e) => setMawpInputs({ ...mawpInputs, D: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">inches</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Material Specification</Label>
                    <Select
                      value={mawpInputs.material}
                      onValueChange={(v) => setMawpInputs({ ...mawpInputs, material: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MATERIALS).map(([key, mat]) => (
                          <SelectItem key={key} value={key}>{mat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Design Temperature</Label>
                      <Input
                        type="number"
                        value={mawpInputs.temp}
                        onChange={(e) => setMawpInputs({ ...mawpInputs, temp: parseFloat(e.target.value) || 0 })}
                      />
                      <span className="text-xs text-muted-foreground">°F</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Radiography Type</Label>
                      <Select
                        value={mawpInputs.rtType}
                        onValueChange={(v) => setMawpInputs({ ...mawpInputs, rtType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOINT_EFFICIENCIES).map(([key, je]) => (
                            <SelectItem key={key} value={key}>{key} (E={je.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Static Head Deduction</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Specific Gravity (SG)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={mawpInputs.SG}
                          onChange={(e) => setMawpInputs({ ...mawpInputs, SG: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Liquid Height (h)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={mawpInputs.h}
                          onChange={(e) => setMawpInputs({ ...mawpInputs, h: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">feet</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>MAWP calculation results</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <ResultCard label="Allowable Stress (S)" value={mawpResults.S} unit="psi" />
                    <ResultCard label="Joint Efficiency (E)" value={mawpResults.E} unit="" />
                  </div>

                  {mawpInputs.componentType === "shell" && mawpResults.hoop && (
                    <div className="border-t pt-4 grid grid-cols-2 gap-4">
                      <ResultCard 
                        label="P (Hoop Stress)" 
                        value={mawpResults.hoop} 
                        unit="psi" 
                        formula="SEt/(R+0.6t)"
                      />
                      <ResultCard 
                        label="P (Longitudinal)" 
                        value={mawpResults.long === Infinity ? "N/A" : mawpResults.long} 
                        unit="psi" 
                        formula="2SEt/(R-0.4t)"
                      />
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <ResultCard 
                      label="Static Head Pressure" 
                      value={mawpResults.staticHead} 
                      unit="psi" 
                      formula="SG × h × 0.433"
                    />
                  </div>

                  <div className="border-t pt-4 grid grid-cols-2 gap-4">
                    <ResultCard 
                      label="MAWP (Gross)" 
                      value={mawpResults.mawpGross} 
                      unit="psi" 
                      formula="Before static head"
                    />
                    <ResultCard 
                      label="MAWP (Net)" 
                      value={mawpResults.mawp} 
                      unit="psi" 
                      formula="After static head"
                      status="good"
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">
                      {mawpInputs.componentType === "shell" ? "Shell" : mawpInputs.headType.charAt(0).toUpperCase() + mawpInputs.headType.slice(1) + " Head"} MAWP Formula:
                    </h4>
                    {mawpInputs.componentType === "shell" ? (
                      <div className="space-y-1 text-sm text-blue-700">
                        <div>P_hoop = SEt/(R+0.6t) = {mawpResults.hoop?.toFixed(2)} psi</div>
                        <div>P_long = 2SEt/(R-0.4t) = {mawpResults.long === Infinity ? "N/A" : mawpResults.long?.toFixed(2)} psi</div>
                        <div>Governing = MIN(P_hoop, P_long) = {mawpResults.mawpGross.toFixed(2)} psi</div>
                        <div>Static Head = {mawpInputs.SG} × {mawpInputs.h} × 0.433 = {mawpResults.staticHead.toFixed(2)} psi</div>
                        <div className="font-bold">MAWP = {mawpResults.mawpGross.toFixed(2)} - {mawpResults.staticHead.toFixed(2)} = {mawpResults.mawp.toFixed(2)} psi</div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-blue-700">
                        <div>MAWP (gross) = {mawpResults.mawpGross.toFixed(2)} psi</div>
                        <div>Static Head = {mawpResults.staticHead.toFixed(2)} psi</div>
                        <div className="font-bold">MAWP (net) = {mawpResults.mawp.toFixed(2)} psi</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Formula Reference */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Formula Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-semibold mb-1">Shell t_min</div>
                <code className="text-xs">t = PR/(SE-0.6P)</code>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-semibold mb-1">Ellipsoidal t_min</div>
                <code className="text-xs">t = PD/(2SE-0.2P)</code>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-semibold mb-1">Corrosion Rate</div>
                <code className="text-xs">Cr = (t_prev-t_act)/Y</code>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="font-semibold mb-1">Remaining Life</div>
                <code className="text-xs">RL = (t_act-t_min)/Cr</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
