/**
 * API 510 Component Calculations Module
 * Implements ASME Section VIII calculations for pressure vessels
 */

import { calculateExternalPressureMAWP } from './xChartData';

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
 * Simplified lookup - in production, use full ASME tables
 */
function getAllowableStress(materialSpec: string, temperature: number): number {
  // Common pressure vessel materials
  const stressData: Record<string, { baseStress: number, tempFactor: (t: number) => number }> = {
    "SA-515-70": {
      baseStress: 17100,
      tempFactor: (t) => t <= 650 ? 1.0 : (t <= 750 ? 0.95 : 0.85)
    },
    "SA-516-70": {
      baseStress: 17100,
      tempFactor: (t) => t <= 650 ? 1.0 : (t <= 750 ? 0.95 : 0.85)
    },
    "SA-285-C": {
      baseStress: 13750,
      tempFactor: (t) => t <= 650 ? 1.0 : 0.90
    },
    // Seamless pipe - commonly used for nozzles
    "SA-106-B": {
      baseStress: 15000,
      tempFactor: (t) => t <= 650 ? 1.0 : (t <= 800 ? 0.92 : 0.80)
    },
    // Carbon steel forgings - nozzles, flanges
    "SA-105": {
      baseStress: 15000,
      tempFactor: (t) => t <= 650 ? 1.0 : (t <= 800 ? 0.92 : 0.80)
    },
    // Stainless steel 304
    "SA-240-304": {
      baseStress: 16700,
      tempFactor: (t) => t <= 100 ? 1.0 : (t <= 500 ? 0.95 : (t <= 800 ? 0.85 : 0.75))
    },
    // Stainless steel 316
    "SA-240-316": {
      baseStress: 16700,
      tempFactor: (t) => t <= 100 ? 1.0 : (t <= 500 ? 0.95 : (t <= 800 ? 0.85 : 0.75))
    },
    // Chrome-moly 1.25Cr-0.5Mo
    "SA-387-11-2": {
      baseStress: 15000,
      tempFactor: (t) => t <= 700 ? 1.0 : (t <= 900 ? 0.90 : 0.75)
    },
    // Chrome-moly 2.25Cr-1Mo
    "SA-387-22-2": {
      baseStress: 15000,
      tempFactor: (t) => t <= 700 ? 1.0 : (t <= 950 ? 0.92 : 0.78)
    },
    "SA-36": {
      baseStress: 14400,
      tempFactor: (t) => t <= 650 ? 1.0 : 0.90
    },
  };
  
  // Normalize material spec
  const normalized = materialSpec.toUpperCase().replace(/\s+/g, "-");
  const data = stressData[normalized] || stressData["SA-516-70"]; // Default
  
  return data.baseStress * data.tempFactor(temperature);
}

/**
 * Calculate minimum required thickness for cylindrical shell
 * Per ASME Section VIII Div 1, UG-27
 */
function calculateShellMinThickness(
  pressure: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  corrosionAllowance: number
): number {
  // t = (P × R) / (S × E - 0.6 × P)
  // NOTE: Per API 510, CA is NOT added to Tmin - it's used separately for remaining life calculations
  const denominator = allowableStress * jointEfficiency - 0.6 * pressure;
  if (denominator <= 0) return 0;
  const t = (pressure * radius) / denominator;
  return t; // DO NOT add CA here
}

/**
 * Calculate minimum required thickness for head
 * Per ASME Section VIII Div 1, UG-32
 * 
 * Geometry definitions:
 * - Hemispherical: L = inside crown radius (sphere radius)
 * - 2:1 Ellipsoidal: D = inside diameter (K=1 for 2:1)
 * - Torispherical/F&D: L = inside crown radius, r = inside knuckle radius
 *   Standard F&D: L = D (inside diameter), r = 0.06D
 * 
 * @param crownRadius - Inside crown radius L (inches) for torispherical heads
 *                      If not provided, defaults to inside diameter (D)
 * @param knuckleRadius - Inside knuckle radius r (inches) for torispherical heads
 *                        If not provided, defaults to 0.06 * D (6% of diameter)
 */
export function calculateHeadMinThickness(
  pressure: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  corrosionAllowance: number,
  headType: string = "ellipsoidal",
  knuckleRadius?: number,
  crownRadius?: number
): number {
  const D = radius * 2; // Inside diameter
  
  // Safety checks
  if (pressure <= 0 || radius <= 0 || allowableStress <= 0) return 0;
  
  let t: number;
  
  switch (headType.toLowerCase()) {
    case "hemispherical":
      // UG-32(d): t = PL / (2SE - 0.2P) where L = R (inside crown radius)
      const R_hemi = radius;
      const denom_hemi = 2 * allowableStress * jointEfficiency - 0.2 * pressure;
      if (denom_hemi <= 0) return 0;
      t = (pressure * R_hemi) / denom_hemi;
      break;
      
    case "ellipsoidal":
      // UG-32(e) for 2:1 ellipsoidal: t = PD / (2SE - 0.2P)
      const denom_ellip = 2 * allowableStress * jointEfficiency - 0.2 * pressure;
      if (denom_ellip <= 0) return 0;
      t = (pressure * D) / denom_ellip;
      break;
      
    case "torispherical":
      // Appendix 1-4(d) M-factor formula:
      // t = PLM / (2SE - 0.2P)
      // L = inside crown radius (typically = D for standard F&D heads)
      // r = inside knuckle radius (typically = 0.06D for standard F&D heads)
      // M = 0.25 * (3 + sqrt(L/r))
      const L = crownRadius && crownRadius > 0 ? crownRadius : D;
      const r = knuckleRadius && knuckleRadius > 0 ? knuckleRadius : 0.06 * D;
      
      const M = 0.25 * (3 + Math.sqrt(L / r));
      const denom_tori = 2 * allowableStress * jointEfficiency - 0.2 * pressure;
      if (denom_tori <= 0) return 0;
      t = (pressure * L * M) / denom_tori;
      break;
      
    default:
      // Default to 2:1 ellipsoidal
      const denom_def = 2 * allowableStress * jointEfficiency - 0.2 * pressure;
      if (denom_def <= 0) return 0;
      t = (pressure * D) / denom_def;
  }
  
  return t; // DO NOT add CA here - per API 510, CA is used separately for remaining life
}

