import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Save, Download, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import { calculateShellMinimumThickness, calculateHeadMinimumThickness, formatThickness, getThicknessStatus } from "@/lib/thicknessCalculations";
import { sortByCmlNumber } from "@/lib/cmlSort";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ThicknessAnalysisTabProps {
  inspectionId: string;
}

export default function ThicknessAnalysisTab({ inspectionId }: ThicknessAnalysisTabProps) {
  const { data: readings, isLoading } = trpc.tmlReadings.list.useQuery({ inspectionId });
  const createMutation = trpc.tmlReadings.create.useMutation();
  const deleteMutation = trpc.tmlReadings.delete.useMutation();
  const utils = trpc.useUtils();

  const { data: inspection } = trpc.inspections.get.useQuery({ id: inspectionId });
  
  // Fetch material allowable stress if material and temperature are available
  const materialSpec = inspection?.materialSpec;
  const designTemperature = inspection?.designTemperature ? parseFloat(String(inspection.designTemperature)) : undefined;
  const { data: materialStressData } = trpc.materialStress.getMaterialStressValue.useQuery(
    { 
      materialSpec: materialSpec || '', 
      temperatureF: designTemperature || 0 
    },
    { 
      enabled: !!materialSpec && designTemperature !== undefined 
    }
  );
  
  const [newReading, setNewReading] = useState({
    tmlId: "",
    component: "",
    currentThickness: "",
    previousThickness: "",
    nominalThickness: "",
  });
  
  // Calculate minimum required thickness based on component type
  const calculateMinThickness = () => {
    if (!inspection || !newReading.component) return null;
    
    const P = parseFloat(inspection.designPressure || "0");
    const R = inspection.insideDiameter ? parseFloat(inspection.insideDiameter) / 2 : 0;
    // Use actual allowable stress from material database or inspection, fallback to 15000
    const S = materialStressData?.allowableStress || 
              (inspection.allowableStress ? parseFloat(String(inspection.allowableStress)) : 15000);
    // Use actual joint efficiency from inspection, fallback to 0.85
    const E = inspection.jointEfficiency ? parseFloat(String(inspection.jointEfficiency)) : 0.85;
    
    if (!P || !R) return null;
    
    if (newReading.component === "Shell") {
      return calculateShellMinimumThickness({ designPressure: P, insideRadius: R, allowableStress: S, jointEfficiency: E });
    } else if (newReading.component === "Head") {
      return calculateHeadMinimumThickness({ designPressure: P, insideRadius: R, allowableStress: S, jointEfficiency: E, headType: 'ellipsoidal' });
    }
    
    return null;
  };
  
  const minRequiredThickness = calculateMinThickness();
  const currentThicknessNum = parseFloat(newReading.currentThickness);
  const thicknessStatus = minRequiredThickness && currentThicknessNum ? getThicknessStatus(currentThicknessNum, minRequiredThickness) : null;

  const handleAddReading = async () => {
    if (!newReading.tmlId || !newReading.component) {
      toast.error("TML ID and Component are required");
      return;
    }

    try {
      // Calculate loss and corrosion rate
      const current = parseFloat(newReading.currentThickness) || 0;
      const previous = parseFloat(newReading.previousThickness) || 0;
      const nominal = parseFloat(newReading.nominalThickness) || 0;

      let loss = "0";
      let corrosionRate = "0";
      let status: "good" | "monitor" | "critical" = "good";

      if (nominal && current) {
        loss = ((nominal - current) / nominal * 100).toFixed(2);
        
        if (parseFloat(loss) > 20) {
          status = "critical";
        } else if (parseFloat(loss) > 10) {
          status = "monitor";
        }
      }

      if (previous && current) {
        // Note: Server will calculate actual corrosion rate based on inspection dates
        // This is just a preliminary calculation for display (mils per year assuming 1 year)
        const thicknessLossMils = (previous - current) * 1000;
        corrosionRate = thicknessLossMils.toFixed(2);
      }

      await createMutation.mutateAsync({
        inspectionId,
        cmlNumber: newReading.tmlId || "CML-001",
        componentType: newReading.component || "Shell",
        location: newReading.tmlId || "Unknown",
        tmlId: newReading.tmlId,
        component: newReading.component,
        currentThickness: newReading.currentThickness || undefined,
        previousThickness: newReading.previousThickness || undefined,
        nominalThickness: newReading.nominalThickness || undefined,
        loss,
        corrosionRate,
        status,
      });

      utils.tmlReadings.list.invalidate({ inspectionId });
      setNewReading({
        tmlId: "",
        component: "",
        currentThickness: "",
        previousThickness: "",
        nominalThickness: "",
      });
      toast.success("TML reading added");
    } catch (error) {
      toast.error("Failed to add reading");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this reading?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        utils.tmlReadings.list.invalidate({ inspectionId });
        toast.success("Reading deleted");
      } catch (error) {
        toast.error("Failed to delete reading");
      }
    }
  };

  const handleExportTemplate = () => {
    const headers = [
      "TML ID",
      "Component (Shell/Head/Nozzle/Flange/Support)",
      "Nominal Thickness (in)",
      "Previous Thickness (in)",
      "Current Thickness (in)"
    ];

    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tml-readings-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file. Click 'Export Template' to get the correct format.");
      e.target.value = "";
      return;
    }

    toast.info("Importing TML readings...");

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("File is empty or invalid");
        return;
      }

      const dataLines = lines.slice(1);
      let successCount = 0;

      for (const line of dataLines) {
        const values = line.split(",");
        const tmlData = {
          tmlId: values[0]?.trim() || "",
          component: values[1]?.trim() || "",
          nominalThickness: values[2]?.trim() || "",
          previousThickness: values[3]?.trim() || "",
          currentThickness: values[4]?.trim() || "",
        };

        if (tmlData.tmlId && tmlData.component) {
          // Calculate loss and corrosion rate
          const current = parseFloat(tmlData.currentThickness) || 0;
          const previous = parseFloat(tmlData.previousThickness) || 0;
          const nominal = parseFloat(tmlData.nominalThickness) || 0;

          let loss = "0";
          let corrosionRate = "0";
          let status: "good" | "monitor" | "critical" = "good";

          if (nominal && current) {
            loss = ((nominal - current) / nominal * 100).toFixed(2);
            
            if (parseFloat(loss) > 20) {
              status = "critical";
            } else if (parseFloat(loss) > 10) {
              status = "monitor";
            }
          }

          if (previous && current) {
            corrosionRate = (((previous - current) * 1000) / 5).toFixed(2);
          }

          await createMutation.mutateAsync({
            inspectionId,
            cmlNumber: tmlData.tmlId || "CML-001",
            componentType: tmlData.component || "Shell",
            location: tmlData.tmlId || "Unknown",
            tmlId: tmlData.tmlId,
            component: tmlData.component,
            currentThickness: tmlData.currentThickness || undefined,
            previousThickness: tmlData.previousThickness || undefined,
            nominalThickness: tmlData.nominalThickness || undefined,
            loss,
            corrosionRate,
            status,
          });
          successCount++;
        }
      }

      toast.success(`Imported ${successCount} TML readings`);
      utils.tmlReadings.list.invalidate();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import file");
    }

    e.target.value = "";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "good":
        return <Badge className="bg-green-100 text-green-800">Good</Badge>;
      case "monitor":
        return <Badge className="bg-yellow-100 text-yellow-800">Monitor</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thickness Measurement Locations (TML)</CardTitle>
          <CardDescription>Track thickness readings across vessel components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="space-y-2">
              <Label>TML ID</Label>
              <Input
                placeholder="e.g., TML-001"
                value={newReading.tmlId}
                onChange={(e) => setNewReading({ ...newReading, tmlId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Component</Label>
              <Select
                value={newReading.component}
                onValueChange={(value) => setNewReading({ ...newReading, component: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shell">Shell</SelectItem>
                  <SelectItem value="Head">Head</SelectItem>
                  <SelectItem value="Nozzle">Nozzle</SelectItem>
                  <SelectItem value="Flange">Flange</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nominal (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.3750"
                value={newReading.nominalThickness}
                onChange={(e) => setNewReading({ ...newReading, nominalThickness: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Previous (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.3600"
                value={newReading.previousThickness}
                onChange={(e) => setNewReading({ ...newReading, previousThickness: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Current (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.3500"
                value={newReading.currentThickness}
                onChange={(e) => setNewReading({ ...newReading, currentThickness: e.target.value })}
                className={thicknessStatus ? `border-${thicknessStatus.color}-500` : ""}
              />
              {minRequiredThickness && (
                <div className="flex items-center gap-2 text-xs mt-1">
                  <Info className="h-3 w-3 text-blue-500" />
                  <span className="text-gray-600">
                    Min Required: <span className="font-semibold">{formatThickness(minRequiredThickness)}</span>
                  </span>
                  {thicknessStatus && (
                    <Badge variant="outline" className={`bg-${thicknessStatus.color}-50 text-${thicknessStatus.color}-700 border-${thicknessStatus.color}-200`}>
                      {thicknessStatus.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExportTemplate} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Template
            </Button>
            <Button onClick={() => document.getElementById('tml-import-input')?.click()} variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <input
              id="tml-import-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button onClick={handleAddReading} disabled={createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Add Reading
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TML Readings Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading readings...</p>
            </div>
          ) : readings && readings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TML ID</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Loss %</TableHead>
                    <TableHead>Corr. Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortByCmlNumber(readings.map(r => ({ ...r, cmlNumber: r.cmlNumber || r.tmlId }))).map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell className="font-medium">{reading.tmlId}</TableCell>
                      <TableCell>{reading.component}</TableCell>
                      <TableCell>{reading.nominalThickness || "-"}</TableCell>
                      <TableCell>{reading.previousThickness || "-"}</TableCell>
                      <TableCell>{reading.currentThickness || "-"}</TableCell>
                      <TableCell>{reading.loss ? `${reading.loss}%` : "-"}</TableCell>
                      <TableCell>{reading.corrosionRate ? `${reading.corrosionRate} mpy` : "-"}</TableCell>
                      <TableCell>{getStatusBadge(reading.status || "good")}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(reading.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              <p>No thickness readings recorded yet</p>
              <p className="text-sm mt-2">Add your first TML reading above</p>
            </div>
          )}
        </CardContent>
      </Card>

      {readings && readings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Good Condition</p>
                <p className="text-2xl font-bold text-green-700">
                  {readings.filter((r) => r.status === "good").length}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-600 mb-1">Monitor</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {readings.filter((r) => r.status === "monitor").length}
                </p>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-gray-600 mb-1">Critical</p>
                <p className="text-2xl font-bold text-red-700">
                  {readings.filter((r) => r.status === "critical").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

