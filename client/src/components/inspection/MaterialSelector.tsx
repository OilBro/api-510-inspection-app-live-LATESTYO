/**
 * Material Selector Component
 * 
 * Provides ASME material selection with automatic stress lookup.
 * Uses the locked calculation engine's material database.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { CheckCircle, AlertTriangle, Info, Search, Database } from "lucide-react";

interface MaterialSelectorProps {
  selectedMaterial?: string;
  temperature?: number;
  onMaterialChange?: (material: string) => void;
  onStressChange?: (stress: number | null) => void;
}

export default function MaterialSelector({
  selectedMaterial,
  temperature = 100,
  onMaterialChange,
  onStressChange,
}: MaterialSelectorProps) {
  const [materialInput, setMaterialInput] = useState(selectedMaterial || '');
  const [tempInput, setTempInput] = useState(temperature.toString());
  
  // Get available materials from the database
  const { data: availableMaterials, isLoading: materialsLoading } = trpc.calculationEngine.listMaterials.useQuery();
  
  // Get material database info
  const { data: dbInfo } = trpc.calculationEngine.getMaterialDatabaseInfo.useQuery();
  
  // Validate the selected material
  const { data: validationResult, isLoading: validating } = trpc.calculationEngine.validateMaterial.useQuery(
    { materialSpec: materialInput },
    { enabled: !!materialInput && materialInput.length > 2 }
  );
  
  // Get allowable stress for the material at the specified temperature
  const { data: stressResult, isLoading: stressLoading } = trpc.calculationEngine.getAllowableStress.useQuery(
    { materialSpec: materialInput, temperatureF: parseFloat(tempInput) || 100 },
    { enabled: !!materialInput && validationResult?.isValid }
  );
  
  // Update parent when stress changes
  useEffect(() => {
    if (stressResult?.stress && onStressChange) {
      onStressChange(stressResult.stress);
    }
  }, [stressResult?.stress, onStressChange]);
  
  // Update parent when material changes
  useEffect(() => {
    if (validationResult?.isValid && validationResult.normalizedSpec && onMaterialChange) {
      onMaterialChange(validationResult.normalizedSpec);
    }
  }, [validationResult?.isValid, validationResult?.normalizedSpec, onMaterialChange]);
  
  const getStatusIcon = () => {
    if (validating || stressLoading) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />;
    }
    if (!materialInput) {
      return <Info className="h-4 w-4 text-gray-400" />;
    }
    if (validationResult?.isValid && stressResult?.status === 'ok') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (stressResult?.status === 'ok_interpolated') {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };
  
  const getStatusBadge = () => {
    if (!materialInput) return null;
    if (validating || stressLoading) {
      return <Badge variant="outline">Validating...</Badge>;
    }
    if (!validationResult?.isValid) {
      return <Badge variant="destructive">Invalid Material</Badge>;
    }
    if (stressResult?.status === 'ok') {
      return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
    }
    if (stressResult?.status === 'ok_interpolated') {
      return <Badge className="bg-yellow-100 text-yellow-800">Interpolated</Badge>;
    }

    return null;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          ASME Material Database
        </CardTitle>
        <CardDescription>
          Select material specification for automatic allowable stress lookup
          {dbInfo && (
            <span className="ml-2 text-xs">
              (Database: {dbInfo.version})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Material Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Material Specification
              {getStatusIcon()}
            </Label>
            <div className="flex gap-2">
              <Select
                value={materialInput}
                onValueChange={(value) => setMaterialInput(value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select material..." />
                </SelectTrigger>
                <SelectContent>
                  {materialsLoading ? (
                    <SelectItem value="_loading" disabled>Loading materials...</SelectItem>
                  ) : (
                    availableMaterials?.map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-gray-500">
              Or enter manually:
            </p>
            <Input
              placeholder="e.g., SA-516 Gr 70"
              value={materialInput}
              onChange={(e) => setMaterialInput(e.target.value)}
            />
          </div>
          
          {/* Temperature Input */}
          <div className="space-y-2">
            <Label>Design Temperature (°F)</Label>
            <Input
              type="number"
              placeholder="100"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Temperature for stress table lookup
            </p>
          </div>
        </div>
        
        {/* Validation Result */}
        {validationResult && materialInput && (
          <div className="mt-4">
            {validationResult.isValid ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Material Validated</AlertTitle>
                <AlertDescription>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                    <div>
                      <span className="text-gray-600">Normalized:</span>
                      <span className="ml-2 font-semibold">{validationResult.normalizedSpec}</span>
                    </div>
                    {validationResult.properties && (
                      <>
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <span className="ml-2 font-semibold">{validationResult.properties.productForm}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Min Tensile:</span>
                          <span className="ml-2 font-semibold">{validationResult.properties.minTensileStrength?.toLocaleString()} psi</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Min Yield:</span>
                          <span className="ml-2 font-semibold">{validationResult.properties.minYieldStrength?.toLocaleString()} psi</span>
                        </div>
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Material Not Found</AlertTitle>
                <AlertDescription>
                  <p className="text-sm">
                    The material specification "{materialInput}" was not found in the ASME database.
                  </p>
                  {validationResult.availableMaterials && validationResult.availableMaterials.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600">Did you mean:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {validationResult.availableMaterials.slice(0, 5).map((mat) => (
                          <Badge
                            key={mat}
                            variant="outline"
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => setMaterialInput(mat)}
                          >
                            {mat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* Stress Result */}
        {stressResult && validationResult?.isValid && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Allowable Stress Lookup</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Material:</span>
                <span className="ml-2 font-semibold">{stressResult.normalizedSpec}</span>
              </div>
              <div>
                <span className="text-gray-600">Temperature:</span>
                <span className="ml-2 font-semibold">{tempInput}°F</span>
              </div>
              <div>
                <span className="text-gray-600">Allowable Stress:</span>
                <span className="ml-2 font-bold text-blue-700">{stressResult.stress?.toLocaleString()} psi</span>
              </div>
              <div>
                <span className="text-gray-600">Reference:</span>
                <span className="ml-2 font-semibold">{stressResult.tableReference}</span>
              </div>
            </div>
            {stressResult.status === 'ok_interpolated' && (
              <p className="text-xs text-yellow-700 mt-2">
                Note: Value interpolated between table entries per ASME Section II Part D
              </p>
            )}
            {stressResult.status === 'error' && stressResult.message?.includes('extrapolat') && (
              <p className="text-xs text-orange-700 mt-2">
                Warning: Value extrapolated beyond table range - verify with code requirements
              </p>
            )}
          </div>
        )}
        
        {/* Database Info */}
        {dbInfo && (
          <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
            <p>
              <strong>Database:</strong> {dbInfo.version} | 
              <strong className="ml-2">Materials:</strong> {dbInfo.materialCount} specifications | 
              <strong className="ml-2">Reference:</strong> {dbInfo.reference}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
