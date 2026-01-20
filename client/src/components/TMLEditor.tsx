import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Pencil, Save, X, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TMLReading {
  id: string;
  cmlNumber: string;
  componentType: string;
  location: string;
  tml1: string | null;
  tml2: string | null;
  tml3: string | null;
  tml4: string | null;
  tActual: string | null;
  nominalThickness: string | null;
  previousThickness: string | null;
  corrosionRate: string | null;
  status: "good" | "monitor" | "critical";
}

interface TMLEditorProps {
  reading: TMLReading;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Helper to format display value
function formatValue(value: string | null | undefined): string {
  if (!value || value === "") return "—";
  return value;
}

// Helper to check if values are different
function hasChanged(original: string | null | undefined, edited: string): boolean {
  const origVal = original || "";
  return origVal !== edited;
}

// Comparison row component
function ComparisonRow({ 
  label, 
  original, 
  edited, 
  unit = "" 
}: { 
  label: string; 
  original: string | null | undefined; 
  edited: string;
  unit?: string;
}) {
  const changed = hasChanged(original, edited);
  
  return (
    <div className={cn(
      "grid grid-cols-3 gap-4 py-2 px-3 rounded-md",
      changed ? "bg-amber-50 border border-amber-200" : "bg-gray-50"
    )}>
      <div className="font-medium text-sm text-gray-700">{label}</div>
      <div className="text-sm text-gray-600">
        {formatValue(original)}{unit && original ? ` ${unit}` : ""}
      </div>
      <div className={cn(
        "text-sm font-medium flex items-center gap-2",
        changed ? "text-amber-700" : "text-gray-600"
      )}>
        {formatValue(edited) || "—"}{unit && edited ? ` ${unit}` : ""}
        {changed && <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">Changed</Badge>}
      </div>
    </div>
  );
}

export function TMLEditor({ reading, open, onOpenChange, onSaved }: TMLEditorProps) {
  const [formData, setFormData] = useState({
    cmlNumber: "",
    componentType: "",
    location: "",
    tml1: "",
    tml2: "",
    tml3: "",
    tml4: "",
    tActual: "",
    nominalThickness: "",
    previousThickness: "",
    status: "good" as "good" | "monitor" | "critical",
  });

  const [showComparison, setShowComparison] = useState(false);

  // Store original values for comparison
  const [originalData, setOriginalData] = useState({
    cmlNumber: "",
    componentType: "",
    location: "",
    tml1: "",
    tml2: "",
    tml3: "",
    tml4: "",
    tActual: "",
    nominalThickness: "",
    previousThickness: "",
    status: "good" as "good" | "monitor" | "critical",
  });

  // Initialize form data when reading changes
  useEffect(() => {
    if (reading) {
      const data = {
        cmlNumber: reading.cmlNumber || "",
        componentType: reading.componentType || "",
        location: reading.location || "",
        tml1: reading.tml1 || "",
        tml2: reading.tml2 || "",
        tml3: reading.tml3 || "",
        tml4: reading.tml4 || "",
        tActual: reading.tActual || "",
        nominalThickness: reading.nominalThickness || "",
        previousThickness: reading.previousThickness || "",
        status: reading.status || "good",
      };
      setFormData(data);
      setOriginalData(data);
      setShowComparison(false);
    }
  }, [reading]);

  // Calculate if there are any changes
  const changedFields = useMemo(() => {
    const changes: string[] = [];
    if (hasChanged(originalData.cmlNumber, formData.cmlNumber)) changes.push("CML Number");
    if (hasChanged(originalData.componentType, formData.componentType)) changes.push("Component");
    if (hasChanged(originalData.location, formData.location)) changes.push("Location");
    if (hasChanged(originalData.tml1, formData.tml1)) changes.push("0° Reading");
    if (hasChanged(originalData.tml2, formData.tml2)) changes.push("90° Reading");
    if (hasChanged(originalData.tml3, formData.tml3)) changes.push("180° Reading");
    if (hasChanged(originalData.tml4, formData.tml4)) changes.push("270° Reading");
    if (hasChanged(originalData.tActual, formData.tActual)) changes.push("T-Actual");
    if (hasChanged(originalData.nominalThickness, formData.nominalThickness)) changes.push("Nominal");
    if (hasChanged(originalData.previousThickness, formData.previousThickness)) changes.push("T-Previous");
    if (originalData.status !== formData.status) changes.push("Status");
    return changes;
  }, [formData, originalData]);

  const hasChanges = changedFields.length > 0;

  const updateMutation = trpc.tmlReadings.update.useMutation({
    onSuccess: () => {
      toast.success("TML reading updated successfully");
      onSaved();
      onOpenChange(false);
    },
    onError: (error: { message: string }) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleReviewChanges = () => {
    if (!hasChanges) {
      toast.info("No changes to save");
      return;
    }
    setShowComparison(true);
  };

  const handleSubmit = () => {
    // Calculate tActual as minimum of tml1-4 if not manually set
    let calculatedTActual = formData.tActual;
    if (!calculatedTActual) {
      const readings = [formData.tml1, formData.tml2, formData.tml3, formData.tml4]
        .filter(v => v && !isNaN(parseFloat(v)))
        .map(v => parseFloat(v!));
      if (readings.length > 0) {
        calculatedTActual = Math.min(...readings).toFixed(4);
      }
    }

    updateMutation.mutate({
      id: reading.id,
      cmlNumber: formData.cmlNumber || undefined,
      componentType: formData.componentType || undefined,
      location: formData.location || undefined,
      tml1: formData.tml1 || undefined,
      tml2: formData.tml2 || undefined,
      tml3: formData.tml3 || undefined,
      tml4: formData.tml4 || undefined,
      currentThickness: calculatedTActual || undefined,
      nominalThickness: formData.nominalThickness || undefined,
      previousThickness: formData.previousThickness || undefined,
      status: formData.status,
    });
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBack = () => {
    setShowComparison(false);
  };

  const handleCancel = () => {
    setShowComparison(false);
    onOpenChange(false);
  };

  // Comparison View
  if (showComparison) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Review Changes - CML {reading?.cmlNumber}
            </DialogTitle>
            <DialogDescription>
              Review the changes below before saving. Changed fields are highlighted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Summary */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">{changedFields.length} field{changedFields.length !== 1 ? 's' : ''} will be updated:</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">{changedFields.join(", ")}</p>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-3 gap-4 py-2 px-3 bg-gray-100 rounded-t-lg border-b font-medium text-sm text-gray-700">
              <div>Field</div>
              <div>Original Value</div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                New Value
              </div>
            </div>

            {/* Identification Section */}
            <div className="mt-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">Identification</h4>
              <ComparisonRow label="CML Number" original={originalData.cmlNumber} edited={formData.cmlNumber} />
              <ComparisonRow label="Component" original={originalData.componentType} edited={formData.componentType} />
              <ComparisonRow label="Location" original={originalData.location} edited={formData.location} />
            </div>

            <Separator className="my-4" />

            {/* Angle Readings Section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">Angle Readings</h4>
              <ComparisonRow label="0° Reading" original={originalData.tml1} edited={formData.tml1} unit="in" />
              <ComparisonRow label="90° Reading" original={originalData.tml2} edited={formData.tml2} unit="in" />
              <ComparisonRow label="180° Reading" original={originalData.tml3} edited={formData.tml3} unit="in" />
              <ComparisonRow label="270° Reading" original={originalData.tml4} edited={formData.tml4} unit="in" />
            </div>

            <Separator className="my-4" />

            {/* Reference Values Section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">Reference Values</h4>
              <ComparisonRow label="T-Actual (min)" original={originalData.tActual} edited={formData.tActual} unit="in" />
              <ComparisonRow label="Nominal" original={originalData.nominalThickness} edited={formData.nominalThickness} unit="in" />
              <ComparisonRow label="T-Previous" original={originalData.previousThickness} edited={formData.previousThickness} unit="in" />
            </div>

            <Separator className="my-4" />

            {/* Status Section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-3">Status</h4>
              <div className={cn(
                "grid grid-cols-3 gap-4 py-2 px-3 rounded-md",
                originalData.status !== formData.status ? "bg-amber-50 border border-amber-200" : "bg-gray-50"
              )}>
                <div className="font-medium text-sm text-gray-700">Status</div>
                <div className="text-sm">
                  <Badge variant={originalData.status === "good" ? "default" : originalData.status === "monitor" ? "secondary" : "destructive"}>
                    {originalData.status}
                  </Badge>
                </div>
                <div className="text-sm flex items-center gap-2">
                  <Badge variant={formData.status === "good" ? "default" : formData.status === "monitor" ? "secondary" : "destructive"}>
                    {formData.status}
                  </Badge>
                  {originalData.status !== formData.status && (
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">Changed</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleBack}>
              Back to Edit
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Confirm & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Edit Form View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit TML Reading - CML {reading?.cmlNumber}
          </DialogTitle>
          <DialogDescription>
            Manually edit thickness measurements and metadata for this CML location
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Identification */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cmlNumber">CML Number</Label>
              <Input
                id="cmlNumber"
                value={formData.cmlNumber}
                onChange={(e) => updateField("cmlNumber", e.target.value)}
                placeholder="e.g., 1, CML-1"
                className={cn(hasChanged(originalData.cmlNumber, formData.cmlNumber) && "border-amber-400 bg-amber-50")}
              />
            </div>
            <div>
              <Label htmlFor="componentType">Component</Label>
              <Input
                id="componentType"
                value={formData.componentType}
                onChange={(e) => updateField("componentType", e.target.value)}
                placeholder="e.g., Vessel Shell"
                className={cn(hasChanged(originalData.componentType, formData.componentType) && "border-amber-400 bg-amber-50")}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="e.g., 12 o'clock"
                className={cn(hasChanged(originalData.location, formData.location) && "border-amber-400 bg-amber-50")}
              />
            </div>
          </div>

          {/* Angle Readings */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium mb-3">Angle Readings (inches)</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="tml1">0°</Label>
                <Input
                  id="tml1"
                  type="number"
                  step="0.0001"
                  value={formData.tml1}
                  onChange={(e) => updateField("tml1", e.target.value)}
                  placeholder="0.0000"
                  className={cn(hasChanged(originalData.tml1, formData.tml1) && "border-amber-400 bg-amber-50")}
                />
              </div>
              <div>
                <Label htmlFor="tml2">90°</Label>
                <Input
                  id="tml2"
                  type="number"
                  step="0.0001"
                  value={formData.tml2}
                  onChange={(e) => updateField("tml2", e.target.value)}
                  placeholder="0.0000"
                  className={cn(hasChanged(originalData.tml2, formData.tml2) && "border-amber-400 bg-amber-50")}
                />
              </div>
              <div>
                <Label htmlFor="tml3">180°</Label>
                <Input
                  id="tml3"
                  type="number"
                  step="0.0001"
                  value={formData.tml3}
                  onChange={(e) => updateField("tml3", e.target.value)}
                  placeholder="0.0000"
                  className={cn(hasChanged(originalData.tml3, formData.tml3) && "border-amber-400 bg-amber-50")}
                />
              </div>
              <div>
                <Label htmlFor="tml4">270°</Label>
                <Input
                  id="tml4"
                  type="number"
                  step="0.0001"
                  value={formData.tml4}
                  onChange={(e) => updateField("tml4", e.target.value)}
                  placeholder="0.0000"
                  className={cn(hasChanged(originalData.tml4, formData.tml4) && "border-amber-400 bg-amber-50")}
                />
              </div>
            </div>
          </div>

          {/* Reference Values */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tActual">T-Actual (min)</Label>
              <Input
                id="tActual"
                type="number"
                step="0.0001"
                value={formData.tActual}
                onChange={(e) => updateField("tActual", e.target.value)}
                placeholder="Auto-calculated"
                className={cn(hasChanged(originalData.tActual, formData.tActual) && "border-amber-400 bg-amber-50")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to auto-calculate from angles
              </p>
            </div>
            <div>
              <Label htmlFor="nominalThickness">Nominal</Label>
              <Input
                id="nominalThickness"
                type="number"
                step="0.0001"
                value={formData.nominalThickness}
                onChange={(e) => updateField("nominalThickness", e.target.value)}
                placeholder="0.0000"
                className={cn(hasChanged(originalData.nominalThickness, formData.nominalThickness) && "border-amber-400 bg-amber-50")}
              />
            </div>
            <div>
              <Label htmlFor="previousThickness">T-Previous</Label>
              <Input
                id="previousThickness"
                type="number"
                step="0.0001"
                value={formData.previousThickness}
                onChange={(e) => updateField("previousThickness", e.target.value)}
                placeholder="0.0000"
                className={cn(hasChanged(originalData.previousThickness, formData.previousThickness) && "border-amber-400 bg-amber-50")}
              />
            </div>
          </div>

          {/* Status */}
          <div className="w-48">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => updateField("status", value)}
            >
              <SelectTrigger className={cn(originalData.status !== formData.status && "border-amber-400 bg-amber-50")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Changes Summary */}
          {hasChanges && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">{changedFields.length} unsaved change{changedFields.length !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">{changedFields.join(", ")}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleReviewChanges} disabled={!hasChanges || updateMutation.isPending}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Review Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TMLEditorButtonProps {
  reading: TMLReading;
  onSaved: () => void;
}

export function TMLEditorButton({ reading, onSaved }: TMLEditorButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 w-8 p-0"
        title="Edit TML reading"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <TMLEditor
        reading={reading}
        open={open}
        onOpenChange={setOpen}
        onSaved={onSaved}
      />
    </>
  );
}
