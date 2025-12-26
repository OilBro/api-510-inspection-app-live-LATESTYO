import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Settings, ArrowLeft, Save } from "lucide-react";
import { APP_TITLE } from "@/const";
import { toast } from "sonner";

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const createMutation = trpc.inspections.create.useMutation();
  
  // Fetch all available materials
  const { data: materials } = trpc.materialStress.getAllMaterials.useQuery();
  
  // Material category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Group materials by category
  const materialsByCategory = materials?.reduce((acc, material) => {
    const category = material.materialCategory || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(material);
    return acc;
  }, {} as Record<string, typeof materials>);
  
  // Get unique categories
  const categories = materialsByCategory ? Object.keys(materialsByCategory).sort() : [];
  
  // Filter materials by selected category
  const filteredMaterials = selectedCategory === 'all' 
    ? materials 
    : materials?.filter(m => m.materialCategory === selectedCategory);
  
  // Function to fetch and auto-fill allowable stress
  const fetchAllowableStress = async (materialSpec: string, temperatureF: number) => {
    try {
      const utils = trpc.useUtils();
      const result = await utils.client.materialStress.getMaterialStressValue.query({
        materialSpec,
        temperatureF,
      });
      
      if (result && result.allowableStress) {
        setFormData((prev) => ({
          ...prev,
          allowableStress: result.allowableStress.toString(),
        }));
        
        if (result.interpolated) {
          toast.info(`Allowable stress interpolated from ${result.lowerBound?.temperatureF}°F and ${result.upperBound?.temperatureF}°F`);
        } else {
          toast.success(`Allowable stress auto-filled: ${result.allowableStress} psi`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch allowable stress:', error);
    }
  };

  const [formData, setFormData] = useState({
    vesselTagNumber: "",
    vesselName: "",
    manufacturer: "",
    serialNumber: "",
    yearBuilt: "",
    designPressure: "",
    designTemperature: "",
    operatingPressure: "",
    materialSpec: "",
    allowableStress: "",
    jointEfficiency: "",
    radiographyType: "",
    specificGravity: "",
    vesselType: "",
    insideDiameter: "",
    overallLength: "",
    inspectionDate: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-populate allowable stress when material or temperature changes
      if ((field === 'materialSpec' || field === 'designTemperature') && updated.materialSpec && updated.designTemperature) {
        // Trigger allowable stress lookup
        fetchAllowableStress(updated.materialSpec, parseFloat(updated.designTemperature));
      }
      
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
            // Don't change joint efficiency if radiography type is cleared
            break;
        }
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vesselTagNumber) {
      toast.error("Vessel Tag Number is required");
      return;
    }

    try {
      const inspection = await createMutation.mutateAsync({
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
        inspectionDate: formData.inspectionDate || undefined,
      });

      toast.success("Inspection created successfully");
      setLocation(`/inspections/${inspection.id}`);
    } catch (error) {
      toast.error("Failed to create inspection");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">{APP_TITLE}</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/inspections">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Inspections
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">New Inspection</h2>
          <p className="text-gray-600">Enter vessel data and specifications</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Vessel Identification</CardTitle>
              <CardDescription>Basic vessel information and specifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vesselTagNumber">
                    Vessel Tag Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="vesselTagNumber"
                    placeholder="e.g., V-101, T-205, R-301"
                    value={formData.vesselTagNumber}
                    onChange={(e) => handleChange("vesselTagNumber", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vesselName">Vessel Name/Description</Label>
                  <Input
                    id="vesselName"
                    placeholder="e.g., Reactor Feed Drum"
                    value={formData.vesselName}
                    onChange={(e) => handleChange("vesselName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    placeholder="e.g., Chicago Bridge & Iron"
                    value={formData.manufacturer}
                    onChange={(e) => handleChange("manufacturer", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    placeholder="e.g., 12345-ABC"
                    value={formData.serialNumber}
                    onChange={(e) => handleChange("serialNumber", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearBuilt">Year Built</Label>
                  <Input
                    id="yearBuilt"
                    type="number"
                    placeholder="e.g., 1995"
                    value={formData.yearBuilt}
                    onChange={(e) => handleChange("yearBuilt", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspectionDate">Inspection Date</Label>
                  <Input
                    id="inspectionDate"
                    type="date"
                    value={formData.inspectionDate}
                    onChange={(e) => handleChange("inspectionDate", e.target.value)}
                  />
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
                      placeholder="e.g., 150"
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
                      placeholder="e.g., 650"
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
                      placeholder="e.g., 125"
                      value={formData.operatingPressure}
                      onChange={(e) => handleChange("operatingPressure", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="materialSpec">Material Specification</Label>
                    
                    {/* Material Category Filter */}
                    {categories.length > 0 && (
                      <div className="flex gap-2 mb-2">
                        <Button
                          type="button"
                          variant={selectedCategory === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory('all')}
                        >
                          All ({materials?.length || 0})
                        </Button>
                        {categories.map((category) => (
                          <Button
                            key={category}
                            type="button"
                            variant={selectedCategory === category ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(category)}
                          >
                            {category} ({materialsByCategory?.[category]?.length || 0})
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <Select
                      value={formData.materialSpec}
                      onValueChange={(value) => handleChange("materialSpec", value)}
                    >
                      <SelectTrigger id="materialSpec">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredMaterials && filteredMaterials.length > 0 ? (
                          filteredMaterials.map((material) => (
                            <SelectItem key={material.materialSpec} value={material.materialSpec}>
                              {material.materialSpec}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="SA-516 Grade 70">SA-516 Grade 70 (Carbon Steel)</SelectItem>
                            <SelectItem value="SA-240 Type 304">SA-240 Type 304 (Stainless Steel)</SelectItem>
                            <SelectItem value="SA-240 Type 316">SA-240 Type 316 (Stainless Steel)</SelectItem>
                            <SelectItem value="SA-285 Grade C">SA-285 Grade C (Carbon Steel)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedCategory !== 'all' && `Showing ${filteredMaterials?.length || 0} ${selectedCategory} materials. `}
                      Select material to auto-fill allowable stress based on design temperature
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowableStress">Allowable Stress (psi)</Label>
                    <Input
                      id="allowableStress"
                      type="number"
                      step="1"
                      placeholder="e.g., 20000"
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
                      placeholder="0.60 - 1.00"
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
                      placeholder="e.g., 0.92"
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
                      placeholder="e.g., 72"
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
                      placeholder="e.g., 20"
                      value={formData.overallLength}
                      onChange={(e) => handleChange("overallLength", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button type="button" variant="outline" asChild>
                  <Link href="/inspections">Cancel</Link>
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? "Creating..." : "Create Inspection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}

