import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

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

  // Initialize form data when reading changes
  useEffect(() => {
    if (reading) {
      setFormData({
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
      });
    }
  }, [reading]);

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
              />
            </div>
            <div>
              <Label htmlFor="componentType">Component</Label>
              <Input
                id="componentType"
                value={formData.componentType}
                onChange={(e) => updateField("componentType", e.target.value)}
                placeholder="e.g., Vessel Shell"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="e.g., 12 o'clock"
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
