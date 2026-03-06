/**
 * API 510 Component Calculations Module
 * Implements ASME Section VIII calculations for pressure vessels
 * 
 * CONSOLIDATION: All ASME formulas delegate to lockedCalculationEngine.ts,
 * the single authoritative source. This module provides the simplified
 * ComponentData → CalculationResults interface used by the professional
 * PDF generator and TML status calculator.
 */

import { calculateExternalPressureMAWP } from './xChartData';
import { getAllowableStressNormalized } from './asmeMaterialDatabase';
import {
  calculateTRequiredShell,
  calculateMAWPShell,
  calculateTRequiredEllipsoidalHead,
  calculateTRequiredTorisphericalHead,
  calculateTRequiredHemisphericalHead,
  calculateMAWPEllipsoidalHead,
  calculateMAWPTorisphericalHead,
  calculateMAWPHemisphericalHead,
  type CalculationInput,
} from './lockedCalculationEngine';

interface ComponentData {
  // Design parameters
  designPressure: number; // P (psi)
  designTemperature: number; // T (°F)
  insideDiameter: number; // ID (inches)
  materialSpec: string;

  // Thickness data
  nominalThickness: number; // tn (inches)
  actualThickness: number; // ta (inches) - minimum measured
  corrosionAllowance: number; // CA (inches)

  // Weld data
  jointEfficiency: number; // E (0.0 - 1.0)

  // For heads
  componentType: "shell" | "head";

  // External pressure
  externalPressure?: boolean; // Is vessel under external pressure/vacuum?
  unsupportedLength?: number; // L (inches) - for external pressure calculations
  headType?: "hemispherical" | "ellipsoidal" | "torispherical";
  knuckleRadius?: number; // r (inches) - for torispherical heads
  crownRadius?: number; // L (inches) - crown radius for torispherical heads

  // Static head (for liquid-filled vessels)
  liquidService?: boolean; // Is vessel in liquid service?
  specificGravity?: number; // SG (dimensionless, water = 1.0)
  liquidHeight?: number; // h (feet) - height of liquid above component

  // Corrosion data
  corrosionRate?: number; // mpy (mils per year)
  previousThickness?: number;
  previousInspectionDate?: Date;
  currentInspectionDate?: Date;
}

interface CalculationResults {
  // Input summary
  component: string;
  designPressure: number;
  designTemperature: number;
  material: string;
  allowableStress: number;

  // Static head (if applicable)
  staticHeadPressure?: number; // psi
  totalDesignPressure?: number; // Design + Static Head (psi)

  // Thickness calculations
  minimumRequiredThickness: number; // tmin (inches)
  actualThickness: number; // ta (inches)
  corrosionAllowance: number; // CA (inches)

  // Pressure calculations
  mawp: number; // Maximum Allowable Working Pressure (psi)

  // Life calculations
  corrosionRate: number; // mpy
  remainingLife: number; // years
  nextInspectionDate: string; // ISO date string

  // External pressure (if applicable)
  externalPressureMAWP?: number; // psi
  factorA?: number;
  factorB?: number;

  // Status
  status: "acceptable" | "monitoring" | "critical";
  statusReason: string;
}

/**
 * Calculate static head pressure for liquid-filled vessels
 * Formula: P_static = (SG × h × 0.433 psi/ft) where:
 * - SG = specific gravity (dimensionless, water = 1.0)
 * - h = liquid height above component (feet)
 * - 0.433 = conversion factor (psi per foot of water)
 */
function calculateStaticHeadPressure(
  specificGravity: number,
  liquidHeight: number
): number {
  // P_static = SG × h × 0.433 psi/ft
  return specificGravity * liquidHeight * 0.433;
}

/**
 * Get allowable stress from ASME Section II Part D
 * Uses the authoritative asmeMaterialDatabase.ts with actual Table 1A values
 * and proper linear interpolation between temperature points.
 * 
 * Falls back to conservative default (SA-516 Gr 70 at room temp) if material
 * not found in database, with a warning logged.
 */
function getAllowableStressFn(materialSpec: string, temperature: number): number {
  const result = getAllowableStressNormalized(materialSpec, temperature);

  if (result.stress !== null) {
    return result.stress;
  }

  // Failure: If material not found in authoritative database, throw instead of guessing
  // Per skills.md: "No guessing. Missing data halts calculations."
  throw new Error(
    `Material '${materialSpec}' not found in ASME database at ${temperature}°F. ` +
    `Calculations halted due to missing allowable stress per regulatory requirements. Error: ${result.message}`
  );
}

// ─── DELEGATED FORMULAS ──────────────────────────────────────────────
// All ASME formulas delegate to lockedCalculationEngine.ts (the single
// authoritative source). This eliminates formula duplication and prevents
// drift bugs like the MAWP CA-deduction issue (FIX-1).

/**
 * Build a CalculationInput for the locked engine from ComponentData + derived values
 */
