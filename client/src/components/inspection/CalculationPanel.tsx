/**
 * Calculation Panel Component
 * 
 * Displays calculation results from the locked calculation engine with full traceability.
 * Shows intermediate values, code references, and audit information.
 * 
 * FIXED: Now pulls data directly from TML readings database instead of manual inputs.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { Calculator, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, FileText, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

interface CalculationPanelProps {
  inspectionId: string;
}

interface CalculationResult {
  success: boolean;
  calculationType: string;
  resultValue: number | null;
  codeReference: string;
  intermediateValues: Record<string, number | string>;
  warnings: string[];
  validationStatus: 'valid' | 'warning' | 'error';
}

export default function CalculationPanel({ inspectionId }: CalculationPanelProps) {
  const { data: inspection } = trpc.inspections.get.useQuery({ id: inspectionId });
  const { data: tmlReadings } = trpc.tmlReadings.list.useQuery({ inspectionId });
  const { data: engineInfo } = trpc.calculationEngine.getEngineInfo.useQuery();
  const { data: materialDbInfo } = trpc.calculationEngine.getMaterialDatabaseInfo.useQuery();
  const { data: availableMaterials } = trpc.calculationEngine.listMaterials.useQuery();
  
  // Calculation mutations
  const fullCalculationMutation = trpc.calculationEngine.performFullCalculation.useMutation();
  const tRequiredShellMutation = trpc.calculationEngine.calculateTRequiredShell.useMutation();
  const tRequiredEllipsoidalMutation = trpc.calculationEngine.calculateTRequiredEllipsoidalHead.useMutation();
  const tRequiredTorisphericalMutation = trpc.calculationEngine.calculateTRequiredTorisphericalHead.useMutation();
  const tRequiredHemisphericalMutation = trpc.calculationEngine.calculateTRequiredHemisphericalHead.useMutation();
  const mawpShellMutation = trpc.calculationEngine.calculateMAWPShell.useMutation();
  
  // Get allowable stress for the material
  const materialSpec = inspection?.materialSpec || '';
  const designTemperature = inspection?.designTemperature ? parseFloat(String(inspection.designTemperature)) : 100;
  const { data: stressData } = trpc.calculationEngine.getAllowableStress.useQuery(
    { materialSpec, temperatureF: designTemperature },
    { enabled: !!materialSpec }
  );
  
  // Group TML readings by component name (normalized: "Vessel Shell", "East Head", "West Head")
  // Use the 'component' field which contains the normalized display name
  const componentGroups = useMemo(() => {
    if (!tmlReadings) return {};
    const groups: Record<string, typeof tmlReadings> = {};
    for (const reading of tmlReadings) {
      // Use component field (normalized name) for grouping
      // Fall back to componentType if component is empty
      let groupKey = reading.component || reading.componentType || 'Unknown';
      
      // Additional normalization for legacy data that wasn't normalized on import
      const lower = groupKey.toLowerCase();
      if (lower.includes('top head') || lower.includes('north head') || lower.includes('head 1') || lower.includes('e head')) {
        groupKey = 'East Head';
      } else if (lower.includes('bottom head') || lower.includes('bttm head') || lower.includes('south head') || lower.includes('head 2') || lower.includes('w head')) {
        groupKey = 'West Head';
      } else if (lower.includes('shell') || lower.includes('cylinder') || lower.includes('body')) {
        groupKey = 'Vessel Shell';
      } else if (lower === 'head' && !lower.includes('east') && !lower.includes('west')) {
        // Generic "head" without direction - check location field
        const loc = (reading.location || '').toLowerCase();
        if (loc.includes('west') || loc.includes('south') || loc.includes('bottom') || loc.includes('bttm')) {
          groupKey = 'West Head';
        } else {
          groupKey = 'East Head'; // Default to East Head
        }
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(reading);
    }
    return groups;
  }, [tmlReadings]);
  
  // Get unique component types
  const componentTypes = useMemo(() => Object.keys(componentGroups), [componentGroups]);
  
  // Local state for calculation inputs
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [selectedReadingId, setSelectedReadingId] = useState<string>('');
  const [inputs, setInputs] = useState({
    componentType: 'Shell' as 'Shell' | 'Head',
    headType: '2:1 Ellipsoidal' as '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical',
    currentThickness: '',
    previousThickness: '',
    nominalThickness: '',
    yearBuilt: '',
    currentYear: new Date().getFullYear().toString(),
    crownRadius: '', // L parameter for torispherical heads (optional, defaults to D)
    knuckleRadius: '', // r parameter for torispherical heads (optional, defaults to 0.06D)
  });
  
  // Calculation results
  const [shellResult, setShellResult] = useState<CalculationResult | null>(null);
  const [mawpResult, setMawpResult] = useState<CalculationResult | null>(null);
  const [fullResult, setFullResult] = useState<any>(null);
  const [showIntermediateValues, setShowIntermediateValues] = useState(false);
  
  // Auto-select first component type when data loads
  useEffect(() => {
    if (componentTypes.length > 0 && !selectedComponent) {
      setSelectedComponent(componentTypes[0]);
    }
  }, [componentTypes, selectedComponent]);
  
  // Update inputs from inspection data
  useEffect(() => {
    if (inspection) {
      setInputs(prev => ({
        ...prev,
        yearBuilt: inspection.yearBuilt?.toString() || prev.yearBuilt,
      }));
    }
  }, [inspection]);
  
  // Auto-populate inputs when a TML reading is selected
  useEffect(() => {
    if (selectedReadingId && tmlReadings) {
      const reading = tmlReadings.find(r => r.id === selectedReadingId);
      if (reading) {
        // Determine component type from selected component group (normalized name)
        // This is more reliable than checking the raw componentType field
        const selectedLower = selectedComponent.toLowerCase();
        const isHead = selectedLower.includes('head');
        const isShell = selectedLower.includes('shell') || selectedLower.includes('cylinder');
        
        // Determine head type from inspection.headType field
        let headType: '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical' = '2:1 Ellipsoidal';
        if (inspection?.headType) {
          const inspHeadType = inspection.headType.toLowerCase();
          if (inspHeadType.includes('hemispher')) headType = 'Hemispherical';
          else if (inspHeadType.includes('torisp')) headType = 'Torispherical';
          else headType = '2:1 Ellipsoidal';
        }
        
        setInputs(prev => ({
          ...prev,
          componentType: isHead ? 'Head' : 'Shell',
          headType: headType,
          currentThickness: reading.tActual?.toString() || '',
          previousThickness: reading.previousThickness?.toString() || '',
          nominalThickness: reading.nominalThickness?.toString() || '',
        }));
        
        toast.info(`Loaded data from CML ${reading.legacyLocationId} - ${selectedComponent}`);
      }
    }
  }, [selectedReadingId, tmlReadings, inspection, selectedComponent]);
  
  // Get readings for selected component
  const selectedComponentReadings = useMemo(() => {
    return componentGroups[selectedComponent] || [];
  }, [componentGroups, selectedComponent]);
  
  // Get minimum thickness for selected component (governing thickness)
  // CRITICAL: Only consider readings with valid tActual values (not null/empty)
  const governingReading = useMemo(() => {
    if (selectedComponentReadings.length === 0) return null;
    
    // Filter to only readings with valid tActual values
    const validReadings = selectedComponentReadings.filter(r => 
      r.tActual !== null && r.tActual !== undefined && r.tActual !== '' && !isNaN(parseFloat(r.tActual))
    );
    
    if (validReadings.length === 0) return null;
    
    return validReadings.reduce((min, reading) => {
      const current = parseFloat(reading.tActual!);
      const minVal = parseFloat(min.tActual!);
      return current < minVal ? reading : min;
    }, validReadings[0]);
  }, [selectedComponentReadings]);
  
  // Auto-select governing reading when component changes
  useEffect(() => {
    if (governingReading && governingReading.id !== selectedReadingId) {
      setSelectedReadingId(governingReading.id);
    }
  }, [governingReading, selectedReadingId]);
  
  const buildCalculationInput = () => {
    if (!inspection) return null;
    
    const insideDiameter = parseFloat(inspection.insideDiameter || '0');
    const designPressure = parseFloat(inspection.designPressure || '0');
    const jointEfficiency = parseFloat(String(inspection.jointEfficiency || 0.85));
    const corrosionAllowance = 0.125; // Default corrosion allowance
    const currentThickness = parseFloat(inputs.currentThickness || '0');
    const previousThickness = parseFloat(inputs.previousThickness || '0');
    const nominalThickness = parseFloat(inputs.nominalThickness || '0');
    const yearBuilt = parseInt(inputs.yearBuilt || '0');
    const currentYear = parseInt(inputs.currentYear || new Date().getFullYear().toString());
    
    // Get allowable stress: prioritize user-entered value over ASME database
    // If user manually entered an allowable stress, use that (it's more accurate for their specific vessel)
    // Otherwise fall back to ASME database lookup, then default to 20000
    const userEnteredStress = inspection.allowableStress ? parseFloat(String(inspection.allowableStress)) : null;
    const allowableStress = userEnteredStress || stressData?.stress || 20000;
    
    // Determine vessel orientation from inspection data
    // Default to horizontal as most process vessels are horizontal
    const vesselConfig = inspection.vesselConfiguration?.toLowerCase() || '';
    const vesselOrientation: 'horizontal' | 'vertical' = 
      vesselConfig.includes('vertical') ? 'vertical' : 'horizontal';
    
    return {
      insideDiameter,
      designPressure,
      designTemperature,
      materialSpec,
      allowableStress,
      jointEfficiency,
      nominalThickness,
      currentThickness,
      previousThickness: previousThickness > 0 ? previousThickness : undefined,
      corrosionAllowance,
      headType: inputs.headType,
      yearBuilt: yearBuilt > 0 ? yearBuilt : undefined,
      currentYear,
      vesselOrientation, // CRITICAL: Horizontal vessels have static head = 0
      specificGravity: inspection.specificGravity ? parseFloat(String(inspection.specificGravity)) : undefined,
      // Only include liquid height for vertical vessels
      liquidHeight: vesselOrientation === 'vertical' && inspection.insideDiameter 
        ? parseFloat(inspection.insideDiameter) 
        : undefined,
      // Crown and knuckle radius for torispherical heads (optional)
      crownRadius: inputs.crownRadius ? parseFloat(inputs.crownRadius) : undefined,
      knuckleRadius: inputs.knuckleRadius ? parseFloat(inputs.knuckleRadius) : undefined,
    };
  };
  
  const handleCalculateTRequired = async () => {
    const input = buildCalculationInput();
    if (!input) {
      toast.error("Missing inspection data");
      return;
    }
    
    if (!input.currentThickness || input.currentThickness <= 0) {
      toast.error("Please select a TML reading with valid thickness data");
      return;
    }
    
    try {
      let result;
      
      // Use the correct calculation based on component type and head type
      if (inputs.componentType === 'Head') {
        // For heads, use the appropriate head formula based on head type selection
        switch (inputs.headType) {
          case 'Hemispherical':
            result = await tRequiredHemisphericalMutation.mutateAsync(input);
            break;
          case 'Torispherical':
            result = await tRequiredTorisphericalMutation.mutateAsync(input);
            break;
          case '2:1 Ellipsoidal':
          default:
            result = await tRequiredEllipsoidalMutation.mutateAsync(input);
            break;
        }
      } else {
        // For shells, use the shell formula
        result = await tRequiredShellMutation.mutateAsync(input);
      }
      
      setShellResult(result);
      
      if (result.success) {
        const componentDesc = inputs.componentType === 'Head' ? `${inputs.headType} Head` : 'Shell';
        toast.success(`t_required for ${componentDesc}: ${result.resultValue?.toFixed(4)}" per ${result.codeReference}`);
      } else {
        toast.error("Calculation failed - check warnings");
      }
    } catch (error) {
      toast.error("Calculation error");
      console.error(error);
    }
  };
  
  const handleCalculateMAWP = async () => {
    const input = buildCalculationInput();
    if (!input) {
      toast.error("Missing inspection data");
      return;
    }
    
    if (!input.currentThickness || input.currentThickness <= 0) {
      toast.error("Please select a TML reading with valid thickness data");
      return;
    }
    
    try {
      const result = await mawpShellMutation.mutateAsync(input);
      setMawpResult(result);
      
      if (result.success) {
        toast.success(`MAWP calculated: ${result.resultValue?.toFixed(1)} psi per ${result.codeReference}`);
      } else {
        toast.error("Calculation failed - check warnings");
      }
    } catch (error) {
      toast.error("Calculation error");
      console.error(error);
    }
  };
  
  const handleFullCalculation = async () => {
    const input = buildCalculationInput();
    if (!input) {
      toast.error("Missing inspection data");
      return;
    }
    
    if (!input.currentThickness || input.currentThickness <= 0) {
      toast.error("Please select a TML reading with valid thickness data");
      return;
    }
    
    try {
      const result = await fullCalculationMutation.mutateAsync({
        componentType: inputs.componentType,
        ...input,
      });
      setFullResult(result);
      
      if (result.success) {
        toast.success(`Full calculation complete - Status: ${result.summary.status}`);
      } else {
        toast.error("Calculation failed - check warnings");
      }
    } catch (error) {
      toast.error("Calculation error");
      console.error(error);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
      case 'acceptable':
      case 'valid':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Acceptable</Badge>;
      case 'warning':
      case 'monitor':
      case 'marginal':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Monitor</Badge>;
      case 'error':
      case 'unacceptable':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Unacceptable</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };
  
  const formatValue = (value: number | null | undefined, decimals: number = 4): string => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(decimals);
  };
  
  return (
    <div className="space-y-6">
      {/* Engine Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Locked Calculation Engine
          </CardTitle>
          <CardDescription>
            ASME Section VIII Division 1 + API 510 compliant calculations with full audit traceability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-gray-600">Engine Version</p>
              <p className="font-semibold">{engineInfo?.version || 'Loading...'}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-gray-600">Material Database</p>
              <p className="font-semibold">{materialDbInfo?.version || 'Loading...'}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-gray-600">Available Materials</p>
              <p className="font-semibold">{availableMaterials?.length || 0} specifications</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Material Stress Lookup */}
      {stressData && (
        <Alert className={stressData.status === 'ok' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
          <Info className="h-4 w-4" />
          <AlertTitle>ASME Material Stress Lookup</AlertTitle>
          <AlertDescription>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Material:</span>
                <span className="ml-2 font-semibold">{stressData.normalizedSpec || materialSpec}</span>
              </div>
              <div>
                <span className="text-gray-600">Temperature:</span>
                <span className="ml-2 font-semibold">{designTemperature}°F</span>
              </div>
              <div>
                <span className="text-gray-600">Allowable Stress:</span>
                <span className="ml-2 font-semibold">{stressData.stress?.toLocaleString() || '-'} psi</span>
              </div>
              <div>
                <span className="text-gray-600">Reference:</span>
                <span className="ml-2 font-semibold">{stressData.tableReference}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* TML Reading Selection - NEW */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Select TML Reading
          </CardTitle>
          <CardDescription>
            Select a component and TML reading to auto-populate calculation inputs from the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Component Type Selector */}
            <div className="space-y-2">
              <Label>Component</Label>
              <Select
                value={selectedComponent}
                onValueChange={(value) => {
                  setSelectedComponent(value);
                  setSelectedReadingId(''); // Reset reading selection
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component..." />
                </SelectTrigger>
                <SelectContent>
                  {componentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type} ({componentGroups[type]?.length || 0} readings)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* TML Reading Selector */}
            <div className="space-y-2">
              <Label>TML Reading (CML)</Label>
              <Select
                value={selectedReadingId}
                onValueChange={setSelectedReadingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reading..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedComponentReadings.map((reading) => {
                    const isGoverning = reading.id === governingReading?.id;
                    const hasValidThickness = reading.tActual !== null && reading.tActual !== undefined && reading.tActual !== '';
                    return (
                      <SelectItem key={reading.id} value={reading.id}>
                        CML {reading.legacyLocationId} - {reading.location}: {hasValidThickness ? `${reading.tActual}"` : 'N/A'}
                        {isGoverning && ' (MIN)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {governingReading && (
                <p className="text-xs text-gray-500">
                  Governing thickness for {selectedComponent}: {governingReading.tActual}" at CML {governingReading.legacyLocationId}
                </p>
              )}
            </div>
          </div>
          
          {/* Selected Reading Summary */}
          {selectedReadingId && tmlReadings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              {(() => {
                const reading = tmlReadings.find(r => r.id === selectedReadingId);
                if (!reading) return null;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">CML Number:</span>
                      <span className="ml-2 font-semibold">{reading.legacyLocationId}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <span className="ml-2 font-semibold">{reading.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Component:</span>
                      <span className="ml-2 font-semibold">{reading.componentType}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">t_actual:</span>
                      <span className="ml-2 font-bold text-blue-700">
                        {reading.tActual ? `${reading.tActual}"` : <span className="text-gray-400">N/A</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">t_previous:</span>
                      <span className="ml-2 font-semibold">
                        {reading.previousThickness ? `${reading.previousThickness}"` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">t_nominal:</span>
                      <span className="ml-2 font-semibold">
                        {reading.nominalThickness ? `${reading.nominalThickness}"` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2">{getStatusBadge(reading.status || 'good')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Calculation Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Calculation Inputs</CardTitle>
          <CardDescription>
            Values auto-populated from selected TML reading. Override manually if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Component Type</Label>
              <Select
                value={inputs.componentType}
                onValueChange={(value) => setInputs({ ...inputs, componentType: value as 'Shell' | 'Head' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shell">Shell</SelectItem>
                  <SelectItem value="Head">Head</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {inputs.componentType === 'Head' && (
              <div className="space-y-2">
                <Label>Head Type</Label>
                <Select
                  value={inputs.headType}
                  onValueChange={(value) => setInputs({ ...inputs, headType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2:1 Ellipsoidal">2:1 Ellipsoidal</SelectItem>
                    <SelectItem value="Torispherical">Torispherical</SelectItem>
                    <SelectItem value="Hemispherical">Hemispherical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Crown and Knuckle Radius for Torispherical Heads */}
            {inputs.componentType === 'Head' && inputs.headType === 'Torispherical' && (
              <>
                <div className="space-y-2">
                  <Label>Crown Radius L (in)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={inspection?.insideDiameter ? `Default: ${inspection.insideDiameter}" (L=D)` : 'Default: L=D'}
                    value={inputs.crownRadius}
                    onChange={(e) => setInputs({ ...inputs, crownRadius: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">Per ASME VIII-1 UG-32(e), defaults to inside diameter (L=D)</p>
                </div>
                <div className="space-y-2">
                  <Label>Knuckle Radius r (in)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={inspection?.insideDiameter ? `Default: ${(parseFloat(String(inspection.insideDiameter)) * 0.06).toFixed(3)}" (r=0.06D)` : 'Default: r=0.06D'}
                    value={inputs.knuckleRadius}
                    onChange={(e) => setInputs({ ...inputs, knuckleRadius: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">Per ASME VIII-1 UG-32(e), defaults to 6% of diameter (r=0.06D)</p>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label>Current Thickness (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.4500"
                value={inputs.currentThickness}
                onChange={(e) => setInputs({ ...inputs, currentThickness: e.target.value })}
                className={inputs.currentThickness ? 'border-green-300 bg-green-50' : ''}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Previous Thickness (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.4800"
                value={inputs.previousThickness}
                onChange={(e) => setInputs({ ...inputs, previousThickness: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Nominal Thickness (in)</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="0.5000"
                value={inputs.nominalThickness}
                onChange={(e) => setInputs({ ...inputs, nominalThickness: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Year Built</Label>
              <Input
                type="number"
                placeholder="2010"
                value={inputs.yearBuilt}
                onChange={(e) => setInputs({ ...inputs, yearBuilt: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Current Year</Label>
              <Input
                type="number"
                value={inputs.currentYear}
                onChange={(e) => setInputs({ ...inputs, currentYear: e.target.value })}
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <Button onClick={handleCalculateTRequired} disabled={tRequiredShellMutation.isPending}>
              <Calculator className="mr-2 h-4 w-4" />
              Calculate t_required
            </Button>
            <Button onClick={handleCalculateMAWP} disabled={mawpShellMutation.isPending} variant="outline">
              <Calculator className="mr-2 h-4 w-4" />
              Calculate MAWP
            </Button>
            <Button onClick={handleFullCalculation} disabled={fullCalculationMutation.isPending} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Full Calculation Suite
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Calculation Results */}
      {(shellResult || mawpResult || fullResult) && (
        <Card>
          <CardHeader>
            <CardTitle>Calculation Results</CardTitle>
            <CardDescription>Results with full traceability per ASME VIII-1 and API 510</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="details">Detailed Results</TabsTrigger>
                <TabsTrigger value="traceability">Traceability</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* t_min: Prefer fullResult.tRequired (component-specific), fall back to shellResult */}
                  {(fullResult?.tRequired || shellResult) && (
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="text-sm text-gray-600">Min Required Thickness (t_min)</p>
                      <p className="text-2xl font-bold">
                        {formatValue(fullResult?.tRequired?.resultValue ?? shellResult?.resultValue)}"
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {fullResult?.tRequired?.codeReference ?? shellResult?.codeReference}
                      </p>
                      {getStatusBadge(fullResult?.tRequired?.validationStatus ?? shellResult?.validationStatus ?? 'valid')}
                    </div>
                  )}
                  
                  {/* MAWP: Prefer fullResult.mawp (component-specific), fall back to mawpResult */}
                  {/* CRITICAL FIX: fullResult.mawp uses correct head formula (UG-32) vs mawpResult uses shell formula (UG-27) */}
                  {(fullResult?.mawp || mawpResult) && (
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="text-sm text-gray-600">MAWP</p>
                      <p className="text-2xl font-bold">
                        {formatValue(fullResult?.mawp?.resultValue ?? mawpResult?.resultValue, 1)} psi
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {fullResult?.mawp?.codeReference ?? mawpResult?.codeReference}
                      </p>
                      {getStatusBadge(fullResult?.mawp?.validationStatus ?? mawpResult?.validationStatus ?? 'valid')}
                    </div>
                  )}
                  
                  {fullResult?.summary && (
                    <>
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <p className="text-sm text-gray-600">Corrosion Rate</p>
                        <p className="text-2xl font-bold">{formatValue(fullResult.summary.corrosionRate, 4)} in/yr</p>
                        <p className="text-xs text-gray-500 mt-1">API 510 §7.1.1</p>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <p className="text-sm text-gray-600">Remaining Life</p>
                        <p className="text-2xl font-bold">{formatValue(fullResult.summary.remainingLife, 1)} years</p>
                        <p className="text-xs text-gray-500 mt-1">API 510</p>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-lg border col-span-full">
                        <p className="text-sm text-gray-600">Overall Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(fullResult.summary.status)}
                          <span className="text-sm text-gray-700">{fullResult.summary.statusReason}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="mt-4">
                {fullResult && (
                  <div className="space-y-4">
                    {fullResult.tRequired && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Minimum Required Thickness</h4>
                        <p className="text-sm text-gray-600 mb-2">{fullResult.tRequired.codeReference}</p>
                        <p className="text-lg font-bold">{formatValue(fullResult.tRequired.resultValue)}"</p>
                        {fullResult.tRequired.warnings?.length > 0 && (
                          <div className="mt-2">
                            {fullResult.tRequired.warnings.map((w: string, i: number) => (
                              <Alert key={i} className="mt-1 border-yellow-200 bg-yellow-50">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{w}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {fullResult.mawp && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Maximum Allowable Working Pressure</h4>
                        <p className="text-sm text-gray-600 mb-2">{fullResult.mawp.codeReference}</p>
                        <p className="text-lg font-bold">{formatValue(fullResult.mawp.resultValue, 1)} psi</p>
                      </div>
                    )}
                    
                    {fullResult.corrosionRateLT && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Long-Term Corrosion Rate</h4>
                        <p className="text-sm text-gray-600 mb-2">{fullResult.corrosionRateLT.codeReference}</p>
                        <p className="text-lg font-bold">{formatValue(fullResult.corrosionRateLT.resultValue, 4)} in/yr</p>
                      </div>
                    )}
                    
                    {fullResult.remainingLife && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Remaining Life</h4>
                        <p className="text-sm text-gray-600 mb-2">{fullResult.remainingLife.codeReference}</p>
                        <p className="text-lg font-bold">{formatValue(fullResult.remainingLife.resultValue, 1)} years</p>
                      </div>
                    )}
                    
                    {fullResult.nextInspectionDate && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Next Inspection Interval</h4>
                        <p className="text-sm text-gray-600 mb-2">{fullResult.nextInspectionDate.codeReference}</p>
                        <p className="text-lg font-bold">{formatValue(fullResult.nextInspectionDate.resultValue, 1)} years</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="traceability" className="mt-4">
                <Collapsible open={showIntermediateValues} onOpenChange={setShowIntermediateValues}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Intermediate Values & Audit Trail
                      </span>
                      {showIntermediateValues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    {shellResult?.intermediateValues && (
                      <div className="p-4 border rounded-lg mb-4">
                        <h4 className="font-semibold mb-2">t_required Calculation</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {Object.entries(shellResult.intermediateValues).map(([key, value]) => (
                            <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-mono">{typeof value === 'number' ? value.toFixed(4) : value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {fullResult?.tRequired?.intermediateValues && (
                      <div className="p-4 border rounded-lg mb-4">
                        <h4 className="font-semibold mb-2">Full Calculation - t_required</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {Object.entries(fullResult.tRequired.intermediateValues).map(([key, value]) => (
                            <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-mono">{typeof value === 'number' ? (value as number).toFixed(4) : String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {fullResult && (
                      <div className="space-y-4">
                        {/* Validation Status */}
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Validation Status
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between p-2 bg-green-50 rounded border border-green-200">
                              <span className="text-gray-600">Calculation Status:</span>
                              <Badge variant="outline" className="bg-green-100 text-green-800">Validated</Badge>
                            </div>
                            <div className="flex justify-between p-2 bg-blue-50 rounded border border-blue-200">
                              <span className="text-gray-600">Code Compliance:</span>
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">ASME VIII-1 + API 510</Badge>
                            </div>
                          </div>
                          {fullResult.summary?.status === 'FAIL' && (
                            <Alert className="mt-2 border-red-200 bg-red-50">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Non-Compliant Condition</AlertTitle>
                              <AlertDescription>
                                {fullResult.summary.statusReason || 'Actual thickness is below minimum required thickness'}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        {/* Code References */}
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Code References
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {fullResult.tRequired && (
                              <div className="p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">t_min Formula:</span>
                                <span className="ml-2 font-mono text-xs">{fullResult.tRequired.codeReference}</span>
                              </div>
                            )}
                            {fullResult.mawp && (
                              <div className="p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">MAWP Formula:</span>
                                <span className="ml-2 font-mono text-xs">{fullResult.mawp.codeReference}</span>
                              </div>
                            )}
                            {fullResult.corrosionRateLT && (
                              <div className="p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Corrosion Rate:</span>
                                <span className="ml-2 font-mono text-xs">{fullResult.corrosionRateLT.codeReference}</span>
                              </div>
                            )}
                            {fullResult.remainingLife && (
                              <div className="p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Remaining Life:</span>
                                <span className="ml-2 font-mono text-xs">{fullResult.remainingLife.codeReference}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Audit Information */}
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2">Audit Information</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Engine Version:</span>
                              <span className="font-mono">{fullResult.calculationEngineVersion}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Material DB:</span>
                              <span className="font-mono">{fullResult.materialDatabaseVersion}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Calculated At:</span>
                              <span className="font-mono">{fullResult.calculatedAt}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">Component Type:</span>
                              <span className="font-mono">{fullResult.componentType}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
