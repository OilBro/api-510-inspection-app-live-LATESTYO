import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Save, AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

interface AngleDataRow {
  cmlNumber: string;
  angle0: string;
  angle90: string;
  angle180: string;
  angle270: string;
  tPrevious: string;
}

export default function DataMigration() {
  const [selectedInspection, setSelectedInspection] = useState<string>("");
  const [angleData, setAngleData] = useState<AngleDataRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [csvContent, setCsvContent] = useState("");

  // Get list of inspections
  const { data: inspections, isLoading: loadingInspections } = trpc.inspections.list.useQuery();
  
  // Get TML readings for selected inspection
  const { data: tmlReadings, refetch: refetchTml } = trpc.tmlReadings.list.useQuery(
    { inspectionId: selectedInspection },
    { enabled: !!selectedInspection }
  );

  // Mutation to update TML readings with angle data
  const updateTmlMutation = trpc.tmlReadings.updateBatch.useMutation({
    onSuccess: () => {
      toast.success("Angle data updated successfully!");
      refetchTml();
    },
    onError: (error: { message: string }) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Parse CSV content into angle data rows
  const parseCSV = (content: string) => {
    const lines = content.trim().split("\n");
    const rows: AngleDataRow[] = [];
    
    // Skip header row if present
    const startIndex = lines[0]?.toLowerCase().includes("cml") ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split(",").map(c => c.trim());
      if (cells.length >= 2) {
        rows.push({
          cmlNumber: cells[0] || "",
          angle0: cells[1] || "",
          angle90: cells[2] || "",
          angle180: cells[3] || "",
          angle270: cells[4] || "",
          tPrevious: cells[5] || "",
        });
      }
    }
    
    setAngleData(rows);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  // Update a single row value
  const updateRow = (index: number, field: keyof AngleDataRow, value: string) => {
    const newData = [...angleData];
    newData[index] = { ...newData[index], [field]: value };
    setAngleData(newData);
  };

  // Add a new empty row
  const addRow = () => {
    setAngleData([
      ...angleData,
      { cmlNumber: "", angle0: "", angle90: "", angle180: "", angle270: "", tPrevious: "" },
    ]);
  };

  // Remove a row
  const removeRow = (index: number) => {
    setAngleData(angleData.filter((_, i) => i !== index));
  };

  // Apply the angle data to TML readings
  const applyAngleData = async () => {
    if (!selectedInspection || angleData.length === 0) {
      toast.error("Please select an inspection and add angle data");
      return;
    }

    setIsLoading(true);
    try {
      // Map angle data to TML reading updates
      const updates = angleData
        .filter(row => row.cmlNumber)
        .map(row => ({
          cmlNumber: row.cmlNumber,
          tml1: row.angle0 ? parseFloat(row.angle0) : undefined,
          tml2: row.angle90 ? parseFloat(row.angle90) : undefined,
          tml3: row.angle180 ? parseFloat(row.angle180) : undefined,
          tml4: row.angle270 ? parseFloat(row.angle270) : undefined,
          previousThickness: row.tPrevious ? parseFloat(row.tPrevious) : undefined,
        }));

      await updateTmlMutation.mutateAsync({
        inspectionId: selectedInspection,
        updates,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-populate from existing TML readings
  const loadExistingData = () => {
    if (!tmlReadings || tmlReadings.length === 0) {
      toast.info("No TML readings found for this inspection");
      return;
    }

    const rows: AngleDataRow[] = tmlReadings.map((tml: any) => ({
      cmlNumber: tml.cmlNumber || "",
      angle0: tml.tml1?.toString() || "",
      angle90: tml.tml2?.toString() || "",
      angle180: tml.tml3?.toString() || "",
      angle270: tml.tml4?.toString() || "",
      tPrevious: tml.previousThickness?.toString() || "",
    }));

    setAngleData(rows);
    toast.success(`Loaded ${rows.length} TML readings`);
  };

  // Count missing data
  const getMissingDataCount = () => {
    if (!tmlReadings) return { total: 0, missingAngles: 0, missingPrevious: 0 };
    
    let missingAngles = 0;
    let missingPrevious = 0;
    
    tmlReadings.forEach((tml: any) => {
      if (!tml.tml1 && !tml.tml2 && !tml.tml3 && !tml.tml4) missingAngles++;
      if (!tml.previousThickness) missingPrevious++;
    });
    
    return { total: tmlReadings.length, missingAngles, missingPrevious };
  };

  const stats = getMissingDataCount();

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Data Migration Tool
          </h1>
          <p className="text-muted-foreground">
            Fix missing angle readings (0°, 90°, 180°, 270°) and T-previous values
          </p>
        </div>
      </div>

      {/* Step 1: Select Inspection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1: Select Inspection</CardTitle>
          <CardDescription>
            Choose the inspection record you want to update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="inspection">Inspection</Label>
              <Select value={selectedInspection} onValueChange={setSelectedInspection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an inspection..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingInspections ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    inspections?.map((insp: any) => (
                      <SelectItem key={insp.id} value={insp.id}>
                        {insp.vesselTagNumber} - {insp.vesselName || "Unnamed"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedInspection && (
              <Button variant="outline" onClick={loadExistingData}>
                Load Existing Data
              </Button>
            )}
          </div>

          {/* Data Quality Summary */}
          {selectedInspection && tmlReadings && (
            <div className="mt-4 flex gap-4">
              <Badge variant="outline" className="text-sm py-1 px-3">
                Total CMLs: {stats.total}
              </Badge>
              {stats.missingAngles > 0 && (
                <Badge variant="destructive" className="text-sm py-1 px-3">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Missing Angles: {stats.missingAngles}
                </Badge>
              )}
              {stats.missingPrevious > 0 && (
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  Missing T-Previous: {stats.missingPrevious}
                </Badge>
              )}
              {stats.missingAngles === 0 && stats.missingPrevious === 0 && (
                <Badge variant="default" className="text-sm py-1 px-3 bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All Data Complete
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Upload or Enter Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 2: Upload or Enter Angle Data</CardTitle>
          <CardDescription>
            Upload a CSV file or manually enter the angle readings. CSV format: CML Number, 0°, 90°, 180°, 270°, T-Previous
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div>
              <Label htmlFor="csvFile">Upload CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={addRow}>
                Add Row Manually
              </Button>
            </div>
          </div>

          {/* Data Table */}
          {angleData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">CML #</TableHead>
                    <TableHead className="w-24">0°</TableHead>
                    <TableHead className="w-24">90°</TableHead>
                    <TableHead className="w-24">180°</TableHead>
                    <TableHead className="w-24">270°</TableHead>
                    <TableHead className="w-24">T-Previous</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {angleData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={row.cmlNumber}
                          onChange={(e) => updateRow(index, "cmlNumber", e.target.value)}
                          placeholder="CML-1"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.angle0}
                          onChange={(e) => updateRow(index, "angle0", e.target.value)}
                          placeholder="0.500"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.angle90}
                          onChange={(e) => updateRow(index, "angle90", e.target.value)}
                          placeholder="0.500"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.angle180}
                          onChange={(e) => updateRow(index, "angle180", e.target.value)}
                          placeholder="0.500"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.angle270}
                          onChange={(e) => updateRow(index, "angle270", e.target.value)}
                          placeholder="0.500"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.tPrevious}
                          onChange={(e) => updateRow(index, "tPrevious", e.target.value)}
                          placeholder="0.520"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {angleData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Upload a CSV file or click "Add Row Manually" to enter data</p>
              <p className="text-sm mt-1">CSV format: CML Number, 0°, 90°, 180°, 270°, T-Previous</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Apply Changes */}
      <Card>
        <CardHeader>
          <CardTitle>Step 3: Apply Changes</CardTitle>
          <CardDescription>
            Review the data above and click Apply to update the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={applyAngleData}
              disabled={!selectedInspection || angleData.length === 0 || isLoading}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Applying..." : "Apply Angle Data"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAngleData([]);
                setCsvContent("");
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CSV Template Download */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>CSV Template</CardTitle>
          <CardDescription>
            Download a template CSV file to fill in your angle data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              const template = `CML Number,0°,90°,180°,270°,T-Previous
1,0.500,0.498,0.502,0.499,0.520
2,0.485,0.490,0.488,0.492,0.510
3,0.475,0.478,0.480,0.476,0.505`;
              const blob = new Blob([template], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "angle_data_template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CSV Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
