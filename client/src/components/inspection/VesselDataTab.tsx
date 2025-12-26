import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface VesselDataTabProps {
  inspection: any;
}

export default function VesselDataTab({ inspection }: VesselDataTabProps) {
  const updateMutation = trpc.inspections.update.useMutation();
  const utils = trpc.useUtils();

  const [formData, setFormData] = useState({
    vesselTagNumber: inspection.vesselTagNumber || "",
    vesselName: inspection.vesselName || "",
    manufacturer: inspection.manufacturer || "",
    serialNumber: inspection.serialNumber || "",
    yearBuilt: inspection.yearBuilt?.toString() || "",
    designPressure: inspection.designPressure || "",
    designTemperature: inspection.designTemperature || "",
    operatingPressure: inspection.operatingPressure || "",
    materialSpec: inspection.materialSpec || "",
    allowableStress: inspection.allowableStress || "",
    jointEfficiency: inspection.jointEfficiency || "",
    radiographyType: inspection.radiographyType || "",
    specificGravity: inspection.specificGravity || "",
    vesselType: inspection.vesselType || "",
    insideDiameter: inspection.insideDiameter || "",
    overallLength: inspection.overallLength || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-populate joint efficiency based on radiography type
      if (field === 'radiographyType') {
        switch (value) {
          case 'RT-1':
            updated.jointEfficiency = '1.00';
            break;
          case 'RT-2':
            updated.jointEfficiency = '0.85';
            break;
          case 'RT-3':
            updated.jointEfficiency = '0.70';
            break;
          case 'RT-4':
            updated.jointEfficiency = '0.60';
            break;
          default:
            break;
        }
      }
      
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: inspection.id,
        vesselTagNumber: formData.vesselTagNumber,
        vesselName: formData.vesselName || undefined,
        manufacturer: formData.manufacturer || undefined,
        serialNumber: formData.serialNumber || undefined,
        yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : undefined,
        designPressure: formData.designPressure || undefined,
        designTemperature: formData.designTemperature || undefined,
        operatingPressure: formData.operatingPressure || undefined,
        materialSpec: formData.materialSpec || undefined,
        allowableStress: formData.allowableStress || undefined,
        jointEfficiency: formData.jointEfficiency || undefined,
        radiographyType: formData.radiographyType || undefined,
        specificGravity: formData.specificGravity || undefined,
        vesselType: formData.vesselType || undefined,
        insideDiameter: formData.insideDiameter || undefined,
        overallLength: formData.overallLength || undefined,
      });

      utils.inspections.get.invalidate({ id: inspection.id });
      toast.success("Vessel data saved successfully");
    } catch (error) {
      toast.error("Failed to save vessel data");
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vessel Data & Specifications</CardTitle>
        <CardDescription>Complete vessel identification and design parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Vessel Identification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vesselTagNumber">
                Vessel Tag Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vesselTagNumber"
                value={formData.vesselTagNumber}
                onChange={(e) => handleChange("vesselTagNumber", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vesselName">Vessel Name/Description</Label>
              <Input
                id="vesselName"
                value={formData.vesselName}
                onChange={(e) => handleChange("vesselName", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => handleChange("manufacturer", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => handleChange("serialNumber", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearBuilt">Year Built</Label>
              <Input
                id="yearBuilt"
                type="number"
                value={formData.yearBuilt}
                onChange={(e) => handleChange("yearBuilt", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Design Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designPressure">Design Pressure (psig)</Label>
              <Input
                id="designPressure"
                type="number"
                step="0.01"
                value={formData.designPressure}
                onChange={(e) => handleChange("designPressure", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designTemperature">Design Temperature (°F)</Label>
              <Input
                id="designTemperature"
                type="number"
                step="0.01"
                value={formData.designTemperature}
                onChange={(e) => handleChange("designTemperature", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingPressure">Operating Pressure (psig)</Label>
              <Input
                id="operatingPressure"
                type="number"
                step="0.01"
                value={formData.operatingPressure}
                onChange={(e) => handleChange("operatingPressure", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialSpec">Material Specification</Label>
              <Select
                value={formData.materialSpec}
                onValueChange={(value) => handleChange("materialSpec", value)}
              >
                <SelectTrigger id="materialSpec">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SA-516 Grade 70">SA-516 Grade 70 (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-516 Grade 60">SA-516 Grade 60 (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-515 Grade 70">SA-515 Grade 70 (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-515 Grade 60">SA-515 Grade 60 (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-285 Grade C">SA-285 Grade C (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-285 Grade B">SA-285 Grade B (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-285 Grade A">SA-285 Grade A (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-36">SA-36 (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-283 Grade C">SA-283 Grade C (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-283 Grade D">SA-283 Grade D (Carbon Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 22 Class 2">SA-387 Grade 22 Class 2 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 22 Class 1">SA-387 Grade 22 Class 1 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 11 Class 2">SA-387 Grade 11 Class 2 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 11 Class 1">SA-387 Grade 11 Class 1 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 5">SA-387 Grade 5 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-387 Grade 2">SA-387 Grade 2 (Cr-Mo Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 304">SA-240 Type 304 (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 304L">SA-240 Type 304L (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 316">SA-240 Type 316 (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 316L">SA-240 Type 316L (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 321">SA-240 Type 321 (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 347">SA-240 Type 347 (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-240 Type 410">SA-240 Type 410 (Stainless Steel)</SelectItem>
                  <SelectItem value="SA-203 Grade A">SA-203 Grade A (Ni Alloy Steel)</SelectItem>
                  <SelectItem value="SA-203 Grade B">SA-203 Grade B (Ni Alloy Steel)</SelectItem>
                  <SelectItem value="SA-203 Grade D">SA-203 Grade D (Ni Alloy Steel)</SelectItem>
                  <SelectItem value="SA-203 Grade E">SA-203 Grade E (Ni Alloy Steel)</SelectItem>
                  <SelectItem value="SA-612">SA-612 (High Strength Carbon Steel)</SelectItem>
                  <SelectItem value="SA-106 Grade B">SA-106 Grade B (Seamless Pipe)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowableStress">Allowable Stress (psi)</Label>
              <Input
                id="allowableStress"
                type="number"
                step="1"
                value={formData.allowableStress}
                onChange={(e) => handleChange("allowableStress", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Allowable stress at design temperature per ASME Section II Part D</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="radiographyType">Radiography Type</Label>
              <Select
                value={formData.radiographyType}
                onValueChange={(value) => handleChange("radiographyType", value)}
              >
                <SelectTrigger id="radiographyType">
                  <SelectValue placeholder="Select RT type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RT-1">RT-1 (Full RT, E=1.0)</SelectItem>
                  <SelectItem value="RT-2">RT-2 (Spot RT, E=0.85)</SelectItem>
                  <SelectItem value="RT-3">RT-3 (Limited RT, E=0.70)</SelectItem>
                  <SelectItem value="RT-4">RT-4 (No RT, E=0.60)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jointEfficiency">Joint Efficiency (E)</Label>
              <Input
                id="jointEfficiency"
                type="number"
                step="0.01"
                min="0.6"
                max="1.0"
                value={formData.jointEfficiency}
                onChange={(e) => handleChange("jointEfficiency", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Auto-populated from Radiography Type (0.6-1.0)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specificGravity">Specific Gravity</Label>
              <Input
                id="specificGravity"
                type="number"
                step="0.01"
                value={formData.specificGravity}
                onChange={(e) => handleChange("specificGravity", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Common: Water=1.0, Methylchloride=0.92, Gasoline=0.72</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vesselType">Vessel Type</Label>
              <Select
                value={formData.vesselType}
                onValueChange={(value) => handleChange("vesselType", value)}
              >
                <SelectTrigger id="vesselType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pressure Vessel">Pressure Vessel</SelectItem>
                  <SelectItem value="Storage Tank">Storage Tank</SelectItem>
                  <SelectItem value="Heat Exchanger">Heat Exchanger</SelectItem>
                  <SelectItem value="Reactor">Reactor</SelectItem>
                  <SelectItem value="Distillation Column">Distillation Column</SelectItem>
                  <SelectItem value="Drum">Drum</SelectItem>
                  <SelectItem value="Separator">Separator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Vessel Geometry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insideDiameter">Inside Diameter (inches)</Label>
              <Input
                id="insideDiameter"
                type="number"
                step="0.01"
                value={formData.insideDiameter}
                onChange={(e) => handleChange("insideDiameter", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overallLength">Overall Length (inches)</Label>
              <Input
                id="overallLength"
                type="number"
                step="0.01"
                value={formData.overallLength}
                onChange={(e) => handleChange("overallLength", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

