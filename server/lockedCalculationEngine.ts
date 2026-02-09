/**
 * LOCKED CALCULATION ENGINE
 * OilPro 510 - Regulatory-Grade Inspection Application
 * 
 * This module implements all API 510 / ASME VIII-1 calculations with full traceability.
 * This is a LOCKED module - formulas cannot be modified at runtime.
 * 
 * All calculations:
 * 1. Reference the governing code section
 * 2. Declare all assumptions explicitly
 * 3. Preserve units at every step
 * 4. Output intermediate values for audit trail
 * 
 * References:
 * - API 510: Pressure Vessel Inspection Code
 * - ASME Section VIII Division 1: Rules for Construction of Pressure Vessels
 * - ASME Section II Part D: Material Properties
 */

import { getAllowableStress, getAllowableStressNormalized, DATABASE_VERSION } from './asmeMaterialDatabase';

// Engine version for audit traceability
export const CALCULATION_ENGINE_VERSION = "CALC-ENGINE-2.0";
export const ENGINE_EFFECTIVE_DATE = "2026-01-28";

/**
 * Calculation input parameters
 */
export interface CalculationInput {
  // Vessel geometry
  insideDiameter: number;      // inches
  insideRadius?: number;       // inches (calculated if not provided)
  
  // Design conditions
  designPressure: number;      // psi
  designTemperature: number;   // °F
  
  // Material
  materialSpec: string;        // e.g., "SA-516 Gr 70"
  allowableStress?: number;    // psi (will be looked up if not provided)
  
  // Joint efficiency
  jointEfficiency: number;     // 0.0 - 1.0
  
  // Thickness data
  nominalThickness: number;    // inches
  currentThickness: number;    // inches
  previousThickness?: number;  // inches
  
  // Corrosion allowance (OPTIONAL - derived as t_actual - t_required when not provided)
  // Per API 510: CA is the difference between actual thickness and minimum required thickness
  // It should NOT be a required user input - the engine derives it from t_actual and t_required
  corrosionAllowance?: number;  // inches (optional, derived if omitted)
  
  // Head-specific parameters
  headType?: '2:1 Ellipsoidal' | 'Torispherical' | 'Hemispherical' | 'Flat';
  crownRadius?: number;        // inches (L for torispherical)
  knuckleRadius?: number;      // inches (r for torispherical)
  
  // Dates for corrosion rate calculation
  yearBuilt?: number;
  currentYear?: number;
  previousInspectionDate?: Date;
  currentInspectionDate?: Date;
  
  // Vessel orientation and static head
  vesselOrientation?: 'horizontal' | 'vertical';
  specificGravity?: number;
  liquidHeight?: number;       // inches (only applies to vertical vessels or bottom of horizontal shells)
}

/**
 * Calculation result with full traceability
 */
export interface CalculationResult {
  success: boolean;
  calculationType: string;
  resultValue: number | null;
  resultUnit: string;
  
  // Traceability
  codeReference: string;
  formulaUsed: string;
  intermediateValues: Record<string, number | string>;
  
  // Assumptions and warnings
  assumptions: string[];
  warnings: string[];
  
  // Audit trail
  calculationEngineVersion: string;
  materialDatabaseVersion: string;
  calculatedAt: string;
  
  // Error handling
  errorMessage?: string;
  validationStatus: 'valid' | 'warning' | 'error';
}

/**
 * Complete calculation suite result
 */
export interface FullCalculationResult {
  success: boolean;
  componentType: 'Shell' | 'Head';
  
  // Primary results
  tRequired: CalculationResult;
  mawp: CalculationResult;
  corrosionRateLT?: CalculationResult;
  corrosionRateST?: CalculationResult;
  remainingLife?: CalculationResult;
  nextInspectionDate?: CalculationResult;
  mapAtNextInspection?: MAPAtNextInspectionResult;
  
  // Summary
  summary: {
    tRequired: number | null;
    mawp: number | null;
    corrosionRate: number | null;
    corrosionRateType: 'LT' | 'ST' | 'GOVERNING';
    remainingLife: number | null;
    nextInspectionYears: number | null;
    mapAtNextInspection: number | null;
    projectedThicknessAtNextInspection: number | null;
    status: 'acceptable' | 'marginal' | 'unacceptable';
    statusReason: string;
  };
  
  // Warnings
  warnings: string[];
  
  // Audit
  calculatedAt: string;
  calculationEngineVersion: string;
  materialDatabaseVersion: string;
}

/**
 * Calculate minimum required thickness for cylindrical shells.
 * 
 * Formula per ASME Section VIII Division 1, UG-27(c)(1):
 * t = (P × R) / (S × E - 0.6 × P)
 * 
 * Where:
 *   P = Design pressure (psi)
 *   R = Inside radius (inches)
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 * 
 * Note: Corrosion allowance is NOT included in t_required per API 510.
 * Retirement thickness = t_required (without CA)
 */
