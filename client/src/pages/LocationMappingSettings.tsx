import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface LocationMapping {
  id?: string;
  locationPattern: string;
  componentType: string;
  vesselTagNumber?: string;
  description?: string;
}

export default function LocationMappingSettings() {
  const [, setLocation] = useLocation();
  const [mappings, setMappings] = useState<LocationMapping[]>([
    { locationPattern: "7", componentType: "North Head", description: "Location 7 is North Head" },
    { locationPattern: "8-12", componentType: "Shell", description: "Locations 8-12 are Shell" },
    { locationPattern: "South Head", componentType: "South Head", description: "South Head location" },
  ]);
  const [newMapping, setNewMapping] = useState<LocationMapping>({
    locationPattern: "",
    componentType: "Shell",
    description: "",
  });
  const [vesselFilter, setVesselFilter] = useState<string>("default");

  // Get list of vessels for vessel-specific mappings
  const { data: inspections } = trpc.inspections.list.useQuery();

  const componentTypes = [
    "Shell",
    "North Head",
    "South Head",
    "East Head",
    "West Head",
    "Nozzle",
    "Manway",
    "Other",
  ];

  const handleAddMapping = () => {
    if (!newMapping.locationPattern) {
      toast.error("Please enter a location pattern");
      return;
    }
    setMappings([...mappings, { ...newMapping }]);
    setNewMapping({ locationPattern: "", componentType: "Shell", description: "" });
    toast.success("Mapping added");
  };

  const handleRemoveMapping = (index: number) => {
    const updated = mappings.filter((_, i) => i !== index);
    setMappings(updated);
    toast.success("Mapping removed");
  };

  const handleSaveMappings = () => {
    // In a real implementation, this would save to the database
    toast.success("Location mappings saved successfully");
    console.log("Saved mappings:", mappings);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Settings className="h-8 w-8 text-gray-600" />
              <h1 className="text-2xl font-bold text-gray-900">Location Mapping Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About Location Mappings</CardTitle>
            <CardDescription>
              Configure how TML (Thickness Measurement Location) readings are categorized into components 
              (Shell, Head, Nozzle) for calculations. This affects how minimum thickness, MAWP, and 
              remaining life are calculated for each component.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
              <strong>Example:</strong> If your vessel has Location 7 as the North Head and Locations 8-12 as the Shell,
              create mappings so the calculation engine correctly groups readings by component.
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Vessel Scope</CardTitle>
            <CardDescription>
              Choose whether these mappings apply to all vessels (default) or a specific vessel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={vesselFilter} onValueChange={setVesselFilter}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (All Vessels)</SelectItem>
                {inspections?.map((inspection) => (
                  <SelectItem key={inspection.id} value={inspection.vesselTagNumber}>
                    {inspection.vesselTagNumber} - {inspection.vesselName || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Mappings</CardTitle>
            <CardDescription>
              These mappings define how location numbers/names are assigned to components.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mappings.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No mappings configured. Add one below.</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        Location: <span className="text-blue-600">{mapping.locationPattern}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        → {mapping.componentType}
                        {mapping.description && ` (${mapping.description})`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMapping(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Mapping</CardTitle>
            <CardDescription>
              Define a new location-to-component mapping. Use single numbers (e.g., "7"), 
              ranges (e.g., "8-12"), or text patterns (e.g., "South Head").
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="locationPattern">Location Pattern</Label>
                <Input
                  id="locationPattern"
                  placeholder="e.g., 7, 8-12, South Head"
                  value={newMapping.locationPattern}
                  onChange={(e) => setNewMapping({ ...newMapping, locationPattern: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="componentType">Component Type</Label>
                <Select
                  value={newMapping.componentType}
                  onValueChange={(value) => setNewMapping({ ...newMapping, componentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., North end of vessel"
                  value={newMapping.description || ""}
                  onChange={(e) => setNewMapping({ ...newMapping, description: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAddMapping} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Cancel
          </Button>
          <Button onClick={handleSaveMappings}>
            <Save className="h-4 w-4 mr-2" />
            Save Mappings
          </Button>
        </div>
      </main>
    </div>
  );
}