function buildLockedInput(
  data: ComponentData,
  allowableStress: number,
  effectivePressure: number
): CalculationInput {
  return {
    insideDiameter: data.insideDiameter,
    designPressure: effectivePressure,
    designTemperature: data.designTemperature,
    materialSpec: data.materialSpec,
    allowableStress, // pre-resolved
    jointEfficiency: data.jointEfficiency,
    nominalThickness: data.nominalThickness,
    currentThickness: data.actualThickness,
    corrosionAllowance: data.corrosionAllowance,
    headType: data.headType === "hemispherical" ? "Hemispherical"
      : data.headType === "torispherical" ? "Torispherical"
        : "2:1 Ellipsoidal",
    crownRadius: data.crownRadius,
    knuckleRadius: data.knuckleRadius,
  };
}

/**
 * Calculate minimum required thickness for cylindrical shell
 * DELEGATES to lockedCalculationEngine.calculateTRequiredShell
 */
function calculateShellMinThickness(
  pressure: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  _corrosionAllowance: number
): number {
  const input: CalculationInput = {
    insideDiameter: radius * 2,
    designPressure: pressure,
    designTemperature: 100, // Not used for formula, only for stress lookup
    materialSpec: "",
    allowableStress, // pre-resolved, skips DB lookup
    jointEfficiency,
    nominalThickness: 0,
    currentThickness: 0,
  };
  const result = calculateTRequiredShell(input);
  return result.resultValue ?? 0;
}

/**
 * Calculate minimum required thickness for head
 * DELEGATES to lockedCalculationEngine head functions
 */
export function calculateHeadMinThickness(
  pressure: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  _corrosionAllowance: number,
  headType: string = "ellipsoidal",
  knuckleRadius?: number,
  crownRadius?: number
): number {
  const D = radius * 2;
  const input: CalculationInput = {
    insideDiameter: D,
    designPressure: pressure,
    designTemperature: 100,
    materialSpec: "",
    allowableStress,
    jointEfficiency,
    nominalThickness: 0,
    currentThickness: 0,
    crownRadius: crownRadius && crownRadius > 0 ? crownRadius : undefined,
    knuckleRadius: knuckleRadius && knuckleRadius > 0 ? knuckleRadius : undefined,
  };

  switch (headType.toLowerCase()) {
    case "hemispherical": {
      const r = calculateTRequiredHemisphericalHead(input);
      return r.resultValue ?? 0;
    }
    case "torispherical": {
      const r = calculateTRequiredTorisphericalHead(input);
      return r.resultValue ?? 0;
    }
    case "ellipsoidal":
    default: {
      const r = calculateTRequiredEllipsoidalHead(input);
      return r.resultValue ?? 0;
    }
  }
}

/**
 * Calculate MAWP for cylindrical shell
 * DELEGATES to lockedCalculationEngine.calculateMAWPShell
 */
function calculateShellMAWP(
  thickness: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  _corrosionAllowance: number,
  _Ec?: number
): number {
  const input: CalculationInput = {
    insideDiameter: radius * 2,
    designPressure: 0,
    designTemperature: 100,
    materialSpec: "",
    allowableStress,
    jointEfficiency,
    nominalThickness: thickness,
    currentThickness: thickness,
  };
  const result = calculateMAWPShell(input);
  return result.resultValue ?? 0;
}

/**
 * Calculate MAWP for head
 * DELEGATES to lockedCalculationEngine head MAWP functions
 */
export function calculateHeadMAWP(
  thickness: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  _corrosionAllowance: number,
  headType: string = "ellipsoidal",
  knuckleRadius?: number,
  crownRadius?: number,
  _useUG32eStandard: boolean = false
): number {
  const D = radius * 2;
  const input: CalculationInput = {
    insideDiameter: D,
    designPressure: 0,
    designTemperature: 100,
    materialSpec: "",
    allowableStress,
    jointEfficiency,
    nominalThickness: thickness,
    currentThickness: thickness,
    crownRadius: crownRadius && crownRadius > 0 ? crownRadius : undefined,
    knuckleRadius: knuckleRadius && knuckleRadius > 0 ? knuckleRadius : undefined,
  };

  switch (headType.toLowerCase()) {
    case "hemispherical": {
      const r = calculateMAWPHemisphericalHead(input);
      return r.resultValue ?? 0;
    }
    case "torispherical": {
      const r = calculateMAWPTorisphericalHead(input);
      return r.resultValue ?? 0;
    }
    case "ellipsoidal":
    default: {
      const r = calculateMAWPEllipsoidalHead(input);
      return r.resultValue ?? 0;
    }
  }
}

/**
 * Calculate remaining life and next inspection date
 * Per skills.md: Missing data halts calculations - do not guess or auto-fill
 * 
 * Returns remainingLife = -1 when corrosion rate is zero/missing to indicate
 * "Insufficient data" rather than assuming unlimited life
 */
