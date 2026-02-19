import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Save, FileDown, ArrowLeft, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Link } from "wouter";
import CodeClausePanel, { CodeClauseBadge } from "@/components/CodeClausePanel";
import type { CalculationType } from "@/components/CodeClausePanel";

export default function CalculationWorksheet() {
  // Header Information
  const [reportNo, setReportNo] = useState("");
  const [client, setClient] = useState("");
  const [inspector, setInspector] = useState("");
  const [vessel, setVessel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Shell Parameters
  const [shellMaterial, setShellMaterial] = useState("SA-516-70");
  const [shellTemp, setShellTemp] = useState("200");
  const [shellMAWP, setShellMAWP] = useState("250");
  const [shellSH, setShellSH] = useState("6.0");
  const [shellSG, setShellSG] = useState("0.92");
  const [shellD, setShellD] = useState("70.750");
  const [shellTnom, setShellTnom] = useState("0.625");
  const [shellS, setShellS] = useState("20000");
  const [shellE, setShellE] = useState("0.85");
  
  // Shell Measurements
  const [shellTprev, setShellTprev] = useState("0.625");
  const [shellTact, setShellTact] = useState("0.652");
  const [shellY, setShellY] = useState("12.0");

  // Head Parameters
  const [headType, setHeadType] = useState("ellipsoidal");
  const [headMaterial, setHeadMaterial] = useState("SA-516-70");
  const [headMAWP, setHeadMAWP] = useState("250");
  const [headD, setHeadD] = useState("70.750");
  const [headT, setHeadT] = useState("200");
  const [headE, setHeadE] = useState("0.85");
  const [headSG1, setHeadSG1] = useState("0.92");
  const [headSG2, setHeadSG2] = useState("0.92");
  const [headTnom, setHeadTnom] = useState("0.500");
  const [headS, setHeadS] = useState("20000");
  const [headSH, setHeadSH] = useState("6.0");
  const [headP, setHeadP] = useState("252.4");

  // Head Measurements
  const [headTprev, setHeadTprev] = useState("0.500");
  const [headTact, setHeadTact] = useState("0.555");
  const [headY, setHeadY] = useState("12.0");

  // Calculated Results - Shell
  const [shellTmin, setShellTmin] = useState("0");
  const [shellCa, setShellCa] = useState("0");
  const [shellCr, setShellCr] = useState("0");
  const [shellRL, setShellRL] = useState("0");
  const [shellNextInspection, setShellNextInspection] = useState("0");
  const [shellMAPnext, setShellMAPnext] = useState("0");
  const [shellMAWPnext, setShellMAWPnext] = useState("0");

  // Calculated Results - Head
  const [headTmin, setHeadTmin] = useState("0");
  const [headCa, setHeadCa] = useState("0");
  const [headCr, setHeadCr] = useState("0");
  const [headRL, setHeadRL] = useState("0");
  const [headMAPnext, setHeadMAPnext] = useState("0");
  const [headMAWPnext, setHeadMAWPnext] = useState("0");

  // Conical Section Parameters (Specialty — ASME VIII UG-32(g) Reducer Cones)
  const [conicalD, setConicalD] = useState("48.000");
  const [conicalAlpha, setConicalAlpha] = useState("30");
  const [conicalP, setConicalP] = useState("250");
  const [conicalS, setConicalS] = useState("20000");
  const [conicalE, setConicalE] = useState("0.85");
  const [conicalMaterial, setConicalMaterial] = useState("SA-516-70");
  const [conicalTnom, setConicalTnom] = useState("0.500");
  const [conicalTact, setConicalTact] = useState("0.480");
  const [conicalTprev, setConicalTprev] = useState("0.500");
  const [conicalY, setConicalY] = useState("10.0");
  const [conicalTmin, setConicalTmin] = useState("0");
  const [conicalCa, setConicalCa] = useState("0");
  const [conicalCr, setConicalCr] = useState("0");
  const [conicalRL, setConicalRL] = useState("0");
  const [conicalMAPnext, setConicalMAPnext] = useState("0");
  const [conicalMAWPnext, setConicalMAWPnext] = useState("0");
  const [conicalAlphaWarning, setConicalAlphaWarning] = useState(false);

  // Calculate Shell Results
  useEffect(() => {
    const P = parseFloat(shellMAWP);
    const R = parseFloat(shellD) / 2;
    const S = parseFloat(shellS);
    const E = parseFloat(shellE);
    const tact = parseFloat(shellTact);
    const tprev = parseFloat(shellTprev);
    const Y = parseFloat(shellY);

    if (!isNaN(P) && !isNaN(R) && !isNaN(S) && !isNaN(E)) {
      // Minimum thickness: t = PR/(SE-0.6P)
      const tmin = (P * R) / (S * E - 0.6 * P);
      setShellTmin(tmin.toFixed(3));

      if (!isNaN(tact) && !isNaN(tprev) && !isNaN(Y) && Y > 0) {
        // Corrosion allowance: Ca = tact - tmin
        const ca = tact - tmin;
        setShellCa(ca.toFixed(3));

        // Corrosion rate: Cr = (tprev - tact) / Y
        const cr = (tprev - tact) / Y;
        setShellCr(cr.toFixed(5));

        // Remaining life: RL = Ca / Cr
        if (cr > 0) {
          const rl = ca / cr;
          setShellRL(rl > 100 ? ">100" : rl.toFixed(1));
          
          // Next inspection (half of remaining life)
          const yn = rl / 2;
          setShellNextInspection(yn > 50 ? "50" : yn.toFixed(1));

          // MAWP at next inspection
          // t at next inspection = tact - 2*Yn*Cr
          const tNext = tact - 2 * yn * cr;
          const mapNext = (S * E * tNext) / (R + 0.6 * tNext);
          setShellMAPnext(mapNext.toFixed(1));
          
          // MAWP = P-(SH*.433*SG)
          const mawpNext = mapNext - (parseFloat(shellSH) * 0.433 * parseFloat(shellSG));
          setShellMAWPnext(mawpNext.toFixed(1));
        } else {
          setShellRL(">100");
          setShellNextInspection("50");
          
          // Current MAWP calculation
          const mapCurrent = (S * E * tact) / (R + 0.6 * tact);
          setShellMAPnext(mapCurrent.toFixed(1));
          const mawpCurrent = mapCurrent - (parseFloat(shellSH) * 0.433 * parseFloat(shellSG));
          setShellMAWPnext(mawpCurrent.toFixed(1));
        }
      }
    }
  }, [shellMAWP, shellD, shellS, shellE, shellTact, shellTprev, shellY, shellSH, shellSG]);

  // Calculate Head Results
  useEffect(() => {
    const P = parseFloat(headP);
    const D = parseFloat(headD);
    const S = parseFloat(headS);
    const E = parseFloat(headE);
    const tact = parseFloat(headTact);
    const tprev = parseFloat(headTprev);
    const Y = parseFloat(headY);

    if (!isNaN(P) && !isNaN(D) && !isNaN(S) && !isNaN(E)) {
      let tmin = 0;
      
      // Calculate minimum thickness based on head type
      switch (headType) {
        case "hemispherical":
          // PL/(2SE-0.2P) = t min
          tmin = (P * (D / 2)) / (2 * S * E - 0.2 * P);
          break;
        case "ellipsoidal":
          // PD/(2SE-0.2P) = t min
          tmin = (P * D) / (2 * S * E - 0.2 * P);
          break;
        case "torispherical":
          // PLM/(2SE-0.2P) = t min
          // For F&D heads, M = 1.54 and L = D
          const M = 1.54;
          const L = D;
          tmin = (P * L * M) / (2 * S * E - 0.2 * P);
          break;
      }
      
      setHeadTmin(tmin.toFixed(3));

      if (!isNaN(tact) && !isNaN(tprev) && !isNaN(Y) && Y > 0) {
        // Corrosion allowance: Ca = tact - tmin
        const ca = tact - tmin;
        setHeadCa(ca.toFixed(3));

        // Corrosion rate: Cr = (tprev - tact) / Y
        const cr = (tprev - tact) / Y;
        setHeadCr(cr.toFixed(5));

        // Remaining life: RL = Ca / Cr
        if (cr > 0) {
          const rl = ca / cr;
          setHeadRL(rl > 100 ? ">100" : rl.toFixed(1));
        } else {
          setHeadRL(">100");
        }

        // MAWP calculations for head
        let mapNext = 0;
        switch (headType) {
          case "hemispherical":
            // 2SEt/(R+0.2t) = P
            mapNext = (2 * S * E * tact) / ((D / 2) + 0.2 * tact);
            break;
          case "ellipsoidal":
            // 2SEt/(D+0.2t) = P
            mapNext = (2 * S * E * tact) / (D + 0.2 * tact);
            break;
          case "torispherical":
            // 2SEt/(LM+0.2t) = P
            const M = 1.54;
            const L = D;
            mapNext = (2 * S * E * tact) / (L * M + 0.2 * tact);
            break;
        }
        
        setHeadMAPnext(mapNext.toFixed(1));
        
        // MAWP = P-(SH*.433*SG)
        const mawpNext = mapNext - (parseFloat(headSH) * 0.433 * parseFloat(headSG1));
        setHeadMAWPnext(mawpNext.toFixed(1));
      }
    }
  }, [headType, headP, headD, headS, headE, headTact, headTprev, headY, headSH, headSG1]);

  // Calculate Conical Section Results — ASME VIII-1 UG-32(g)
  useEffect(() => {
    const P = parseFloat(conicalP);
    const D = parseFloat(conicalD);
    const S = parseFloat(conicalS);
    const E = parseFloat(conicalE);
    const alphaDeg = parseFloat(conicalAlpha);
    const tact = parseFloat(conicalTact);
    const tprev = parseFloat(conicalTprev);
    const Y = parseFloat(conicalY);

    // Warn if alpha > 30° (UG-32(g) limit)
    setConicalAlphaWarning(alphaDeg > 30);

    if (!isNaN(P) && !isNaN(D) && !isNaN(S) && !isNaN(E) && !isNaN(alphaDeg)) {
      const alpha = alphaDeg * (Math.PI / 180);
      const cosAlpha = Math.cos(alpha);

      // t = PD / (2cos(α)(SE - 0.6P))
      const denominator = 2 * cosAlpha * (S * E - 0.6 * P);
      const tmin = denominator > 0 ? (P * D) / denominator : 0;
      setConicalTmin(tmin.toFixed(3));

      if (!isNaN(tact) && !isNaN(tprev) && !isNaN(Y) && Y > 0) {
        const ca = tact - tmin;
        setConicalCa(ca.toFixed(3));

        const cr = (tprev - tact) / Y;
        setConicalCr(cr.toFixed(5));

        if (cr > 0) {
          const rl = ca / cr;
          setConicalRL(rl > 100 ? ">100" : rl.toFixed(1));

          // MAWP = 2SEt·cos(α) / (D + 1.2t·cos(α))
          const mapNext = (2 * S * E * tact * cosAlpha) / (D + 1.2 * tact * cosAlpha);
          setConicalMAPnext(mapNext.toFixed(1));
          setConicalMAWPnext(mapNext.toFixed(1));
        } else {
          setConicalRL(">100");
          const mapCurrent = (2 * S * E * tact * cosAlpha) / (D + 1.2 * tact * cosAlpha);
          setConicalMAPnext(mapCurrent.toFixed(1));
          setConicalMAWPnext(mapCurrent.toFixed(1));
        }
      }
    }
  }, [conicalP, conicalD, conicalS, conicalE, conicalAlpha, conicalTact, conicalTprev, conicalY]);

  const handleExport = () => {
    // Create a simple text export of the calculation results
    const data = [
      `API-510 Pressure Vessel Evaluation`,
      `Report No: ${reportNo}`,
      `Client: ${client}`,
      `Inspector: ${inspector}`,
      `Vessel: ${vessel}`,
      `Date: ${date}`,
      ``,
      `SHELL EVALUATION`,
      `Material: ${shellMaterial}`,
      `Design Temperature: ${shellTemp}°F`,
      `MAWP: ${shellMAWP} psig`,
      `Outside Diameter: ${shellD} in`,
      `Nominal Thickness: ${shellTnom} in`,
      `Actual Thickness: ${shellTact} in`,
      ``,
      `SHELL RESULTS`,
      `Minimum Required Thickness: ${shellTmin} in`,
      `Corrosion Allowance: ${shellCa} in`,
      `Corrosion Rate: ${shellCr} mpy`,
      `Remaining Life: ${shellRL} years`,
      `Thickness at Next Inspection: ${shellNextInspection} in`,
      `MAP at Next Inspection: ${shellMAPnext} psig`,
      `MAWP at Next Inspection: ${shellMAWPnext} psig`,
      ``,
      `HEAD EVALUATION`,
      `Type: ${headType}`,
      `Material: ${headMaterial}`,
      `MAWP: ${headMAWP} psig`,
      `Outside Diameter: ${headD} in`,
      `Nominal Thickness: ${headTnom} in`,
      `Actual Thickness: ${headTact} in`,
      ``,
      `HEAD RESULTS`,
      `Minimum Required Thickness: ${headTmin} in`,
      `Corrosion Allowance: ${headCa} in`,
      `Corrosion Rate: ${headCr} mpy`,
      `Remaining Life: ${headRL} years`,
      `MAP at Next Inspection: ${headMAPnext} psig`,
      `MAWP at Next Inspection: ${headMAWPnext} psig`,
    ].join('\n');

    // Create a blob and download
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calculation-Worksheet-${reportNo || Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Calculation worksheet exported successfully");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        
        {/* Header */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardTitle className="text-2xl">API-510 Pressure Vessel Evaluation</CardTitle>
            <CardDescription className="text-blue-100">
              Minimum Thickness, Remaining Life, Pressure Calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reportNo">Report No.</Label>
                <Input
                  id="reportNo"
                  value={reportNo}
                  onChange={(e) => setReportNo(e.target.value)}
                  placeholder="54-11-067"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspector">Inspector</Label>
                <Input
                  id="inspector"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  placeholder="Inspector Name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vessel">Vessel</Label>
                <Input
                  id="vessel"
                  value={vessel}
                  onChange={(e) => setVessel(e.target.value)}
                  placeholder="54-11-067"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="shell" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shell">Shell Evaluation</TabsTrigger>
            <TabsTrigger value="head">Head Evaluation</TabsTrigger>
            <TabsTrigger value="conical" className="text-amber-700">Conical (Advanced)</TabsTrigger>
            <TabsTrigger value="definitions">Variable Definitions</TabsTrigger>
          </TabsList>

          {/* SHELL EVALUATION */}
          <TabsContent value="shell" className="space-y-6">
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle>Vessel Shell - Material & Design Parameters</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shellMaterial">Material</Label>
                    <Select value={shellMaterial} onValueChange={setShellMaterial}>
                      <SelectTrigger id="shellMaterial">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SA-516-70">SA-516-70</SelectItem>
                        <SelectItem value="SA-516-60">SA-516-60</SelectItem>
                        <SelectItem value="SA-515-70">SA-515-70</SelectItem>
                        <SelectItem value="SA-285-C">SA-285-C</SelectItem>
                        <SelectItem value="SA-240-304">SA-240-304</SelectItem>
                        <SelectItem value="SA-240-316">SA-240-316</SelectItem>
                        <SelectItem value="SA-240-316L">SA-240-316L</SelectItem>
                        <SelectItem value="SA-612">SA-612</SelectItem>
                        <SelectItem value="SA-387-11-1">SA-387 Gr 11 Cl 1</SelectItem>
                        <SelectItem value="SA-387-11-2">SA-387 Gr 11 Cl 2</SelectItem>
                        <SelectItem value="SA-387-22-1">SA-387 Gr 22 Cl 1</SelectItem>
                        <SelectItem value="SA-387-22-2">SA-387 Gr 22 Cl 2</SelectItem>
                        <SelectItem value="SA-204-A">SA-204 Gr A</SelectItem>
                        <SelectItem value="SA-204-B">SA-204 Gr B</SelectItem>
                        <SelectItem value="SA-204-C">SA-204 Gr C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellTemp">Temp (°F)</Label>
                    <Input
                      id="shellTemp"
                      type="number"
                      step="1"
                      value={shellTemp}
                      onChange={(e) => setShellTemp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellMAWP">MAWP (psi)</Label>
                    <Input
                      id="shellMAWP"
                      type="number"
                      step="0.1"
                      value={shellMAWP}
                      onChange={(e) => setShellMAWP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellSH">SH (ft)</Label>
                    <Input
                      id="shellSH"
                      type="number"
                      step="0.1"
                      value={shellSH}
                      onChange={(e) => setShellSH(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellSG">SG</Label>
                    <Input
                      id="shellSG"
                      type="number"
                      step="0.01"
                      value={shellSG}
                      onChange={(e) => setShellSG(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellD">D (inch)</Label>
                    <Input
                      id="shellD"
                      type="number"
                      step="0.001"
                      value={shellD}
                      onChange={(e) => setShellD(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellTnom">t nom (inch)</Label>
                    <Input
                      id="shellTnom"
                      type="number"
                      step="0.001"
                      value={shellTnom}
                      onChange={(e) => setShellTnom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellS">S (psi)</Label>
                    <Input
                      id="shellS"
                      type="number"
                      step="1"
                      value={shellS}
                      onChange={(e) => setShellS(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shellE">E</Label>
                    <Select value={shellE} onValueChange={setShellE}>
                      <SelectTrigger id="shellE">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.0">1.0 (Full RT)</SelectItem>
                        <SelectItem value="0.85">0.85 (Spot RT)</SelectItem>
                        <SelectItem value="0.70">0.70 (No RT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SHELL CODE CLAUSE REFERENCE */}
            <CodeClausePanel calculationType="shell_tmin" mode="panel" className="mb-2" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="bg-green-50">
                  <CardTitle className="flex items-center gap-2">
                    Minimum Thickness Calculations
                    <CodeClauseBadge calculationType="shell_tmin" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Formula: PR/(SE-0.6P) = t</p>
                      <div className="grid grid-cols-5 gap-2 text-center text-sm font-medium">
                        <div>
                          <p className="text-gray-600">P</p>
                          <p>{shellMAWP}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">R</p>
                          <p>{(parseFloat(shellD) / 2).toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">S</p>
                          <p>{shellS}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">E</p>
                          <p>{shellE}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">t min</p>
                          <p className="text-lg font-bold text-blue-700">{shellTmin}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center gap-2">
                    Remaining Life Calculations
                    <CodeClauseBadge calculationType="remaining_life" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="shellTprev" className="text-xs">t prev</Label>
                        <Input
                          id="shellTprev"
                          type="number"
                          step="0.001"
                          value={shellTprev}
                          onChange={(e) => setShellTprev(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="shellTact" className="text-xs">t act</Label>
                        <Input
                          id="shellTact"
                          type="number"
                          step="0.001"
                          value={shellTact}
                          onChange={(e) => setShellTact(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="shellTmin2" className="text-xs">t min</Label>
                        <Input
                          id="shellTmin2"
                          value={shellTmin}
                          readOnly
                          className="h-8 bg-gray-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="shellY" className="text-xs">y (years)</Label>
                        <Input
                          id="shellY"
                          type="number"
                          step="0.1"
                          value={shellY}
                          onChange={(e) => setShellY(e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Ca = t act - t min</span>
                        <span className="font-bold">{shellCa} inch</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Cr = t prev - t act / Y</span>
                        <span className="font-bold">{shellCr} in/year</span>
                      </div>
                      <div className="flex justify-between p-2 bg-green-100 rounded border border-green-300">
                        <span className="font-semibold">RL = Ca / Cr</span>
                        <span className="font-bold text-green-700 text-lg">{shellRL} years</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2">
                  MAWP Calculations - Next Inspection
                  <CodeClauseBadge calculationType="shell_mawp" />
                </CardTitle>
                <CardDescription>Next Inspection (Yn) = {shellNextInspection} years</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">MAP - Next Inspection</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Where t = t act - 2YnCr</span>
                        <span className="font-bold">
                          {(parseFloat(shellTact) - 2 * parseFloat(shellNextInspection) * parseFloat(shellCr)).toFixed(3)} inch
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>SEt/(R+0.6t) = P</span>
                        <span className="font-bold">{shellMAPnext} psi</span>
                      </div>
                      <div className="flex justify-between p-2 bg-purple-100 rounded border border-purple-300">
                        <span className="font-semibold">P-(SH*.433*SG) = MAWP</span>
                        <span className="font-bold text-purple-700 text-lg">{shellMAWPnext} psi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HEAD EVALUATION */}
          <TabsContent value="head" className="space-y-6">
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle>Vessel Head - Material & Design Parameters</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="headType">Head Type</Label>
                    <Select value={headType} onValueChange={setHeadType}>
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
                    <Label htmlFor="headMaterial">Material</Label>
                    <Select value={headMaterial} onValueChange={setHeadMaterial}>
                      <SelectTrigger id="headMaterial">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SA-516-70">SA-516-70</SelectItem>
                        <SelectItem value="SA-516-60">SA-516-60</SelectItem>
                        <SelectItem value="SA-515-70">SA-515-70</SelectItem>
                        <SelectItem value="SA-285-C">SA-285-C</SelectItem>
                        <SelectItem value="SA-240-304">SA-240-304</SelectItem>
                        <SelectItem value="SA-240-316">SA-240-316</SelectItem>
                        <SelectItem value="SA-240-316L">SA-240-316L</SelectItem>
                        <SelectItem value="SA-612">SA-612</SelectItem>
                        <SelectItem value="SA-387-11-1">SA-387 Gr 11 Cl 1</SelectItem>
                        <SelectItem value="SA-387-11-2">SA-387 Gr 11 Cl 2</SelectItem>
                        <SelectItem value="SA-387-22-1">SA-387 Gr 22 Cl 1</SelectItem>
                        <SelectItem value="SA-387-22-2">SA-387 Gr 22 Cl 2</SelectItem>
                        <SelectItem value="SA-204-A">SA-204 Gr A</SelectItem>
                        <SelectItem value="SA-204-B">SA-204 Gr B</SelectItem>
                        <SelectItem value="SA-204-C">SA-204 Gr C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headMAWP">MAWP (psi)</Label>
                    <Input
                      id="headMAWP"
                      type="number"
                      step="0.1"
                      value={headMAWP}
                      onChange={(e) => setHeadMAWP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headD">D (inch)</Label>
                    <Input
                      id="headD"
                      type="number"
                      step="0.001"
                      value={headD}
                      onChange={(e) => setHeadD(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headT">T (°F)</Label>
                    <Input
                      id="headT"
                      type="number"
                      step="1"
                      value={headT}
                      onChange={(e) => setHeadT(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headE">E</Label>
                    <Select value={headE} onValueChange={setHeadE}>
                      <SelectTrigger id="headE">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.0">1.0 (Full RT)</SelectItem>
                        <SelectItem value="0.85">0.85 (Spot RT)</SelectItem>
                        <SelectItem value="0.70">0.70 (No RT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headSG1">SG1</Label>
                    <Input
                      id="headSG1"
                      type="number"
                      step="0.01"
                      value={headSG1}
                      onChange={(e) => setHeadSG1(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headSG2">SG2</Label>
                    <Input
                      id="headSG2"
                      type="number"
                      step="0.01"
                      value={headSG2}
                      onChange={(e) => setHeadSG2(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headTnom">t nom (inch)</Label>
                    <Input
                      id="headTnom"
                      type="number"
                      step="0.001"
                      value={headTnom}
                      onChange={(e) => setHeadTnom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headS">S (psi)</Label>
                    <Input
                      id="headS"
                      type="number"
                      step="1"
                      value={headS}
                      onChange={(e) => setHeadS(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headSH">SH (ft)</Label>
                    <Input
                      id="headSH"
                      type="number"
                      step="0.1"
                      value={headSH}
                      onChange={(e) => setHeadSH(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headP">P (psi)</Label>
                    <Input
                      id="headP"
                      type="number"
                      step="0.1"
                      value={headP}
                      onChange={(e) => setHeadP(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* HEAD CODE CLAUSE REFERENCE */}
            <CodeClausePanel calculationType="head_tmin" headType={headType} mode="panel" className="mb-2" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="bg-green-50">
                  <CardTitle className="flex items-center gap-2">
                    Minimum Thickness Calculations
                    <CodeClauseBadge calculationType="head_tmin" headType={headType} />
                  </CardTitle>
                  <CardDescription>
                    {headType === "hemispherical" && "Formula: PL/(2SE-0.2P) = t min"}
                    {headType === "ellipsoidal" && "Formula: PD/(2SE-0.2P) = t min"}
                    {headType === "torispherical" && "Formula: PLM/(2SE-0.2P) = t min"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <div className="grid grid-cols-4 gap-2 text-center text-sm font-medium">
                        <div>
                          <p className="text-gray-600">P</p>
                          <p>{headP}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">D/L</p>
                          <p>{headD}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">S</p>
                          <p>{headS}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">E</p>
                          <p>{headE}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">t min</p>
                        <p className="text-2xl font-bold text-blue-700">{headTmin} inch</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center gap-2">
                    Remaining Life Calculations
                    <CodeClauseBadge calculationType="remaining_life" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="headTprev" className="text-xs">t prev</Label>
                        <Input
                          id="headTprev"
                          type="number"
                          step="0.001"
                          value={headTprev}
                          onChange={(e) => setHeadTprev(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="headTact" className="text-xs">t act</Label>
                        <Input
                          id="headTact"
                          type="number"
                          step="0.001"
                          value={headTact}
                          onChange={(e) => setHeadTact(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="headTmin2" className="text-xs">t min</Label>
                        <Input
                          id="headTmin2"
                          value={headTmin}
                          readOnly
                          className="h-8 bg-gray-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="headY" className="text-xs">y (years)</Label>
                        <Input
                          id="headY"
                          type="number"
                          step="0.1"
                          value={headY}
                          onChange={(e) => setHeadY(e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Ca = t act - t min</span>
                        <span className="font-bold">{headCa} inch</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Cr = t prev - t act / Y</span>
                        <span className="font-bold">{headCr} in/year</span>
                      </div>
                      <div className="flex justify-between p-2 bg-green-100 rounded border border-green-300">
                        <span className="font-semibold">RL = Ca / Cr</span>
                        <span className="font-bold text-green-700 text-lg">{headRL} years</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2">
                  MAWP Calculations
                  <CodeClauseBadge calculationType="head_mawp" headType={headType} />
                </CardTitle>
                <CardDescription>
                  {headType === "hemispherical" && "Formula: 2SEt/(R+0.2t) = P"}
                  {headType === "ellipsoidal" && "Formula: 2SEt/(D+0.2t) = P"}
                  {headType === "torispherical" && "Formula: 2SEt/(LM+0.2t) = P"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">MAP - Current</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Where t = t act</span>
                        <span className="font-bold">{headTact} inch</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>P = MAP</span>
                        <span className="font-bold">{headMAPnext} psi</span>
                      </div>
                      <div className="flex justify-between p-2 bg-purple-100 rounded border border-purple-300">
                        <span className="font-semibold">MAWP = P-(SH*.433*SG)</span>
                        <span className="font-bold text-purple-700 text-lg">{headMAWPnext} psi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONICAL SECTION EVALUATION (Specialty/Advanced) */}
          <TabsContent value="conical" className="space-y-6">
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Specialty Calculation — ASME VIII-1 UG-32(g) Reducer Cones</AlertTitle>
              <AlertDescription className="text-amber-700">
                This section applies to <strong>conical reducer sections</strong> in ASME Section VIII Division 1 pressure vessels (e.g., transition cones between different shell diameters). Conical roofs and bottoms on atmospheric storage tanks are governed by <strong>API 620</strong>, not API 510/ASME VIII. Use this calculator only for pressure vessel reducer cones with half-apex angle α ≤ 30°. For α &gt; 30°, Appendix 1-5(g) special analysis is required.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader className="bg-amber-50">
                <CardTitle>Conical Section — Material & Geometry Parameters</CardTitle>
                <CardDescription>ASME VIII-1 UG-32(g): t = PD / (2cos(α)(SE - 0.6P))</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conicalMaterial">Material</Label>
                    <Select value={conicalMaterial} onValueChange={setConicalMaterial}>
                      <SelectTrigger id="conicalMaterial">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SA-516-70">SA-516-70</SelectItem>
                        <SelectItem value="SA-516-60">SA-516-60</SelectItem>
                        <SelectItem value="SA-515-70">SA-515-70</SelectItem>
                        <SelectItem value="SA-285-C">SA-285-C</SelectItem>
                        <SelectItem value="SA-240-304">SA-240-304</SelectItem>
                        <SelectItem value="SA-240-316">SA-240-316</SelectItem>
                        <SelectItem value="SA-240-316L">SA-240-316L</SelectItem>
                        <SelectItem value="SA-612">SA-612</SelectItem>
                        <SelectItem value="SA-387-11-1">SA-387 Gr 11 Cl 1</SelectItem>
                        <SelectItem value="SA-387-11-2">SA-387 Gr 11 Cl 2</SelectItem>
                        <SelectItem value="SA-387-22-1">SA-387 Gr 22 Cl 1</SelectItem>
                        <SelectItem value="SA-387-22-2">SA-387 Gr 22 Cl 2</SelectItem>
                        <SelectItem value="SA-204-A">SA-204 Gr A</SelectItem>
                        <SelectItem value="SA-204-B">SA-204 Gr B</SelectItem>
                        <SelectItem value="SA-204-C">SA-204 Gr C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalD">D — Large End ID (inch)</Label>
                    <Input
                      id="conicalD"
                      type="number"
                      step="0.001"
                      value={conicalD}
                      onChange={(e) => setConicalD(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalAlpha" className={conicalAlphaWarning ? "text-red-600 font-bold" : ""}>
                      α — Half-Apex Angle (°) {conicalAlphaWarning && " ⚠️ EXCEEDS 30°"}
                    </Label>
                    <Input
                      id="conicalAlpha"
                      type="number"
                      step="0.5"
                      min="0"
                      max="90"
                      value={conicalAlpha}
                      onChange={(e) => setConicalAlpha(e.target.value)}
                      className={conicalAlphaWarning ? "border-red-500 bg-red-50" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalP">P — Design Pressure (psi)</Label>
                    <Input
                      id="conicalP"
                      type="number"
                      step="0.1"
                      value={conicalP}
                      onChange={(e) => setConicalP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalS">S — Allowable Stress (psi)</Label>
                    <Input
                      id="conicalS"
                      type="number"
                      step="1"
                      value={conicalS}
                      onChange={(e) => setConicalS(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalE">E — Joint Efficiency</Label>
                    <Select value={conicalE} onValueChange={setConicalE}>
                      <SelectTrigger id="conicalE">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.0">1.0 (Full RT)</SelectItem>
                        <SelectItem value="0.85">0.85 (Spot RT)</SelectItem>
                        <SelectItem value="0.70">0.70 (No RT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conicalTnom">t nom (inch)</Label>
                    <Input
                      id="conicalTnom"
                      type="number"
                      step="0.001"
                      value={conicalTnom}
                      onChange={(e) => setConicalTnom(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {conicalAlphaWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>UG-32(g) Limit Exceeded</AlertTitle>
                <AlertDescription>
                  Half-apex angle α = {conicalAlpha}° exceeds the 30° limit of UG-32(g). This formula is <strong>NOT valid</strong> for α &gt; 30°. Use ASME VIII-1 Appendix 1-5(g) for conical sections with large half-apex angles. Results shown below are for reference only and must not be used for compliance.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="bg-green-50">
                  <CardTitle className="flex items-center gap-2">
                    Minimum Thickness — Conical Section
                  </CardTitle>
                  <CardDescription>
                    Formula: t = PD / (2cos(α)(SE - 0.6P)) per UG-32(g)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <div className="grid grid-cols-5 gap-2 text-center text-sm font-medium">
                        <div>
                          <p className="text-gray-600">P</p>
                          <p>{conicalP}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">D</p>
                          <p>{conicalD}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">α</p>
                          <p>{conicalAlpha}°</p>
                        </div>
                        <div>
                          <p className="text-gray-600">S</p>
                          <p>{conicalS}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">E</p>
                          <p>{conicalE}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">t min</p>
                        <p className={`text-2xl font-bold ${conicalAlphaWarning ? 'text-red-600' : 'text-blue-700'}`}>{conicalTmin} inch</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center gap-2">
                    Remaining Life — Conical Section
                    <CodeClauseBadge calculationType="remaining_life" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="conicalTprev" className="text-xs">t prev</Label>
                        <Input
                          id="conicalTprev"
                          type="number"
                          step="0.001"
                          value={conicalTprev}
                          onChange={(e) => setConicalTprev(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="conicalTact" className="text-xs">t act</Label>
                        <Input
                          id="conicalTact"
                          type="number"
                          step="0.001"
                          value={conicalTact}
                          onChange={(e) => setConicalTact(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="conicalTmin2" className="text-xs">t min</Label>
                        <Input
                          id="conicalTmin2"
                          value={conicalTmin}
                          readOnly
                          className="h-8 bg-gray-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="conicalY" className="text-xs">y (years)</Label>
                        <Input
                          id="conicalY"
                          type="number"
                          step="0.1"
                          value={conicalY}
                          onChange={(e) => setConicalY(e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Ca = t act - t min</span>
                        <span className="font-bold">{conicalCa} inch</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Cr = t prev - t act / Y</span>
                        <span className="font-bold">{conicalCr} in/year</span>
                      </div>
                      <div className="flex justify-between p-2 bg-green-100 rounded border border-green-300">
                        <span className="font-semibold">RL = Ca / Cr</span>
                        <span className="font-bold text-green-700 text-lg">{conicalRL} years</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle>MAWP — Conical Section</CardTitle>
                <CardDescription>
                  Formula: MAWP = 2SEt·cos(α) / (D + 1.2t·cos(α)) per UG-32(g)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">MAP at Current Thickness</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Where t = t act</span>
                        <span className="font-bold">{conicalTact} inch</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>2SEt·cos(α)/(D+1.2t·cos(α)) = MAP</span>
                        <span className="font-bold">{conicalMAPnext} psi</span>
                      </div>
                      <div className="flex justify-between p-2 bg-purple-100 rounded border border-purple-300">
                        <span className="font-semibold">MAWP</span>
                        <span className={`font-bold text-lg ${conicalAlphaWarning ? 'text-red-600' : 'text-purple-700'}`}>{conicalMAWPnext} psi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-gray-50">
                <CardTitle>Conical Section — Code Reference</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <p className="font-semibold">ASME VIII-1 UG-32(g) — Conical Heads and Sections</p>
                    <p className="text-gray-700 mt-1">The required thickness of a conical head or conical shell section under internal pressure shall not be less than that determined by the formula: t = PD / (2cos(α)(SE - 0.6P)), where α is the half-apex angle of the cone.</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <p className="font-semibold">Applicability Limitation</p>
                    <p className="text-gray-700 mt-1">This formula applies only when α ≤ 30°. For half-apex angles exceeding 30°, the rules of Appendix 1-5(g) shall be used, which require additional reinforcement analysis at the cone-to-cylinder junction.</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="font-semibold">API 620 vs. API 510 Context</p>
                    <p className="text-gray-700 mt-1">Conical roofs and bottoms on large, welded, low-pressure storage tanks are governed by <strong>API 620</strong>, not ASME Section VIII / API 510. This calculator addresses only ASME VIII-1 reducer cones (transition sections between different shell diameters) that may be encountered in API 510 inspections.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VARIABLE DEFINITIONS */}
          <TabsContent value="definitions">
            <Card>
              <CardHeader className="bg-gray-50">
                <CardTitle>Variable Definitions for Shell & Head Calculations</CardTitle>
                <CardDescription>ASME Section VIII Division 1 - API 510</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">Ca</p>
                    <p className="text-gray-700">Remaining corrosion allowance of the vessel part under consideration, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">Cr</p>
                    <p className="text-gray-700">Corrosion rate of the vessel part under consideration, in inches per year.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">D</p>
                    <p className="text-gray-700">Inside diameter of the shell course under consideration, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">E</p>
                    <p className="text-gray-700">(Internal Calculations) Lowest efficiency of any joint in the shell course under consideration. For welded vessels, use the efficiency specified in UW-12.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">L</p>
                    <p className="text-gray-700">Crown radius for torispherical heads, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">M</p>
                    <p className="text-gray-700">Factor for torispherical heads (typically 1.54 for F&D heads).</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">P</p>
                    <p className="text-gray-700">Design maximum allowable internal working pressure, including static head pressure, in psi.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">R</p>
                    <p className="text-gray-700">Inside radius of the shell under consideration, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">RL</p>
                    <p className="text-gray-700">Estimated remaining life of the vessel part under consideration, in years.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">S</p>
                    <p className="text-gray-700">Maximum allowable stress value, in psi.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">SH</p>
                    <p className="text-gray-700">Static head, in feet.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">SG</p>
                    <p className="text-gray-700">Specific gravity of vessel product.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">t</p>
                    <p className="text-gray-700">Thickness of the vessel part under consideration, variable related to applicable calculation used therein, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">t act</p>
                    <p className="text-gray-700">Actual thickness measurement of the vessel part under consideration, as recorded at the time of inspection, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">t min</p>
                    <p className="text-gray-700">Minimum required thickness of vessel part under consideration, as the nominal thickness minus the design corrosion allowance or the calculated minimum required thickness at the design MAWP at the coinciding working temperature, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">t nom</p>
                    <p className="text-gray-700">Design nominal thickness of head, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">t prev</p>
                    <p className="text-gray-700">Previous thickness measurement of the vessel part under consideration, as recorded at last inspection or nominal thickness if no previous thickness measurements, in inches.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">Y</p>
                    <p className="text-gray-700">Time span between thickness readings or age of the vessel if t nom is used for t prev, in years.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">Yn</p>
                    <p className="text-gray-700">Estimated time span to next inspection of the vessel part under consideration, in years.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Export to PDF
          </Button>
          <Button onClick={() => toast.success("Worksheet saved!")}>
            <Save className="mr-2 h-4 w-4" />
            Save Worksheet
          </Button>
        </div>
      </div>
    </div>
  );
}