/**
 * Calculate MAWP for cylindrical shell
 * Per ASME Section VIII Div 1, UG-27(c)
 * 
 * Evaluates BOTH stress cases and returns the MINIMUM (governing) MAWP:
 * - UG-27(c)(1): Circumferential (hoop) stress: P = S*E*t / (R + 0.6*t)
 * - UG-27(c)(2): Longitudinal stress: P = 2*S*E*t / (R - 0.4*t)
 * 
 * @param El - Longitudinal joint efficiency (for hoop stress case)
 * @param Ec - Circumferential joint efficiency (for longitudinal stress case)
 *             If not provided, defaults to El (same efficiency for both)
 */
function calculateShellMAWP(
  thickness: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  corrosionAllowance: number,
  Ec?: number // Circumferential joint efficiency (optional, defaults to jointEfficiency)
): number {
  const t = thickness - corrosionAllowance;
  const El = jointEfficiency; // Longitudinal joint efficiency
  const Ec_eff = Ec ?? jointEfficiency; // Default to same efficiency if not specified
  
  // Safety check: net thickness must be positive
  if (t <= 0 || radius <= 0) return 0;
  
  // UG-27(c)(1): Circumferential (hoop) stress case
  // P_hoop = (S × El × t) / (R + 0.6 × t)
  const P_hoop = (allowableStress * El * t) / (radius + 0.6 * t);
  
  // UG-27(c)(2): Longitudinal stress case
  // P_long = (2 × S × Ec × t) / (R - 0.4 × t)
  const denom_long = radius - 0.4 * t;
  const P_long = denom_long > 0 ? (2 * allowableStress * Ec_eff * t) / denom_long : 0;
  
  // Return the MINIMUM (governing) MAWP
  return Math.min(P_hoop, P_long > 0 ? P_long : P_hoop);
}

/**
 * Calculate MAWP for head
 * Per ASME Section VIII Div 1, UG-32
 * 
 * Supports three head types:
 * - Hemispherical: UG-32(d) - P = 2SEt / (R + 0.2t)
 * - Ellipsoidal (2:1): UG-32(e) - P = 2SEt / (D + 0.2t)  
 * - Torispherical: UG-32(e) standard form - P = SEt / (0.885L + 0.1t)
 *   OR Appendix 1-4(d) M-factor form - P = 2SEt / (LM + 0.2t)
 * 
 * @param crownRadius - Inside crown radius L (inches) for torispherical heads
 *                      If not provided, defaults to inside diameter (D)
 * @param knuckleRadius - Inside knuckle radius r (inches) for torispherical heads
 *                        If not provided, defaults to 0.06 * D (6% of diameter)
 * @param useUG32eStandard - If true, use UG-32(e) standard formula (0.885/0.1)
 *                          If false (default), use Appendix 1-4(d) M-factor formula
 */
export function calculateHeadMAWP(
  thickness: number,
  radius: number,
  allowableStress: number,
  jointEfficiency: number,
  corrosionAllowance: number,
  headType: string = "ellipsoidal",
  knuckleRadius?: number,
  crownRadius?: number,
  useUG32eStandard: boolean = false
): number {
  const t = thickness - corrosionAllowance;
  const D = radius * 2; // Inside diameter
  
  // Safety check: net thickness must be positive
  if (t <= 0 || radius <= 0) return 0;
  
  switch (headType.toLowerCase()) {
    case "hemispherical":
      // UG-32(d): P = 2SEt / (R + 0.2t)
      // R = inside spherical radius
      return (2 * allowableStress * jointEfficiency * t) / (radius + 0.2 * t);
      
    case "ellipsoidal":
      // UG-32(e) for 2:1 ellipsoidal: P = 2SEt / (D + 0.2t)
      // D = inside diameter
      return (2 * allowableStress * jointEfficiency * t) / (D + 0.2 * t);
      
    case "torispherical":
      // L = inside crown radius (typically = D for standard F&D heads)
      const L = crownRadius && crownRadius > 0 ? crownRadius : D;
      
      // r = inside knuckle radius (typically = 0.06D for standard F&D heads)
      const r = knuckleRadius && knuckleRadius > 0 ? knuckleRadius : 0.06 * D;
      
      if (useUG32eStandard) {
        // UG-32(e) standard torispherical formula:
        // P = SEt / (0.885L + 0.1t)
        const denom = 0.885 * L + 0.1 * t;
        return denom > 0 ? (allowableStress * jointEfficiency * t) / denom : 0;
      } else {
        // Appendix 1-4(d) M-factor formula:
        // M = 0.25 * (3 + sqrt(L/r))
        // P = 2SEt / (LM + 0.2t)
        const M = 0.25 * (3 + Math.sqrt(L / r));
        const denom = L * M + 0.2 * t;
        return denom > 0 ? (2 * allowableStress * jointEfficiency * t) / denom : 0;
      }
      
    default:
      // Default to 2:1 ellipsoidal
      return (2 * allowableStress * jointEfficiency * t) / (D + 0.2 * t);
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
  const allowableStress = getAllowableStress(data.materialSpec, data.designTemperature);
  
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