function calculateRemainingLife(
  actualThickness: number,
  minThickness: number,
  corrosionRate: number
): { remainingLife: number, nextInspectionDate: Date, insufficientData: boolean } {
  if (corrosionRate <= 0) {
    // Per skills.md: Do not assume unlimited life when corrosion rate is missing
    // Return -1 to indicate "Insufficient corrosion data to calculate remaining life"
    return {
      remainingLife: -1, // Indicates insufficient data
      nextInspectionDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // Default 10 years per API 510 max interval
      insufficientData: true
    };
  }

  // Convert mpy to inches per year
  const corrosionRateInches = corrosionRate / 1000;

  // Remaining life = (ta - tmin) / corrosion rate
  const remainingLife = (actualThickness - minThickness) / corrosionRateInches;

  // Next inspection = Current date + (Remaining Life / 2) per API 510
  const halfLife = Math.max(remainingLife / 2, 1); // At least 1 year
  const nextInspection = new Date(Date.now() + halfLife * 365 * 24 * 60 * 60 * 1000);

  return {
    remainingLife: Math.max(remainingLife, 0),
    nextInspectionDate: nextInspection,
    insufficientData: false
  };
}

/**
 * Main calculation function
 */
export function calculateComponent(data: ComponentData): CalculationResults {
  const radius = data.insideDiameter / 2;
  const allowableStress = getAllowableStressFn(data.materialSpec, data.designTemperature);

  // Calculate static head pressure if applicable
  let staticHeadPressure = 0;
  let totalDesignPressure = data.designPressure;

  if (data.liquidService && data.specificGravity && data.liquidHeight) {
    staticHeadPressure = calculateStaticHeadPressure(
      data.specificGravity,
      data.liquidHeight
    );
    totalDesignPressure = data.designPressure + staticHeadPressure;
  }

  // Use total design pressure (including static head) for calculations
  const effectivePressure = totalDesignPressure;

  // Calculate minimum required thickness
  let minThickness: number;
  let mawp: number;
  let externalPressureMAWP: number | undefined;
  let factorA: number | undefined;
  let factorB: number | undefined;

  // Handle external pressure calculations
  if (data.externalPressure && data.componentType === "shell" && data.unsupportedLength) {
    const Do = data.insideDiameter + 2 * data.actualThickness;
    const result = calculateExternalPressureMAWP(
      Do,
      data.actualThickness,
      data.unsupportedLength
    );
    externalPressureMAWP = result.mawp;
    factorA = result.factorA;
    factorB = result.factorB;

    // For external pressure, use simplified minimum thickness approach
    // In practice, this would require iterative calculation
    minThickness = data.actualThickness; // Placeholder
    mawp = result.mawp;
  } else if (data.componentType === "shell") {
    minThickness = calculateShellMinThickness(
      effectivePressure,
      radius,
      allowableStress,
      data.jointEfficiency,
      data.corrosionAllowance
    );
    mawp = calculateShellMAWP(
      data.actualThickness,
      radius,
      allowableStress,
      data.jointEfficiency,
      data.corrosionAllowance
    );
  } else {
    minThickness = calculateHeadMinThickness(
      effectivePressure,
      radius,
      allowableStress,
      data.jointEfficiency,
      data.corrosionAllowance,
      data.headType,
      data.knuckleRadius
    );
    mawp = calculateHeadMAWP(
      data.actualThickness,
      radius,
      allowableStress,
      data.jointEfficiency,
      data.corrosionAllowance,
      data.headType,
      data.knuckleRadius
    );
  }

  // Calculate remaining life
  const corrosionRate = data.corrosionRate || 0;
  const { remainingLife, nextInspectionDate } = calculateRemainingLife(
    data.actualThickness,
    minThickness,
    corrosionRate
  );

  // Determine status
  let status: "acceptable" | "monitoring" | "critical";
  let statusReason: string;

  if (data.actualThickness < minThickness) {
    status = "critical";
    statusReason = `Actual thickness (${data.actualThickness.toFixed(4)}") is below minimum required (${minThickness.toFixed(4)}")`;
  } else if (data.actualThickness < minThickness + data.corrosionAllowance * 0.5) {
    status = "monitoring";
    statusReason = `Actual thickness (${data.actualThickness.toFixed(4)}") is within 50% of minimum required (${minThickness.toFixed(4)}")`;
  } else {
    status = "acceptable";
    statusReason = `Actual thickness (${data.actualThickness.toFixed(4)}") exceeds minimum required (${minThickness.toFixed(4)}")`;
  }

  return {
    component: data.componentType === "shell" ? "Cylindrical Shell" : `${data.headType || "Ellipsoidal"} Head`,
    designPressure: data.designPressure,
    designTemperature: data.designTemperature,
    material: data.materialSpec,
    allowableStress,
    staticHeadPressure: staticHeadPressure > 0 ? staticHeadPressure : undefined,
    totalDesignPressure: staticHeadPressure > 0 ? totalDesignPressure : undefined,
    minimumRequiredThickness: minThickness,
    actualThickness: data.actualThickness,
    corrosionAllowance: data.corrosionAllowance,
    mawp,
    externalPressureMAWP,
    factorA,
    factorB,
    corrosionRate,
    remainingLife,
    nextInspectionDate: nextInspectionDate.toISOString(),
    status,
    statusReason
  };
}

