import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Settings, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LocationMapping {
  id?: string;
  locationPattern: string;
  patternType: "single" | "range" | "prefix" | "slice_angle" | "text";
  componentType: string;
  angularPositions?: number[];
  description?: string;
  priority?: number;
}

const SHELL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const NOZZLE_ANGLES = [0, 90, 180, 270];

export default function LocationMappingSettings() {
  const [, setLocation] = useLocation();
  const [mappings, setMappings] = useState<LocationMapping[]>([]);
  const [newMapping, setNewMapping] = useState<LocationMapping>({
    locationPattern: "",
    patternType: "single",
    componentType: "shell",
    description: "",
  });
  const [vesselFilter, setVesselFilter] = useState<string>("default");
  const [hasChanges, setHasChanges] = useState(false);

  // Get list of vessels for vessel-specific mappings
  const { data: inspections } = trpc.inspections.list.useQuery();
  
  // Load existing mappings
  const { data: existingMappings, isLoading, refetch } = trpc.locationMappings.list.useQuery(
    vesselFilter === "default" ? undefined : { vesselTagNumber: vesselFilter }
  );

  // Save mutation
  const saveMutation = trpc.locationMappings.bulkSave.useMutation({
    onSuccess: () => {
      toast.success("Location mappings saved successfully");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to save mappings: ${error.message}`);
    },
  });

  // Load mappings when data changes
  useEffect(() => {
    if (existingMappings) {
      setMappings(existingMappings.map(m => ({
        id: m.id,
        locationPattern: m.locationPattern,
        patternType: m.patternType as LocationMapping["patternType"],
        componentType: m.componentType,
        angularPositions: m.angularPositions ? JSON.parse(m.angularPositions as string) : undefined,
        description: m.description || undefined,
        priority: m.priority || 0,
      })));
      setHasChanges(false);
    }
  }, [existingMappings]);

  const componentTypes = [
    { value: "shell", label: "Shell" },
    { value: "north_head", label: "North Head" },
    { value: "south_head", label: "South Head" },
    { value: "east_head", label: "East Head" },
    { value: "west_head", label: "West Head" },
    { value: "nozzle", label: "Nozzle" },
    { value: "manway", label: "Manway" },
    { value: "other", label: "Other" },
  ];

  const patternTypes = [
    { value: "single", label: "Single CML", description: "e.g., '7' matches CML 7" },
    { value: "range", label: "Range", description: "e.g., '8-12' matches CMLs 8, 9, 10, 11, 12" },
    { value: "prefix", label: "Prefix", description: "e.g., 'N' matches N1, N2, N3..." },
    { value: "slice_angle", label: "Slice-Angle", description: "e.g., '10-45' matches CML 10 at 45°" },
    { value: "text", label: "Text Pattern", description: "e.g., 'South Head' matches by text" },
  ];

  const handleAddMapping = () => {
    if (!newMapping.locationPattern) {
      toast.error("Please enter a location pattern");
      return;
    }
    
    // Auto-detect pattern type based on input
    let detectedType = newMapping.patternType;
    const pattern = newMapping.locationPattern;
    
    if (/^\d+-\d+$/.test(pattern) && !SHELL_ANGLES.includes(parseInt(pattern.split('-')[1]))) {
      detectedType = "range";
    } else if (/^[A-Za-z]+\d*-\d+$/.test(pattern) && SHELL_ANGLES.includes(parseInt(pattern.split('-').pop() || ''))) {
      detectedType = "slice_angle";
    } else if (/^\d+-\d+$/.test(pattern) && SHELL_ANGLES.includes(parseInt(pattern.split('-')[1]))) {
      detectedType = "slice_angle";
    } else if (/^[A-Za-z]+$/.test(pattern)) {
      detectedType = "prefix";
    } else if (/^\d+$/.test(pattern)) {
      detectedType = "single";
    } else if (pattern.includes(' ')) {
      detectedType = "text";
    }
    
    const mappingToAdd: LocationMapping = {
      ...newMapping,
      patternType: detectedType,
      priority: mappings.length + 1,
    };
    
    // Add angular positions for shell/nozzle if slice_angle type
    if (detectedType === "slice_angle") {
      if (newMapping.componentType === "nozzle") {
        mappingToAdd.angularPositions = NOZZLE_ANGLES;
      } else if (newMapping.componentType === "shell") {
        mappingToAdd.angularPositions = SHELL_ANGLES;
      }
    }
    
    setMappings([...mappings, mappingToAdd]);
    setNewMapping({ locationPattern: "", patternType: "single", componentType: "shell", description: "" });
    setHasChanges(true);
    toast.success(`Mapping added (detected as ${patternTypes.find(p => p.value === detectedType)?.label})`);
  };

  const handleRemoveMapping = (index: number) => {
    const updated = mappings.filter((_, i) => i !== index);
    setMappings(updated);
    setHasChanges(true);
    toast.success("Mapping removed");
  };

  const handleSaveMappings = () => {
    saveMutation.mutate({
      vesselTagNumber: vesselFilter === "default" ? undefined : vesselFilter,
      mappings: mappings.map((m, index) => ({
        locationPattern: m.locationPattern,
        patternType: m.patternType,
        componentType: m.componentType as any,
        angularPositions: m.angularPositions,
        description: m.description,
        priority: mappings.length - index,
      })),
    });
  };

  const getComponentLabel = (value: string) => {
    return componentTypes.find(c => c.value === value)?.label || value;
  };

  const getPatternTypeLabel = (value: string) => {
    return patternTypes.find(p => p.value === value)?.label || value;
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
              <h1 className="text-2xl font-bold text-gray-900">CML/TML Location Mapping Settings</h1>
            </div>
            {hasChanges && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About CML/TML Location Mappings</CardTitle>
            <CardDescription>
              Configure how CML (Condition Monitoring Location) and TML (Thickness Measurement Location) 
              readings are categorized into components (Shell, Head, Nozzle) for calculations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 space-y-2">
              <p><strong>CML Naming Convention Support:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Simple:</strong> 1, 2, 3, N1, N2 (single CML numbers)</li>
                <li><strong>Range:</strong> 8-12 (CMLs 8 through 12)</li>
                <li><strong>Slice-Angle:</strong> 10-0, 10-45, 10-90 (CML 10 at 0°, 45°, 90° positions)</li>
                <li><strong>Nozzle Angles:</strong> N1-0, N1-90, N1-180, N1-270 (4 positions around nozzle)</li>
              </ul>
              <p className="mt-2">
                <strong>Angular Positions:</strong> Shell readings use 8 positions (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°). 
                Nozzle readings use 4 positions (0°, 90°, 180°, 270°).
              </p>
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
            <Select value={vesselFilter} onValueChange={(v) => { setVesselFilter(v); setHasChanges(false); }}>
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
              Higher priority mappings are checked first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading mappings...</span>
              </div>
            ) : mappings.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No mappings configured. Add one below.</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span>Pattern: <span className="text-blue-600 font-mono">{mapping.locationPattern}</span></span>
                        <Badge variant="outline" className="text-xs">
                          {getPatternTypeLabel(mapping.patternType)}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        → <span className="font-medium">{getComponentLabel(mapping.componentType)}</span>
                        {mapping.description && ` (${mapping.description})`}
                      </div>
                      {mapping.angularPositions && mapping.angularPositions.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Angular positions: {mapping.angularPositions.join('°, ')}°
                        </div>
                      )}
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
              Define a new location-to-component mapping. The pattern type will be auto-detected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="locationPattern" className="flex items-center gap-1">
                  Location Pattern
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Examples:</p>
                        <ul className="text-xs mt-1">
                          <li>• "7" - Single CML 7</li>
                          <li>• "8-12" - Range CMLs 8-12</li>
                          <li>• "10-45" - CML 10 at 45°</li>
                          <li>• "N" - All nozzles (N1, N2...)</li>
                          <li>• "South Head" - Text match</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="locationPattern"
                  placeholder="e.g., 7, 8-12, 10-45, N, South Head"
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
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., 2' from East Head Seam"
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
          <Button 
            onClick={handleSaveMappings} 
            disabled={saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Mappings
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
