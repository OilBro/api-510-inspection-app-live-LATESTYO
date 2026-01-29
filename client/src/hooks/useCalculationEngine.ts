/**
 * Calculation Engine Hook
 * 
 * Provides a React hook interface to the locked calculation engine.
 * All calculations are performed server-side with full audit traceability.
 */

import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export interface CalculationInput {
  // Vessel geometry
  insideDiameter: number;
  insideRadius?: number;
  
  // Design conditions
  designPressure: number;
  designTemperature: number;
  
  // Material
  materialSpec: string;
  allowableStress?: number;
  
  // Joint efficiency
  jointEfficiency: number;
  
  // Thickness data
  nominalThickness: number;
  currentThickness: number;
  previousThickness?: number;
  
  // Corrosion allowance
  corrosionAllowance: number;
  
  // Head-specific parameters
  headType?: '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical' | 'Flat';
  crownRadius?: number;
  knuckleRadius?: number;
  
  // Dates for corrosion rate calculation
  yearBuilt?: number;
  currentYear?: number;
  previousInspectionDate?: string;
  currentInspectionDate?: string;
  
  // Static head (for horizontal vessels)
  specificGravity?: number;
  liquidHeight?: number;
}

// CalculationResult type is inferred from the server response

/**
 * Hook to access the locked calculation engine
 */
