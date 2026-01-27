import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Upload, Save, AlertTriangle, CheckCircle2, Database, Edit3, CheckSquare, Square } from "lucide-react";
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
  
  // Bulk edit state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<keyof AngleDataRow>("angle0");
  const [bulkEditValue, setBulkEditValue] = useState("");

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
    setSelectedRows(new Set()); // Clear selection when new data is loaded
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
    // Also remove from selection
    const newSelected = new Set(selectedRows);
    newSelected.delete(index);
    // Adjust indices for rows after the removed one
    const adjusted = new Set<number>();
    newSelected.forEach(i => {
      if (i > index) {
        adjusted.add(i - 1);
      } else {
        adjusted.add(i);
      }
    });
    setSelectedRows(adjusted);
  };

  // Toggle row selection
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  // Select all rows
  const selectAllRows = () => {
    const allIndices = new Set(angleData.map((_, i) => i));
    setSelectedRows(allIndices);
  };

  // Deselect all rows
  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  // Apply bulk edit
  const applyBulkEdit = () => {
    if (selectedRows.size === 0) {
      toast.error("No rows selected");
      return;
    }

    const newData = [...angleData];
    selectedRows.forEach(index => {
      newData[index] = { ...newData[index], [bulkEditField]: bulkEditValue };
    });
    setAngleData(newData);
    setBulkEditOpen(false);
    setBulkEditValue("");
    toast.success(`Updated ${selectedRows.size} rows`);
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

    // Helper function to extract numeric value from CML number for sorting
    // Handles formats like: "1", "10", "1-45", "N1", "N1-90", "2'", "2' East Head"
    const extractNumericValue = (cmlNumber: string): number => {
      if (!cmlNumber) return Infinity;
      // Remove common prefixes like N, CML, TML
      const cleaned = cmlNumber.replace(/^(N|CML|TML|cml|tml|n)/i, '');
      // Extract the first number (including decimals)
      const match = cleaned.match(/^([\d.]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
      // If no number found, return Infinity to sort to end
      return Infinity;
    };

    // Extract secondary sort value (angle portion like -45, -90, etc.)
    const extractAngleValue = (cmlNumber: string): number => {
      const match = cmlNumber.match(/-(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 0;
    };

    const rows: AngleDataRow[] = tmlReadings
      .map((tml: any) => {
        // Use tml1-4 if available, otherwise fall back to currentThickness or tActual
        // This handles data imported from PDFs where readings are stored in currentThickness
        const hasAngleData = tml.tml1 || tml.tml2 || tml.tml3 || tml.tml4;
        const fallbackThickness = tml.currentThickness || tml.tActual || "";
        
        return {
          cmlNumber: tml.cmlNumber || "",
          // If angle-specific data exists, use it; otherwise use fallback for angle0 only
          angle0: tml.tml1?.toString() || (hasAngleData ? "" : fallbackThickness?.toString() || ""),
          angle90: tml.tml2?.toString() || "",
          angle180: tml.tml3?.toString() || "",
          angle270: tml.tml4?.toString() || "",
          tPrevious: tml.previousThickness?.toString() || "",
        };
      })
      // Sort by numeric value first, then by angle value
      .sort((a, b) => {
        const numA = extractNumericValue(a.cmlNumber);
        const numB = extractNumericValue(b.cmlNumber);
        if (numA !== numB) return numA - numB;
        // If same base number, sort by angle
        const angleA = extractAngleValue(a.cmlNumber);
        const angleB = extractAngleValue(b.cmlNumber);
        return angleA - angleB;
      });

    setAngleData(rows);
    setSelectedRows(new Set()); // Clear selection when new data is loaded
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

  // Field options for bulk edit
  const fieldOptions = [
    { value: "angle0", label: "0°" },
    { value: "angle90", label: "90°" },
    { value: "angle180", label: "180°" },
    { value: "angle270", label: "270°" },
    { value: "tPrevious", label: "T-Previous" },
  ];

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

          {/* Bulk Edit Controls */}
          {angleData.length > 0 && (
            <div className="flex gap-2 mb-4 items-center flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllRows}
                className="gap-1"
              >
                <CheckSquare className="h-4 w-4" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllRows}
                className="gap-1"
              >
                <Square className="h-4 w-4" />
                Deselect All
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setBulkEditOpen(true)}
                disabled={selectedRows.size === 0}
                className="gap-1"
              >
                <Edit3 className="h-4 w-4" />
                Bulk Edit ({selectedRows.size} selected)
              </Button>
            </div>
          )}

          {/* Data Table */}
          {angleData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRows.size === angleData.length && angleData.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllRows();
                          } else {
                            deselectAllRows();
                          }
                        }}
                      />
                    </TableHead>
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
                    <TableRow 
                      key={index}
                      className={selectedRows.has(index) ? "bg-blue-50 dark:bg-blue-950" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(index)}
                          onCheckedChange={() => toggleRowSelection(index)}
                        />
                      </TableCell>
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
                setSelectedRows(new Set());
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

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedRows.size} CMLs</DialogTitle>
            <DialogDescription>
              Apply the same value to all selected rows. This will overwrite existing values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Field to Update</Label>
              <Select value={bulkEditField} onValueChange={(v) => setBulkEditField(v as keyof AngleDataRow)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Value</Label>
              <Input
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(e.target.value)}
                placeholder="Enter value (e.g., 0.500)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyBulkEdit}>
              Apply to {selectedRows.size} Rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