export function calculateTRequiredShell(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.designPressure || input.designPressure <= 0) {
    return createErrorResult('t_required_shell', 'Design pressure must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('t_required_shell', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('t_required_shell', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  // Get allowable stress from material database
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    warnings.push('Allowable stress provided directly - not from ASME database lookup');
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('t_required_shell', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion,
      lookupStatus: stressResult.status
    };
    
    if (stressResult.status === 'ok_interpolated') {
      assumptions.push(`Allowable stress interpolated at ${input.designTemperature}°F`);
    }
  }
  
  // Calculate inside radius
  const R = input.insideRadius || (input.insideDiameter / 2);
  
  // Calculate static head pressure if applicable
  // IMPORTANT: For horizontal vessels, static head = 0 for heads and minimal for shells
  // Static head only applies to vertical vessels where liquid column creates pressure
  let totalPressure = input.designPressure;
  let staticHeadPressure = 0;
  
  if (input.vesselOrientation === 'horizontal') {
    // For horizontal vessels, static head at the bottom of the shell
    // equals the hydrostatic pressure from the liquid column equal to the vessel ID
    // P_static = (SG × 62.4 lb/ft³ × D_inches) / (144 in²/ft²)
    // This represents the worst-case (full vessel) static head at the lowest point
    if (input.specificGravity && input.insideDiameter) {
      staticHeadPressure = (input.specificGravity * 62.4 * input.insideDiameter) / 144;
      totalPressure = input.designPressure + staticHeadPressure;
      assumptions.push(`Static head pressure included: ${staticHeadPressure.toFixed(2)} psi (horizontal vessel, liquid height = ID = ${input.insideDiameter} in, SG = ${input.specificGravity})`);
    } else {
      staticHeadPressure = 0;
      assumptions.push('Static head = 0 psi (horizontal vessel, no specific gravity provided)');
    }
  } else if (input.specificGravity && input.liquidHeight && input.vesselOrientation === 'vertical') {
    // Static head = ρgh = (SG × 62.4 lb/ft³) × h / 144 in²/ft²
    // Only applies to vertical vessels where liquid column creates hydrostatic pressure
    staticHeadPressure = (input.specificGravity * 62.4 * input.liquidHeight) / 144;
    totalPressure = input.designPressure + staticHeadPressure;
    assumptions.push(`Static head pressure included: ${staticHeadPressure.toFixed(2)} psi (vertical vessel)`);
  } else if (input.specificGravity && input.liquidHeight && !input.vesselOrientation) {
    // If orientation not specified but static head parameters provided, warn and assume vertical
    staticHeadPressure = (input.specificGravity * 62.4 * input.liquidHeight) / 144;
    totalPressure = input.designPressure + staticHeadPressure;
    warnings.push('Vessel orientation not specified - assuming vertical for static head calculation');
    assumptions.push(`Static head pressure included: ${staticHeadPressure.toFixed(2)} psi (assumed vertical)`);
  }
  
  const P = totalPressure;
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-27(c)(1): t = PR / (SE - 0.6P)
  const numerator = P * R;
  const denominator = (S * E) - (0.6 * P);
  
  if (denominator <= 0) {
    return createErrorResult('t_required_shell', 
      'Calculation error: SE - 0.6P must be > 0. Check design pressure and material stress.', calculatedAt);
  }
  
  const tRequired = numerator / denominator;
  
  // Validate result
  if (tRequired <= 0) {
    return createErrorResult('t_required_shell', 
      'Calculation resulted in non-positive thickness', calculatedAt);
  }
  
  // Add assumptions
  assumptions.push('Formula per ASME Section VIII Division 1, UG-27(c)(1)');
  assumptions.push('Corrosion allowance NOT included in t_required per API 510');
  assumptions.push('t_required represents retirement thickness');
  
  // Check if current thickness is below required
  if (input.currentThickness && input.currentThickness < tRequired) {
    warnings.push(`CRITICAL: Current thickness (${input.currentThickness.toFixed(4)}") is below t_required (${tRequired.toFixed(4)}")`);
  }
  
  return {
    success: true,
    calculationType: 't_required_shell',
    resultValue: round(tRequired, 4),
    resultUnit: 'inches',
    codeReference: 'ASME Section VIII Division 1, UG-27(c)(1)',
    formulaUsed: 't = (P × R) / (S × E - 0.6 × P)',
    intermediateValues: {
      P_design: input.designPressure,
      P_static_head: staticHeadPressure,
      P_total: P,
      R: R,
      S: S,
      E: E,
      'S × E': S * E,
      '0.6 × P': 0.6 * P,
      'S × E - 0.6 × P': denominator,
      'P × R': numerator,
      t_required: round(tRequired, 4),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('CRITICAL')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate minimum required thickness for 2:1 ellipsoidal heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(d):
 * t = (P × D) / (2 × S × E - 0.2 × P)
 * 
 * Where:
 *   P = Design pressure (psi)
 *   D = Inside diameter (inches)
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 */
export function calculateTRequiredEllipsoidalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.designPressure || input.designPressure <= 0) {
    return createErrorResult('t_required_head_ellipsoidal', 'Design pressure must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('t_required_head_ellipsoidal', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('t_required_head_ellipsoidal', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  // Get allowable stress
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    warnings.push('Allowable stress provided directly - not from ASME database lookup');
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('t_required_head_ellipsoidal', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const P = input.designPressure;
  const D = input.insideDiameter;
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-32(d): t = PD / (2SE - 0.2P)
  const numerator = P * D;
  const denominator = (2 * S * E) - (0.2 * P);
  
  if (denominator <= 0) {
    return createErrorResult('t_required_head_ellipsoidal', 
      'Calculation error: 2SE - 0.2P must be > 0', calculatedAt);
  }
  
  const tRequired = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(d)');
  assumptions.push('Applies to 2:1 ellipsoidal heads');
  assumptions.push('Corrosion allowance NOT included in t_required');
  
  if (input.currentThickness && input.currentThickness < tRequired) {
    warnings.push(`CRITICAL: Current thickness (${input.currentThickness.toFixed(4)}") is below t_required (${tRequired.toFixed(4)}")`);
  }
  
  return {
    success: true,
    calculationType: 't_required_head_ellipsoidal',
    resultValue: round(tRequired, 4),
    resultUnit: 'inches',
    codeReference: 'ASME Section VIII Division 1, UG-32(d)',
    formulaUsed: 't = (P × D) / (2 × S × E - 0.2 × P)',
    intermediateValues: {
      P: P,
      D: D,
      S: S,
      E: E,
      '2 × S × E': 2 * S * E,
      '0.2 × P': 0.2 * P,
      '2 × S × E - 0.2 × P': denominator,
      'P × D': numerator,
      t_required: round(tRequired, 4),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('CRITICAL')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate minimum required thickness for torispherical heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(e):
 * t = (P × L × M) / (2 × S × E - 0.2 × P)
 * 
 * Where:
 *   P = Design pressure (psi)
 *   L = Inside crown radius (inches)
 *   M = Factor depending on L/r ratio
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 *   r = Inside knuckle radius (inches)
 * 
 * M = (1/4) × (3 + √(L/r))
 */
export function calculateTRequiredTorisphericalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.designPressure || input.designPressure <= 0) {
    return createErrorResult('t_required_head_torispherical', 'Design pressure must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('t_required_head_torispherical', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('t_required_head_torispherical', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  // Apply default values for crown radius (L) and knuckle radius (r) if not provided
  // Per ASME VIII-1 UG-32(e), common defaults are L=D (crown radius = inside diameter)
  // and r=0.06D (knuckle radius = 6% of inside diameter, minimum per code)
  let crownRadius = input.crownRadius;
  let knuckleRadius = input.knuckleRadius;
  
  if (!crownRadius || crownRadius <= 0) {
    crownRadius = input.insideDiameter; // Default L = D
    warnings.push(`Crown radius (L) not provided - using default L = D = ${crownRadius.toFixed(2)}"`);
    assumptions.push('Crown radius (L) defaulted to inside diameter (D)');
  }
  
  if (!knuckleRadius || knuckleRadius <= 0) {
    knuckleRadius = 0.06 * input.insideDiameter; // Default r = 0.06D (6% of D, minimum per code)
    warnings.push(`Knuckle radius (r) not provided - using default r = 0.06D = ${knuckleRadius.toFixed(2)}"`);
    assumptions.push('Knuckle radius (r) defaulted to 6% of inside diameter (0.06D)');
  }
  
  // Get allowable stress
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    warnings.push('Allowable stress provided directly - not from ASME database lookup');
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('t_required_head_torispherical', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const P = input.designPressure;
  const L = crownRadius;  // Use local variable with default applied
  const r = knuckleRadius;  // Use local variable with default applied
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // Calculate M factor: M = (1/4) × (3 + √(L/r))
  const LrRatio = L / r;
  const M = 0.25 * (3 + Math.sqrt(LrRatio));
  
  // ASME VIII-1 UG-32(e): t = PLM / (2SE - 0.2P)
  const numerator = P * L * M;
  const denominator = (2 * S * E) - (0.2 * P);
  
  if (denominator <= 0) {
    return createErrorResult('t_required_head_torispherical', 
      'Calculation error: 2SE - 0.2P must be > 0', calculatedAt);
  }
  
  const tRequired = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(e)');
  assumptions.push('M factor calculated per UG-32(e): M = (1/4) × (3 + √(L/r))');
  assumptions.push('Corrosion allowance NOT included in t_required');
  
  // Validate L/r ratio per ASME requirements
  if (LrRatio > 16.67) {
    warnings.push(`L/r ratio (${LrRatio.toFixed(2)}) exceeds typical limit of 16.67`);
  }
  
  if (input.currentThickness && input.currentThickness < tRequired) {
    warnings.push(`CRITICAL: Current thickness (${input.currentThickness.toFixed(4)}") is below t_required (${tRequired.toFixed(4)}")`);
  }
  
  return {
    success: true,
    calculationType: 't_required_head_torispherical',
    resultValue: round(tRequired, 4),
    resultUnit: 'inches',
    codeReference: 'ASME Section VIII Division 1, UG-32(e)',
    formulaUsed: 't = (P × L × M) / (2 × S × E - 0.2 × P), where M = (1/4) × (3 + √(L/r))',
    intermediateValues: {
      P: P,
      L: L,
      r: r,
      'L/r': round(LrRatio, 4),
      M: round(M, 4),
      S: S,
      E: E,
      '2 × S × E': 2 * S * E,
      '0.2 × P': 0.2 * P,
      '2 × S × E - 0.2 × P': denominator,
      'P × L × M': numerator,
      t_required: round(tRequired, 4),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('CRITICAL')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate minimum required thickness for hemispherical heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(f):
 * t = (P × R) / (2 × S × E - 0.2 × P)
 * 
 * Where:
 *   P = Design pressure (psi)
 *   R = Inside radius (inches)
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 */
export function calculateTRequiredHemisphericalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.designPressure || input.designPressure <= 0) {
    return createErrorResult('t_required_head_hemispherical', 'Design pressure must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('t_required_head_hemispherical', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('t_required_head_hemispherical', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  // Get allowable stress
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    warnings.push('Allowable stress provided directly - not from ASME database lookup');
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('t_required_head_hemispherical', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const P = input.designPressure;
  const R = input.insideRadius || (input.insideDiameter / 2);
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-32(f): t = PR / (2SE - 0.2P)
  const numerator = P * R;
  const denominator = (2 * S * E) - (0.2 * P);
  
  if (denominator <= 0) {
    return createErrorResult('t_required_head_hemispherical', 
      'Calculation error: 2SE - 0.2P must be > 0', calculatedAt);
  }
  
  const tRequired = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(f)');
  assumptions.push('Applies to hemispherical heads');
  assumptions.push('Corrosion allowance NOT included in t_required');
  
  if (input.currentThickness && input.currentThickness < tRequired) {
    warnings.push(`CRITICAL: Current thickness (${input.currentThickness.toFixed(4)}") is below t_required (${tRequired.toFixed(4)}")`);
  }
  
  return {
    success: true,
    calculationType: 't_required_head_hemispherical',
    resultValue: round(tRequired, 4),
    resultUnit: 'inches',
    codeReference: 'ASME Section VIII Division 1, UG-32(f)',
    formulaUsed: 't = (P × R) / (2 × S × E - 0.2 × P)',
    intermediateValues: {
      P: P,
      R: R,
      S: S,
      E: E,
      '2 × S × E': 2 * S * E,
      '0.2 × P': 0.2 * P,
      '2 × S × E - 0.2 × P': denominator,
      'P × R': numerator,
      t_required: round(tRequired, 4),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('CRITICAL')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate Maximum Allowable Working Pressure (MAWP) for cylindrical shells.
 * 
 * Formula per ASME Section VIII Division 1, UG-27(c)(1):
 * MAWP = (S × E × t) / (R + 0.6 × t)
 * 
 * Where:
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 *   t = Actual thickness (inches)
 *   R = Inside radius (inches)
 */
export function calculateMAWPShell(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('mawp_shell', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('mawp_shell', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('mawp_shell', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  // Get allowable stress
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    warnings.push('Allowable stress provided directly - not from ASME database lookup');
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('mawp_shell', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const t = input.currentThickness;
  const R = input.insideRadius || (input.insideDiameter / 2);
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-27(c)(1): MAWP = SEt / (R + 0.6t)
  const numerator = S * E * t;
  const denominator = R + (0.6 * t);
  
  const mawp = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-27(c)(1)');
  assumptions.push('MAWP calculated at current (corroded) thickness');
  
  // Check if MAWP is below design pressure
  if (input.designPressure && mawp < input.designPressure) {
    warnings.push(`WARNING: Calculated MAWP (${mawp.toFixed(2)} psi) is below design pressure (${input.designPressure} psi)`);
  }
  
  return {
    success: true,
    calculationType: 'mawp_shell',
    resultValue: round(mawp, 2),
    resultUnit: 'psi',
    codeReference: 'ASME Section VIII Division 1, UG-27(c)(1)',
    formulaUsed: 'MAWP = (S × E × t) / (R + 0.6 × t)',
    intermediateValues: {
      t: t,
      R: R,
      S: S,
      E: E,
      'S × E × t': numerator,
      '0.6 × t': 0.6 * t,
      'R + 0.6 × t': denominator,
      MAWP: round(mawp, 2),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('WARNING')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate Maximum Allowable Working Pressure (MAWP) for hemispherical heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(f):
 * P = (2 × S × E × t) / (R + 0.2 × t)
 * 
 * Where:
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 *   t = Actual thickness (inches)
 *   R = Inside radius (inches)
 */
export function calculateMAWPHemisphericalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('mawp_head_hemispherical', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('mawp_head_hemispherical', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('mawp_head_hemispherical', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('mawp_head_hemispherical', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const t = input.currentThickness;
  const R = input.insideRadius || (input.insideDiameter / 2);
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-32(f): P = 2SEt / (R + 0.2t)
  const numerator = 2 * S * E * t;
  const denominator = R + (0.2 * t);
  const mawp = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(f)');
  assumptions.push('MAWP calculated at current (corroded) thickness');
  assumptions.push('Applies to hemispherical heads');
  
  if (input.designPressure && mawp < input.designPressure) {
    warnings.push(`WARNING: Calculated MAWP (${mawp.toFixed(2)} psi) is below design pressure (${input.designPressure} psi)`);
  }
  
  return {
    success: true,
    calculationType: 'mawp_head_hemispherical',
    resultValue: round(mawp, 2),
    resultUnit: 'psi',
    codeReference: 'ASME Section VIII Division 1, UG-32(f)',
    formulaUsed: 'P = (2 × S × E × t) / (R + 0.2 × t)',
    intermediateValues: {
      t, R, S, E,
      '2 × S × E × t': numerator,
      '0.2 × t': 0.2 * t,
      'R + 0.2 × t': denominator,
      MAWP: round(mawp, 2),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('WARNING')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate Maximum Allowable Working Pressure (MAWP) for 2:1 ellipsoidal heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(d):
 * P = (2 × S × E × t) / (D + 0.2 × t)
 * 
 * Where:
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 *   t = Actual thickness (inches)
 *   D = Inside diameter (inches)
 */
export function calculateMAWPEllipsoidalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('mawp_head_ellipsoidal', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('mawp_head_ellipsoidal', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('mawp_head_ellipsoidal', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('mawp_head_ellipsoidal', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const t = input.currentThickness;
  const D = input.insideDiameter;
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // ASME VIII-1 UG-32(d): P = 2SEt / (D + 0.2t)
  const numerator = 2 * S * E * t;
  const denominator = D + (0.2 * t);
  const mawp = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(d)');
  assumptions.push('MAWP calculated at current (corroded) thickness');
  assumptions.push('Applies to 2:1 ellipsoidal heads');
  
  if (input.designPressure && mawp < input.designPressure) {
    warnings.push(`WARNING: Calculated MAWP (${mawp.toFixed(2)} psi) is below design pressure (${input.designPressure} psi)`);
  }
  
  return {
    success: true,
    calculationType: 'mawp_head_ellipsoidal',
    resultValue: round(mawp, 2),
    resultUnit: 'psi',
    codeReference: 'ASME Section VIII Division 1, UG-32(d)',
    formulaUsed: 'P = (2 × S × E × t) / (D + 0.2 × t)',
    intermediateValues: {
      t, D, S, E,
      '2 × S × E × t': numerator,
      '0.2 × t': 0.2 * t,
      'D + 0.2 × t': denominator,
      MAWP: round(mawp, 2),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('WARNING')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate Maximum Allowable Working Pressure (MAWP) for torispherical heads.
 * 
 * Formula per ASME Section VIII Division 1, UG-32(e):
 * P = (2 × S × E × t) / (L × M + 0.2 × t)
 * 
 * Where:
 *   S = Allowable stress (psi)
 *   E = Joint efficiency
 *   t = Actual thickness (inches)
 *   L = Inside crown radius (inches)
 *   M = Factor = 0.25 × (3 + √(L/r))
 *   r = Inside knuckle radius (inches)
 */
export function calculateMAWPTorisphericalHead(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('mawp_head_torispherical', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.insideDiameter || input.insideDiameter <= 0) {
    return createErrorResult('mawp_head_torispherical', 'Inside diameter must be > 0', calculatedAt);
  }
  if (!input.jointEfficiency || input.jointEfficiency <= 0 || input.jointEfficiency > 1) {
    return createErrorResult('mawp_head_torispherical', 'Joint efficiency must be between 0 and 1', calculatedAt);
  }
  
  let crownRadius = input.crownRadius;
  let knuckleRadius = input.knuckleRadius;
  
  if (!crownRadius || crownRadius <= 0) {
    crownRadius = input.insideDiameter;
    assumptions.push('Crown radius (L) defaulted to inside diameter (D)');
  }
  
  if (!knuckleRadius || knuckleRadius <= 0) {
    knuckleRadius = 0.06 * input.insideDiameter;
    assumptions.push('Knuckle radius (r) defaulted to 6% of inside diameter (0.06D)');
  }
  
  let allowableStress: number;
  let stressLookupDetails: Record<string, any> = {};
  
  if (input.allowableStress && input.allowableStress > 0) {
    allowableStress = input.allowableStress;
    stressLookupDetails = { source: 'user_provided', value: allowableStress };
  } else {
    const stressResult = getAllowableStressNormalized(input.materialSpec, input.designTemperature);
    if (stressResult.status === 'error' || !stressResult.stress) {
      return createErrorResult('mawp_head_torispherical', 
        `Failed to lookup allowable stress: ${stressResult.message}`, calculatedAt);
    }
    allowableStress = stressResult.stress;
    stressLookupDetails = {
      source: 'ASME_database',
      materialSpec: stressResult.normalizedSpec || input.materialSpec,
      temperature: input.designTemperature,
      value: allowableStress,
      databaseVersion: stressResult.databaseVersion
    };
  }
  
  const t = input.currentThickness;
  const L = crownRadius;
  const r = knuckleRadius;
  const S = allowableStress;
  const E = input.jointEfficiency;
  
  // Calculate M factor: M = 0.25 × (3 + √(L/r))
  const LrRatio = L / r;
  const M = 0.25 * (3 + Math.sqrt(LrRatio));
  
  // ASME VIII-1 UG-32(e): P = 2SEt / (LM + 0.2t)
  const numerator = 2 * S * E * t;
  const denominator = (L * M) + (0.2 * t);
  const mawp = numerator / denominator;
  
  assumptions.push('Formula per ASME Section VIII Division 1, UG-32(e)');
  assumptions.push('M factor calculated per UG-32(e): M = 0.25 × (3 + √(L/r))');
  assumptions.push('MAWP calculated at current (corroded) thickness');
  assumptions.push('Applies to torispherical heads');
  
  if (input.designPressure && mawp < input.designPressure) {
    warnings.push(`WARNING: Calculated MAWP (${mawp.toFixed(2)} psi) is below design pressure (${input.designPressure} psi)`);
  }
  
  return {
    success: true,
    calculationType: 'mawp_head_torispherical',
    resultValue: round(mawp, 2),
    resultUnit: 'psi',
    codeReference: 'ASME Section VIII Division 1, UG-32(e)',
    formulaUsed: 'P = (2 × S × E × t) / (L × M + 0.2 × t), where M = 0.25 × (3 + √(L/r))',
    intermediateValues: {
      t, L, r,
      'L/r': round(LrRatio, 4),
      M: round(M, 4),
      S, E,
      '2 × S × E × t': numerator,
      'L × M': round(L * M, 4),
      '0.2 × t': 0.2 * t,
      'L × M + 0.2 × t': round(denominator, 4),
      MAWP: round(mawp, 2),
      ...stressLookupDetails
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('WARNING')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate MAP (Maximum Allowable Pressure) at next inspection.
 * 
 * Formula:
 * t_at_next_inspection = t_act - (2 × Yn × Cr)
 * 
 * Where:
 *   t_act = Current actual thickness (inches)
 *   Yn = Years to next inspection
 *   Cr = Corrosion rate (in/yr)
 *   Factor of 2 provides safety margin per API 510
 */
export interface MAPAtNextInspectionResult {
  success: boolean;
  projectedThickness: number;
  mapAtNextInspection: number;
  mawpAtNextInspection: number;
  yearsToNextInspection: number;
  corrosionRate: number;
  staticHeadDeduction: number;
  codeReference: string;
  formulaUsed: string;
  intermediateValues: Record<string, number | string>;
  assumptions: string[];
  warnings: string[];
  calculationEngineVersion: string;
  calculatedAt: string;
}

export function calculateMAPAtNextInspection(
  input: CalculationInput,
  componentType: 'Shell' | 'Head',
  corrosionRate: number,
  yearsToNextInspection: number
): MAPAtNextInspectionResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  if (!input.currentThickness || input.currentThickness <= 0) {
    return {
      success: false,
      projectedThickness: 0,
      mapAtNextInspection: 0,
      mawpAtNextInspection: 0,
      yearsToNextInspection: 0,
      corrosionRate: 0,
      staticHeadDeduction: 0,
      codeReference: '',
      formulaUsed: '',
      intermediateValues: { error: 'Current thickness must be > 0' },
      assumptions: [],
      warnings: [],
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      calculatedAt
    };
  }
  
  if (corrosionRate <= 0) {
    return {
      success: false,
      projectedThickness: 0,
      mapAtNextInspection: 0,
      mawpAtNextInspection: 0,
      yearsToNextInspection: 0,
      corrosionRate: 0,
      staticHeadDeduction: 0,
      codeReference: '',
      formulaUsed: '',
      intermediateValues: { error: 'Corrosion rate must be > 0' },
      assumptions: [],
      warnings: [],
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      calculatedAt
    };
  }
  
  // Calculate projected thickness: t = t_act - 2 × Yn × Cr
  const projectedThicknessLoss = 2 * yearsToNextInspection * corrosionRate;
  const projectedThickness = input.currentThickness - projectedThicknessLoss;
  
  assumptions.push('Projected thickness = t_act - (2 × Yn × Cr)');
  assumptions.push('Factor of 2 provides safety margin per API 510');
  
  if (projectedThickness <= 0) {
    warnings.push('CRITICAL: Projected thickness at next inspection is zero or negative');
    return {
      success: true,
      projectedThickness: Math.max(0, projectedThickness),
      mapAtNextInspection: 0,
      mawpAtNextInspection: 0,
      yearsToNextInspection,
      corrosionRate,
      staticHeadDeduction: 0,
      codeReference: 'API 510',
      formulaUsed: 't = t_act - 2×Yn×Cr',
      intermediateValues: {
        t_actual: input.currentThickness,
        Yn: yearsToNextInspection,
        Cr: corrosionRate,
        '2 × Yn × Cr': projectedThicknessLoss,
        t_projected: Math.max(0, projectedThickness),
        note: 'Projected thickness at or below zero'
      },
      assumptions,
      warnings,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      calculatedAt
    };
  }
  
  // Create input with projected thickness for MAWP calculation
  const projectedInput: CalculationInput = {
    ...input,
    currentThickness: projectedThickness
  };
  
  // Calculate MAP using appropriate formula
  let mapResult: CalculationResult;
  
  if (componentType === 'Shell') {
    mapResult = calculateMAWPShell(projectedInput);
  } else {
    switch (input.headType) {
      case 'Hemispherical':
        mapResult = calculateMAWPHemisphericalHead(projectedInput);
        break;
      case 'Torispherical':
        mapResult = calculateMAWPTorisphericalHead(projectedInput);
        break;
      case '2:1 Ellipsoidal':
      default:
        mapResult = calculateMAWPEllipsoidalHead(projectedInput);
        break;
    }
  }
  
  const mapAtNextInspection = mapResult.resultValue || 0;
  
  // Calculate static head deduction: SH × 0.433 × SG
  let staticHeadDeduction = 0;
  
  if (input.specificGravity && input.liquidHeight && input.vesselOrientation === 'vertical') {
    // Vertical vessel: static head = liquid height in feet × 0.433 × SG
    const liquidHeightFeet = input.liquidHeight / 12;
    staticHeadDeduction = liquidHeightFeet * 0.433 * input.specificGravity;
    assumptions.push(`Static head deduction: ${staticHeadDeduction.toFixed(2)} psi (vertical, liquid height = ${input.liquidHeight} in)`);
  } else if (input.specificGravity && input.vesselOrientation === 'horizontal' && input.insideDiameter) {
    // Horizontal vessel: static head at bottom = ID in feet × 0.433 × SG
    const idFeet = input.insideDiameter / 12;
    staticHeadDeduction = idFeet * 0.433 * input.specificGravity;
    assumptions.push(`Static head deduction: ${staticHeadDeduction.toFixed(2)} psi (horizontal, liquid height = ID = ${input.insideDiameter} in)`);
  } else {
    assumptions.push('No static head deduction (no specific gravity or liquid height specified)');
  }
  
  const mawpAtNextInspection = mapAtNextInspection - staticHeadDeduction;
  
  if (input.designPressure && mawpAtNextInspection < input.designPressure) {
    warnings.push(`WARNING: Projected MAWP at next inspection (${mawpAtNextInspection.toFixed(2)} psi) will be below design pressure (${input.designPressure} psi)`);
  }
  
  return {
    success: true,
    projectedThickness: round(projectedThickness, 4),
    mapAtNextInspection: round(mapAtNextInspection, 2),
    mawpAtNextInspection: round(mawpAtNextInspection, 2),
    yearsToNextInspection,
    corrosionRate,
    staticHeadDeduction: round(staticHeadDeduction, 2),
    codeReference: 'API 510 / ASME VIII-1',
    formulaUsed: 't = t_act - 2×Yn×Cr; P = SEt/(R+0.6t) or head formula; MAWP = P - (SH×0.433×SG)',
    intermediateValues: {
      t_actual: input.currentThickness,
      Yn_years: yearsToNextInspection,
      Cr_in_per_yr: corrosionRate,
      '2 × Yn × Cr': round(projectedThicknessLoss, 4),
      t_projected: round(projectedThickness, 4),
      MAP_at_next_inspection: round(mapAtNextInspection, 2),
      static_head_deduction: round(staticHeadDeduction, 2),
      MAWP_at_next_inspection: round(mawpAtNextInspection, 2),
      component_type: componentType,
      head_type: input.headType || 'N/A'
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    calculatedAt
  };
}

/**
 * Calculate Long-Term corrosion rate.
 * 
 * Formula per API 510:
 * CR_LT = (t_nominal - t_current) / Years_in_Service
 */
export function calculateCorrosionRateLongTerm(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.nominalThickness || input.nominalThickness <= 0) {
    return createErrorResult('corrosion_rate_lt', 'Nominal thickness must be > 0', calculatedAt);
  }
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('corrosion_rate_lt', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.yearBuilt) {
    return createErrorResult('corrosion_rate_lt', 'Year built is required for long-term rate', calculatedAt);
  }
  
  const currentYear = input.currentYear || new Date().getFullYear();
  const yearsInService = currentYear - input.yearBuilt;
  
  if (yearsInService <= 0) {
    return createErrorResult('corrosion_rate_lt', 'Years in service must be > 0', calculatedAt);
  }
  
  const thicknessLoss = input.nominalThickness - input.currentThickness;
  
  // Handle apparent thickness growth (measurement error or repair)
  if (thicknessLoss < 0) {
    warnings.push('Apparent thickness growth detected - may indicate measurement error or repair');
    return {
      success: true,
      calculationType: 'corrosion_rate_lt',
      resultValue: 0,
      resultUnit: 'in/yr',
      codeReference: 'API 510 §7.1.1',
      formulaUsed: 'CR_LT = (t_nominal - t_current) / Years_in_Service',
      intermediateValues: {
        t_nominal: input.nominalThickness,
        t_current: input.currentThickness,
        thickness_loss: round(thicknessLoss, 4),
        year_built: input.yearBuilt,
        current_year: currentYear,
        years_in_service: yearsInService,
        CR_LT: 0,
        note: 'Set to 0 due to apparent thickness growth'
      },
      assumptions: ['Apparent growth - rate set to 0 per engineering judgment'],
      warnings,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      materialDatabaseVersion: DATABASE_VERSION,
      calculatedAt,
      validationStatus: 'warning'
    };
  }
  
  const crLT = thicknessLoss / yearsInService;
  
  assumptions.push('Formula per API 510 §7.1.1');
  assumptions.push('Long-term rate calculated from original nominal thickness');
  
  return {
    success: true,
    calculationType: 'corrosion_rate_lt',
    resultValue: round(crLT, 5),
    resultUnit: 'in/yr',
    codeReference: 'API 510 §7.1.1',
    formulaUsed: 'CR_LT = (t_nominal - t_current) / Years_in_Service',
    intermediateValues: {
      t_nominal: input.nominalThickness,
      t_current: input.currentThickness,
      thickness_loss: round(thicknessLoss, 4),
      year_built: input.yearBuilt,
      current_year: currentYear,
      years_in_service: yearsInService,
      CR_LT: round(crLT, 5)
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: 'valid'
  };
}

/**
 * Calculate Short-Term corrosion rate.
 * 
 * Formula per API 510:
 * CR_ST = (t_previous - t_current) / Years_between_inspections
 */
export function calculateCorrosionRateShortTerm(input: CalculationInput): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate required inputs
  if (!input.previousThickness || input.previousThickness <= 0) {
    return createErrorResult('corrosion_rate_st', 'Previous thickness is required for short-term rate', calculatedAt);
  }
  if (!input.currentThickness || input.currentThickness <= 0) {
    return createErrorResult('corrosion_rate_st', 'Current thickness must be > 0', calculatedAt);
  }
  if (!input.previousInspectionDate || !input.currentInspectionDate) {
    return createErrorResult('corrosion_rate_st', 'Both inspection dates are required for short-term rate', calculatedAt);
  }
  
  const daysBetween = Math.abs(
    (input.currentInspectionDate.getTime() - input.previousInspectionDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const yearsBetween = daysBetween / 365.25;
  
  if (yearsBetween <= 0) {
    return createErrorResult('corrosion_rate_st', 'Time between inspections must be > 0', calculatedAt);
  }
  
  const thicknessLoss = input.previousThickness - input.currentThickness;
  
  // Handle apparent thickness growth
  if (thicknessLoss < 0) {
    warnings.push('Apparent thickness growth detected - may indicate measurement error or repair');
    return {
      success: true,
      calculationType: 'corrosion_rate_st',
      resultValue: 0,
      resultUnit: 'in/yr',
      codeReference: 'API 510 §7.1.1',
      formulaUsed: 'CR_ST = (t_previous - t_current) / Years_between_inspections',
      intermediateValues: {
        t_previous: input.previousThickness,
        t_current: input.currentThickness,
        thickness_loss: round(thicknessLoss, 4),
        previous_date: input.previousInspectionDate.toISOString().split('T')[0],
        current_date: input.currentInspectionDate.toISOString().split('T')[0],
        days_between: Math.round(daysBetween),
        years_between: round(yearsBetween, 2),
        CR_ST: 0,
        note: 'Set to 0 due to apparent thickness growth'
      },
      assumptions: ['Apparent growth - rate set to 0 per engineering judgment'],
      warnings,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      materialDatabaseVersion: DATABASE_VERSION,
      calculatedAt,
      validationStatus: 'warning'
    };
  }
  
  const crST = thicknessLoss / yearsBetween;
  
  assumptions.push('Formula per API 510 §7.1.1');
  assumptions.push('Short-term rate calculated between consecutive inspections');
  
  return {
    success: true,
    calculationType: 'corrosion_rate_st',
    resultValue: round(crST, 5),
    resultUnit: 'in/yr',
    codeReference: 'API 510 §7.1.1',
    formulaUsed: 'CR_ST = (t_previous - t_current) / Years_between_inspections',
    intermediateValues: {
      t_previous: input.previousThickness,
      t_current: input.currentThickness,
      thickness_loss: round(thicknessLoss, 4),
      previous_date: input.previousInspectionDate.toISOString().split('T')[0],
      current_date: input.currentInspectionDate.toISOString().split('T')[0],
      days_between: Math.round(daysBetween),
      years_between: round(yearsBetween, 2),
      CR_ST: round(crST, 5)
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: 'valid'
  };
}

/**
 * Calculate remaining life per API 510 §7.1.1.
 * 
 * Formula:
 * Remaining Life = (t_actual - t_required) / Corrosion Rate
 */
export function calculateRemainingLife(
  currentThickness: number,
  tRequired: number,
  corrosionRate: number,
  corrosionRateType: 'LT' | 'ST' | 'GOVERNING'
): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  // Validate inputs
  if (currentThickness <= 0) {
    return createErrorResult('remaining_life', 'Current thickness must be > 0', calculatedAt);
  }
  if (tRequired <= 0) {
    return createErrorResult('remaining_life', 't_required must be > 0', calculatedAt);
  }
  if (corrosionRate <= 0) {
    return createErrorResult('remaining_life', 'Corrosion rate must be > 0', calculatedAt);
  }
  
  const thicknessMargin = currentThickness - tRequired;
  
  if (thicknessMargin <= 0) {
    warnings.push('CRITICAL: Current thickness is at or below t_required - remaining life is 0');
    return {
      success: true,
      calculationType: 'remaining_life',
      resultValue: 0,
      resultUnit: 'years',
      codeReference: 'API 510 §7.1.1',
      formulaUsed: 'Remaining Life = (t_actual - t_required) / Corrosion Rate',
      intermediateValues: {
        t_actual: currentThickness,
        t_required: tRequired,
        thickness_margin: round(thicknessMargin, 4),
        corrosion_rate: corrosionRate,
        corrosion_rate_type: corrosionRateType,
        remaining_life: 0
      },
      assumptions: ['Current thickness at or below minimum - immediate action required'],
      warnings,
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      materialDatabaseVersion: DATABASE_VERSION,
      calculatedAt,
      validationStatus: 'error'
    };
  }
  
  const remainingLife = thicknessMargin / corrosionRate;
  
  assumptions.push('Formula per API 510 §7.1.1');
  assumptions.push(`Using ${corrosionRateType} corrosion rate`);
  
  if (remainingLife < 2) {
    warnings.push(`WARNING: Remaining life (${remainingLife.toFixed(2)} years) is less than 2 years`);
  } else if (remainingLife < 4) {
    warnings.push(`CAUTION: Remaining life (${remainingLife.toFixed(2)} years) is less than 4 years`);
  }
  
  return {
    success: true,
    calculationType: 'remaining_life',
    resultValue: round(remainingLife, 2),
    resultUnit: 'years',
    codeReference: 'API 510 §7.1.1',
    formulaUsed: 'Remaining Life = (t_actual - t_required) / Corrosion Rate',
    intermediateValues: {
      t_actual: currentThickness,
      t_required: tRequired,
      thickness_margin: round(thicknessMargin, 4),
      corrosion_rate: corrosionRate,
      corrosion_rate_type: corrosionRateType,
      remaining_life: round(remainingLife, 2)
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.some(w => w.includes('WARNING')) ? 'warning' : 'valid'
  };
}

/**
 * Calculate next inspection date per API 510 inspection interval rules.
 * 
 * Rules:
 * 1. Internal inspection interval = MIN(Remaining Life / 2, 10 years)
 * 2. Exception: If Remaining Life ≤ 4 years:
 *    - If 2 ≤ Remaining Life ≤ 4 years → Interval = 2 years
 *    - If Remaining Life < 2 years → Interval = Remaining Life
 */
export function calculateNextInspectionInterval(remainingLife: number): CalculationResult {
  const calculatedAt = new Date().toISOString();
  const assumptions: string[] = [];
  const warnings: string[] = [];
  
  let interval: number;
  let inspectionType: string;
  
  if (remainingLife <= 0) {
    interval = 0;
    inspectionType = 'IMMEDIATE - Remaining life exhausted';
    warnings.push('CRITICAL: Immediate inspection required - remaining life exhausted');
  } else if (remainingLife < 2) {
    interval = remainingLife;
    inspectionType = 'Internal (Critical - RL < 2 years)';
    warnings.push(`WARNING: Critical remaining life - inspect within ${remainingLife.toFixed(2)} years`);
  } else if (remainingLife <= 4) {
    interval = 2.0;
    inspectionType = 'Internal (RL ≤ 4 years)';
    assumptions.push('Per API 510: When 2 ≤ RL ≤ 4 years, interval = 2 years');
  } else {
    interval = Math.min(remainingLife / 2, 10.0);
    inspectionType = 'Internal (Standard)';
    assumptions.push('Per API 510: Interval = MIN(RL/2, 10 years)');
  }
  
  assumptions.push('Inspection interval rules per API 510');
  
  return {
    success: true,
    calculationType: 'next_inspection',
    resultValue: round(interval, 2),
    resultUnit: 'years',
    codeReference: 'API 510 Inspection Intervals',
    formulaUsed: 'Interval = MIN(Remaining Life / 2, 10 years) with exceptions for RL ≤ 4 years',
    intermediateValues: {
      remaining_life: remainingLife,
      half_life: round(remainingLife / 2, 2),
      max_interval: 10.0,
      calculated_interval: round(interval, 2),
      inspection_type: inspectionType
    },
    assumptions,
    warnings,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    validationStatus: warnings.length > 0 ? 'warning' : 'valid'
  };
}

/**
 * Perform complete calculation suite for a component.
 */
export function performFullCalculation(input: CalculationInput, componentType: 'Shell' | 'Head'): FullCalculationResult {
  const calculatedAt = new Date().toISOString();
  const warnings: string[] = [];
  
  // ========================================================================
  // VALIDATION GATES - Head-specific parameter checks
  // Per ASME VIII-1 UG-32: Head calculations require specific geometry inputs
  // ========================================================================
  if (componentType === 'Head') {
    // Gate 1: Torispherical heads REQUIRE crownRadius and knuckleRadius
    // (engine will default them, but we warn if missing for audit trail)
    if (input.headType === 'Torispherical') {
      if (!input.crownRadius || input.crownRadius <= 0) {
        warnings.push('VALIDATION: Torispherical head crownRadius (L) not provided - engine will default to L=D per UG-32(e)');
      }
      if (!input.knuckleRadius || input.knuckleRadius <= 0) {
        warnings.push('VALIDATION: Torispherical head knuckleRadius (r) not provided - engine will default to r=0.06D per UG-32(e)');
      }
      // Validate L/r ratio if both provided
      if (input.crownRadius && input.knuckleRadius && input.crownRadius > 0 && input.knuckleRadius > 0) {
        const lrRatio = input.crownRadius / input.knuckleRadius;
        if (lrRatio > 16.67) {
          warnings.push(`VALIDATION: L/r ratio (${lrRatio.toFixed(2)}) exceeds ASME limit of 16.67 - review head geometry`);
        }
      }
    }
    
    // Gate 2: Hemispherical heads need insideRadius (derived from diameter if missing)
    if (input.headType === 'Hemispherical') {
      if (!input.insideRadius && (!input.insideDiameter || input.insideDiameter <= 0)) {
        warnings.push('VALIDATION: Hemispherical head requires insideRadius or insideDiameter');
      }
    }
    
    // Gate 3: Warn if head type is not specified
    if (!input.headType) {
      warnings.push('VALIDATION: Head type not specified - defaulting to 2:1 Ellipsoidal. Specify headType for accurate results.');
    }
  }
  
  // ========================================================================
  // DERIVE corrosionAllowance if not provided
  // CA = t_actual - t_required (computed AFTER t_required calculation)
  // This makes corrosionAllowance a derived value, not a required input
  // ========================================================================
  
  // Calculate t_required based on component type
  let tRequiredResult: CalculationResult;
  
  if (componentType === 'Shell') {
    tRequiredResult = calculateTRequiredShell(input);
  } else {
    // Head calculation based on head type
    switch (input.headType) {
      case '2:1 Ellipsoidal':
        tRequiredResult = calculateTRequiredEllipsoidalHead(input);
        break;
      case 'Torispherical':
        tRequiredResult = calculateTRequiredTorisphericalHead(input);
        break;
      case 'Hemispherical':
        tRequiredResult = calculateTRequiredHemisphericalHead(input);
        break;
      default:
        // Default to ellipsoidal if head type not specified
        tRequiredResult = calculateTRequiredEllipsoidalHead(input);
        warnings.push('Head type not specified - defaulting to 2:1 Ellipsoidal formula');
    }
  }
  
  // Derive corrosionAllowance if not explicitly provided
  if (input.corrosionAllowance === undefined || input.corrosionAllowance === null) {
    if (tRequiredResult.success && tRequiredResult.resultValue !== null && input.currentThickness > 0) {
      const derivedCA = input.currentThickness - tRequiredResult.resultValue;
      input = { ...input, corrosionAllowance: Math.max(0, derivedCA) };
      warnings.push(`Corrosion allowance derived: CA = t_actual (${input.currentThickness.toFixed(4)}") - t_required (${tRequiredResult.resultValue.toFixed(4)}") = ${input.corrosionAllowance!.toFixed(4)}"`);
    } else {
      input = { ...input, corrosionAllowance: 0 };
      warnings.push('Corrosion allowance could not be derived (missing t_required or t_actual) - defaulting to 0');
    }
  }
  
  // Calculate MAWP based on component type
  let mawpResult: CalculationResult;
  
  if (componentType === 'Shell') {
    mawpResult = calculateMAWPShell(input);
  } else {
    switch (input.headType) {
      case 'Hemispherical':
        mawpResult = calculateMAWPHemisphericalHead(input);
        break;
      case 'Torispherical':
        mawpResult = calculateMAWPTorisphericalHead(input);
        break;
      case '2:1 Ellipsoidal':
      default:
        mawpResult = calculateMAWPEllipsoidalHead(input);
        break;
    }
  }
  
  // Calculate corrosion rates
  let corrosionRateLT: CalculationResult | undefined;
  let corrosionRateST: CalculationResult | undefined;
  let remainingLifeResult: CalculationResult | undefined;
  let nextInspectionResult: CalculationResult | undefined;
  let mapAtNextInspectionResult: MAPAtNextInspectionResult | undefined;
  
  // Long-term rate
  if (input.yearBuilt && input.nominalThickness) {
    corrosionRateLT = calculateCorrosionRateLongTerm(input);
  }
  
  // Short-term rate
  if (input.previousThickness && input.previousInspectionDate && input.currentInspectionDate) {
    corrosionRateST = calculateCorrosionRateShortTerm(input);
  }
  
  // Determine governing corrosion rate
  let governingRate: number | null = null;
  let governingRateType: 'LT' | 'ST' | 'GOVERNING' = 'GOVERNING';
  
  if (corrosionRateLT?.success && corrosionRateST?.success) {
    const ltRate = corrosionRateLT.resultValue || 0;
    const stRate = corrosionRateST.resultValue || 0;
    governingRate = Math.max(ltRate, stRate);
    governingRateType = ltRate >= stRate ? 'LT' : 'ST';
  } else if (corrosionRateLT?.success) {
    governingRate = corrosionRateLT.resultValue;
    governingRateType = 'LT';
  } else if (corrosionRateST?.success) {
    governingRate = corrosionRateST.resultValue;
    governingRateType = 'ST';
  }
  
  // Calculate remaining life if we have t_required and corrosion rate
  if (tRequiredResult.success && tRequiredResult.resultValue && governingRate && governingRate > 0) {
    remainingLifeResult = calculateRemainingLife(
      input.currentThickness,
      tRequiredResult.resultValue,
      governingRate,
      governingRateType
    );
    
    // Calculate next inspection interval
    if (remainingLifeResult.success && remainingLifeResult.resultValue !== null) {
      nextInspectionResult = calculateNextInspectionInterval(remainingLifeResult.resultValue);
      
      // Calculate MAP at next inspection
      if (nextInspectionResult.success && nextInspectionResult.resultValue !== null) {
        mapAtNextInspectionResult = calculateMAPAtNextInspection(
          input,
          componentType,
          governingRate,
          nextInspectionResult.resultValue
        );
      }
    }
  }
  
  // Determine overall status
  let status: 'acceptable' | 'marginal' | 'unacceptable' = 'acceptable';
  let statusReason = 'All parameters within acceptable limits';
  
  if (tRequiredResult.resultValue && input.currentThickness < tRequiredResult.resultValue) {
    status = 'unacceptable';
    statusReason = 'Current thickness below minimum required';
  } else if (remainingLifeResult?.resultValue !== null && remainingLifeResult?.resultValue !== undefined) {
    if (remainingLifeResult.resultValue < 2) {
      status = 'unacceptable';
      statusReason = 'Remaining life less than 2 years';
    } else if (remainingLifeResult.resultValue < 4) {
      status = 'marginal';
      statusReason = 'Remaining life less than 4 years';
    }
  }
  
  // Collect all warnings
  if (tRequiredResult.warnings) warnings.push(...tRequiredResult.warnings);
  if (mawpResult.warnings) warnings.push(...mawpResult.warnings);
  if (corrosionRateLT?.warnings) warnings.push(...corrosionRateLT.warnings);
  if (corrosionRateST?.warnings) warnings.push(...corrosionRateST.warnings);
  if (remainingLifeResult?.warnings) warnings.push(...remainingLifeResult.warnings);
  if (nextInspectionResult?.warnings) warnings.push(...nextInspectionResult.warnings);
  if (mapAtNextInspectionResult?.warnings) warnings.push(...mapAtNextInspectionResult.warnings);
  
  return {
    success: tRequiredResult.success && mawpResult.success,
    componentType,
    tRequired: tRequiredResult,
    mawp: mawpResult,
    corrosionRateLT,
    corrosionRateST,
    remainingLife: remainingLifeResult,
    nextInspectionDate: nextInspectionResult,
    mapAtNextInspection: mapAtNextInspectionResult,
    summary: {
      tRequired: tRequiredResult.resultValue,
      mawp: mawpResult.resultValue,
      corrosionRate: governingRate,
      corrosionRateType: governingRateType,
      remainingLife: remainingLifeResult?.resultValue ?? null,
      nextInspectionYears: nextInspectionResult?.resultValue ?? null,
      mapAtNextInspection: mapAtNextInspectionResult?.mawpAtNextInspection ?? null,
      projectedThicknessAtNextInspection: mapAtNextInspectionResult?.projectedThickness ?? null,
      status,
      statusReason
    },
    warnings,
    calculatedAt,
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION
  };
}

// Helper functions

function createErrorResult(calculationType: string, errorMessage: string, calculatedAt: string): CalculationResult {
  return {
    success: false,
    calculationType,
    resultValue: null,
    resultUnit: '',
    codeReference: '',
    formulaUsed: '',
    intermediateValues: {},
    assumptions: [],
    warnings: [],
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    materialDatabaseVersion: DATABASE_VERSION,
    calculatedAt,
    errorMessage,
    validationStatus: 'error'
  };
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Get calculation engine information for audit trail
 */
export function getEngineInfo(): {
  version: string;
  effectiveDate: string;
  materialDatabaseVersion: string;
  supportedCalculations: string[];
} {
  return {
    version: CALCULATION_ENGINE_VERSION,
    effectiveDate: ENGINE_EFFECTIVE_DATE,
    materialDatabaseVersion: DATABASE_VERSION,
    supportedCalculations: [
      't_required_shell (ASME VIII-1 UG-27)',
      't_required_head_ellipsoidal (ASME VIII-1 UG-32(d))',
      't_required_head_torispherical (ASME VIII-1 UG-32(e))',
      't_required_head_hemispherical (ASME VIII-1 UG-32(f))',
      'mawp_shell (ASME VIII-1 UG-27)',
      'mawp_head_hemispherical (ASME VIII-1 UG-32(f))',
      'mawp_head_ellipsoidal (ASME VIII-1 UG-32(d))',
      'mawp_head_torispherical (ASME VIII-1 UG-32(e))',
      'map_at_next_inspection (API 510)',
      'corrosion_rate_lt (API 510)',
      'corrosion_rate_st (API 510)',
      'remaining_life (API 510 §7.1.1)',
      'next_inspection (API 510)'
    ]
  };
}
