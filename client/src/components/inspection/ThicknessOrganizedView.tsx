import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers, Filter, BarChart3 } from "lucide-react";
import { sortByCmlNumber } from "@/lib/cmlSort";

interface TMLReading {
  id: string;
  cmlNumber?: string | null;
  tmlId?: string | null;
  location?: string | null;
  component?: string | null;
  componentType?: string | null;
  readingType?: string | null;
  nozzleSize?: string | null;
  angle?: string | null;
  nominalThickness?: string | null;
  previousThickness?: string | null;
  currentThickness?: string | null;
  minimumRequired?: string | null;
  calculatedMAWP?: string | null;
  tml1?: string | null;
  tml2?: string | null;
  tml3?: string | null;
  tml4?: string | null;
}

interface ThicknessOrganizedViewProps {
  readings: TMLReading[];
}

type ComponentFilter = "all" | "Shell" | "East Head" | "West Head" | "Nozzle";

export default function ThicknessOrganizedView({ readings }: ThicknessOrganizedViewProps) {
  const [filter, setFilter] = useState<ComponentFilter>("all");

  // Normalize component type from various fields
  const getComponentType = (reading: TMLReading): string => {
    const component = reading.component || reading.componentType || reading.location || "";
    const normalized = component.toLowerCase();
    
    if (normalized.includes("east") || normalized.includes("north") || normalized.includes("head 1") || normalized.includes("left head")) {
      return "East Head";
    }
    if (normalized.includes("west") || normalized.includes("south") || normalized.includes("head 2") || normalized.includes("right head")) {
      return "West Head";
    }
    if (normalized.includes("nozzle") || normalized.includes("manway") || normalized.includes("relief") || 
        normalized.includes("inlet") || normalized.includes("outlet") || normalized.includes("drain") ||
        normalized.includes("vent") || normalized.includes("gauge")) {
      return "Nozzle";
    }
    if (normalized.includes("shell") || normalized.includes("body") || normalized.includes("cylinder")) {
      return "Shell";
    }
    // Default to Shell if unclear
    return "Shell";
  };

  // Group readings by component type
  const groupedReadings = readings.reduce((acc, reading) => {
    const type = getComponentType(reading);
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push({ ...reading, normalizedComponent: type });
    return acc;
  }, {} as Record<string, (TMLReading & { normalizedComponent: string })[]>);

  // Get counts for each component type
  const componentCounts = {
    Shell: groupedReadings["Shell"]?.length || 0,
    "East Head": groupedReadings["East Head"]?.length || 0,
    "West Head": groupedReadings["West Head"]?.length || 0,
    Nozzle: groupedReadings["Nozzle"]?.length || 0,
  };

  // Filter readings based on selection and sort by CML number
  const filteredReadings = sortByCmlNumber(
    filter === "all" 
      ? readings.map(r => ({ ...r, normalizedComponent: getComponentType(r) }))
      : (groupedReadings[filter] || [])
  );

  const getStatusColor = (current: string | null | undefined, min: string | null | undefined) => {
    if (!current || !min) return "bg-gray-100";
    const currentVal = parseFloat(current);
    const minVal = parseFloat(min);
    if (isNaN(currentVal) || isNaN(minVal)) return "bg-gray-100";
    
    const ratio = currentVal / minVal;
    if (ratio < 1.0) return "bg-red-100 text-red-800";
    if (ratio < 1.1) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const getComponentColor = (type: string) => {
    switch (type) {
      case "Shell": return "bg-blue-100 text-blue-800";
      case "East Head": return "bg-purple-100 text-purple-800";
      case "West Head": return "bg-indigo-100 text-indigo-800";
      case "Nozzle": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            <CardTitle>Thickness Readings by Component</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={filter} onValueChange={(v) => setFilter(v as ComponentFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by component" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Components ({readings.length})</SelectItem>
                <SelectItem value="Shell">Shell ({componentCounts.Shell})</SelectItem>
                <SelectItem value="East Head">East Head ({componentCounts["East Head"]})</SelectItem>
                <SelectItem value="West Head">West Head ({componentCounts["West Head"]})</SelectItem>
                <SelectItem value="Nozzle">Nozzles ({componentCounts.Nozzle})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription>
          {readings.length} total readings organized by component type
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Component Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(componentCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilter(type as ComponentFilter)}
              className={`p-4 rounded-lg border transition-all ${
                filter === type 
                  ? "ring-2 ring-blue-500 border-blue-500" 
                  : "hover:border-gray-400"
              }`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-gray-600">{type}</div>
            </button>
          ))}
        </div>

        {/* Readings Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>CML</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Min Req'd</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReadings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No readings found for this filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredReadings.map((reading, index) => (
                  <TableRow key={reading.id || index}>
                    <TableCell className="font-medium">
                      {reading.cmlNumber || reading.tmlId || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getComponentColor(reading.normalizedComponent)}>
                        {reading.normalizedComponent}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {reading.location || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {reading.readingType || reading.nozzleSize || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {reading.nominalThickness || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {reading.previousThickness || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {reading.currentThickness || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {reading.minimumRequired || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getStatusColor(reading.currentThickness, reading.minimumRequired)}>
                        {reading.currentThickness && reading.minimumRequired
                          ? parseFloat(reading.currentThickness) >= parseFloat(reading.minimumRequired)
                            ? "OK"
                            : "Below Min"
                          : "-"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