export function useCalculationEngine() {
  const utils = trpc.useUtils();
  
  // Get engine info
  const { data: engineInfo } = trpc.calculationEngine.getEngineInfo.useQuery();
  
  // Get material database info
  const { data: materialDbInfo } = trpc.calculationEngine.getMaterialDatabaseInfo.useQuery();
  
  // List available materials
  const { data: availableMaterials } = trpc.calculationEngine.listMaterials.useQuery();
  
  // Mutations for calculations
  const tRequiredShellMutation = trpc.calculationEngine.calculateTRequiredShell.useMutation();
  const tRequiredEllipsoidalMutation = trpc.calculationEngine.calculateTRequiredEllipsoidalHead.useMutation();
  const tRequiredTorisphericalMutation = trpc.calculationEngine.calculateTRequiredTorisphericalHead.useMutation();
  const tRequiredHemisphericalMutation = trpc.calculationEngine.calculateTRequiredHemisphericalHead.useMutation();
  const mawpShellMutation = trpc.calculationEngine.calculateMAWPShell.useMutation();
  const corrosionRateLTMutation = trpc.calculationEngine.calculateCorrosionRateLT.useMutation();
  const corrosionRateSTMutation = trpc.calculationEngine.calculateCorrosionRateST.useMutation();
  const remainingLifeMutation = trpc.calculationEngine.calculateRemainingLife.useMutation();
  const nextInspectionMutation = trpc.calculationEngine.calculateNextInspection.useMutation();
  const fullCalculationMutation = trpc.calculationEngine.performFullCalculation.useMutation();
  
  /**
   * Calculate minimum required thickness for shell
   */
  const calculateTRequiredShell = async (input: CalculationInput) => {
    const result = await tRequiredShellMutation.mutateAsync(input);
    return result;
  };
  
  /**
   * Calculate minimum required thickness for head based on type
   */
  const calculateTRequiredHead = async (
    input: CalculationInput,
    headType: '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical'
  ) => {
    const inputWithHead = { ...input, headType };
    
    switch (headType) {
      case '2:1 Ellipsoidal':
        return await tRequiredEllipsoidalMutation.mutateAsync(inputWithHead);
      case 'Torispherical':
        return await tRequiredTorisphericalMutation.mutateAsync(inputWithHead);
      case 'Hemispherical':
        return await tRequiredHemisphericalMutation.mutateAsync(inputWithHead);
      default:
        throw new Error(`Unsupported head type: ${headType}`);
    }
  };
  
  /**
   * Calculate MAWP for shell
   */
  const calculateMAWPShell = async (input: CalculationInput) => {
    const result = await mawpShellMutation.mutateAsync(input);
    return result;
  };
  
  /**
   * Calculate long-term corrosion rate
   */
  const calculateCorrosionRateLT = async (input: CalculationInput) => {
    const result = await corrosionRateLTMutation.mutateAsync(input);
    return result;
  };
  
  /**
   * Calculate short-term corrosion rate
   */
  const calculateCorrosionRateST = async (input: CalculationInput) => {
    const result = await corrosionRateSTMutation.mutateAsync(input);
    return result;
  };
  
  /**
   * Calculate remaining life
   */
  const calculateRemainingLife = async (
    currentThickness: number,
    tRequired: number,
    corrosionRate: number,
    corrosionRateType: 'LT' | 'ST' | 'GOVERNING'
  ) => {
    const result = await remainingLifeMutation.mutateAsync({
      currentThickness,
      tRequired,
      corrosionRate,
      corrosionRateType,
    });
    return result;
  };
  
  /**
   * Calculate next inspection interval
   */
  const calculateNextInspection = async (remainingLife: number) => {
    const result = await nextInspectionMutation.mutateAsync({ remainingLife });
    return result;
  };
  
  /**
   * Perform full calculation suite for a component
   */
  const performFullCalculation = async (
    input: CalculationInput,
    componentType: 'Shell' | 'Head'
  ) => {
    const result = await fullCalculationMutation.mutateAsync({
      componentType,
      ...input,
    });
    return result;
  };
  
  /**
   * Validate a material specification
   */
  const validateMaterial = (materialSpec: string) => {
    return trpc.calculationEngine.validateMaterial.useQuery({ materialSpec });
  };
  
  /**
   * Get allowable stress for a material at a specific temperature
   */
  const getAllowableStress = (materialSpec: string, temperatureF: number) => {
    return trpc.calculationEngine.getAllowableStress.useQuery({ materialSpec, temperatureF });
  };
  
  return {
    // Engine info
    engineInfo,
    materialDbInfo,
    availableMaterials,
    
    // Calculation functions
    calculateTRequiredShell,
    calculateTRequiredHead,
    calculateMAWPShell,
    calculateCorrosionRateLT,
    calculateCorrosionRateST,
    calculateRemainingLife,
    calculateNextInspection,
    performFullCalculation,
    
    // Material functions
    validateMaterial,
    getAllowableStress,
    
    // Loading states
    isCalculating: 
      tRequiredShellMutation.isPending ||
      tRequiredEllipsoidalMutation.isPending ||
      tRequiredTorisphericalMutation.isPending ||
      tRequiredHemisphericalMutation.isPending ||
      mawpShellMutation.isPending ||
      corrosionRateLTMutation.isPending ||
      corrosionRateSTMutation.isPending ||
      remainingLifeMutation.isPending ||
      nextInspectionMutation.isPending ||
      fullCalculationMutation.isPending,
  };
}

/**
 * Hook to get allowable stress for a specific material and temperature
 */
export function useAllowableStress(materialSpec: string | undefined, temperatureF: number | undefined) {
  const { data, isLoading, error } = trpc.calculationEngine.getAllowableStress.useQuery(
    { materialSpec: materialSpec || '', temperatureF: temperatureF || 0 },
    { enabled: !!materialSpec && temperatureF !== undefined }
  );
  
  return {
    stress: data?.stress ?? null,
    normalizedSpec: data?.normalizedSpec ?? null,
    status: data?.status ?? null,
    message: data?.message ?? null,
    databaseVersion: data?.databaseVersion ?? null,
    tableReference: data?.tableReference ?? null,
    isLoading,
    error,
  };
}

/**
 * Hook to validate a material specification
 */
export function useMaterialValidation(materialSpec: string | undefined) {
  const { data, isLoading, error } = trpc.calculationEngine.validateMaterial.useQuery(
    { materialSpec: materialSpec || '' },
    { enabled: !!materialSpec }
  );
  
  return {
    isValid: data?.isValid ?? false,
    normalizedSpec: data?.normalizedSpec ?? null,
    properties: data?.properties ?? null,
    availableMaterials: data?.availableMaterials ?? [],
    isLoading,
    error,
  };
}
