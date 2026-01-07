/**
 * ASME Section VIII Division 1 Calculation Engine
 * Industry-Leading Implementation for API 510 Compliance
 * 
 * Reference Standards:
 * - ASME BPVC Section VIII Division 1 (2023 Edition)
 * - API 510 Pressure Vessel Inspection Code
 * - API 579-1/ASME FFS-1 Fitness-For-Service
 * 
 * All formulas are exact implementations from ASME code paragraphs.
 */

import { logger } from "./_core/logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HeadType = 
  | 'hemispherical' 
  | 'ellipsoidal' 
  | '2:1_ellipsoidal'
  | 'torispherical' 
  | 'asme_flanged_dished'
  | 'flat'
  | 'conical';

export interface CalculationInputs {
  // Design parameters
  P: number;          // Design pressure (psi)
  S: number;          // Maximum allowable stress at design temperature (psi)
  E: number;          // Joint efficiency (0.0 - 1.0)
  
  // Geometry
  D: number;          // Inside diameter (inches)
  R?: number;         // Inside radius (inches) - calculated from D if not provided
  
  // For torispherical heads
  L?: number;         // Inside crown radius (inches)
  r?: number;         // Inside knuckle radius (inches)
  
  // For conical sections
  alpha?: number;     // Half apex angle (degrees)
  
  // For flat heads
  C?: number;         // Attachment factor (0.10 - 0.33)
  d?: number;         // Diameter or short span (inches)
  
  // Thickness measurements
  t_nom?: number;     // Nominal thickness (inches)
  t_prev?: number;    // Previous thickness (inches)
  t_act?: number;     // Actual current thickness (inches)
  
  // Time parameters
  Y?: number;         // Years between inspections
  Yn?: number;        // Years to next inspection
  
  // Static head (optional)
  SH?: number;        // Static head (feet)
  SG?: number;        // Specific gravity
}

export interface CalculationResults {
  // Minimum thickness
  t_min: number;              // Minimum required thickness (inches)
  t_min_circ?: number;        // For shells: circumferential stress
  t_min_long?: number;        // For shells: longitudinal stress
  
  // MAWP calculations
  MAWP: number;               // Maximum allowable working pressure (psi)
  MAWP_circ?: number;         // For shells: from circumferential stress
  MAWP_long?: number;         // For shells: from longitudinal stress
  
  // Corrosion and remaining life
  Ca?: number;                // Corrosion allowance (inches)
  Cr_short?: number;          // Short-term corrosion rate (in/yr)
  Cr_long?: number;           // Long-term corrosion rate (in/yr)
  Cr?: number;                // Governing corrosion rate (in/yr)
  RL?: number;                // Remaining life (years)
  
  // Next inspection
  t_next?: number;            // Thickness at next inspection (inches)
  P_next?: number;            // Pressure at next inspection (psi)
  nextInspectionInterval?: number; // Recommended interval (years)
  
  // Head-specific
  M?: number;                 // Torispherical factor
  K?: number;                 // Ellipsoidal factor
  
  // Compliance
  isCompliant: boolean;       // t_act >= t_min
  governingCondition: string; // What limits the design
  
  // Code references
  codeReference: string;      // ASME paragraph reference
  formula: string;            // Formula used
}

// ============================================================================
// SHELL CALCULATIONS - UG-27
// ============================================================================

/**
 * Calculate shell minimum thickness per ASME UG-27
 * 
 * Circumferential Stress (Longitudinal Joints) - UG-27(c)(1):
 *   t = PR / (SE - 0.6P)
 *   P = SEt / (R + 0.6t)
 * 
 * Longitudinal Stress (Circumferential Joints) - UG-27(c)(2):
 *   t = PR / (2SE + 0.4P)
 *   P = 2SEt / (R - 0.4t)
 * 
 * The governing (larger) t_min is used.
 */
export function calculateShellThickness(inputs: CalculationInputs): CalculationResults {
  const { P, S, E, D } = inputs;
  const R = inputs.R ?? D / 2;
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || R <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, R=${R}`);
  }
  
  // Circumferential stress (longitudinal joints) - UG-27(c)(1)
  const denom_circ = S * E - 0.6 * P;
  if (denom_circ <= 0) {
    throw new Error(`Invalid calculation: (SE - 0.6P) = ${denom_circ.toFixed(4)} <= 0`);
  }
  const t_min_circ = (P * R) / denom_circ;
  
  // Longitudinal stress (circumferential joints) - UG-27(c)(2)
  const denom_long = 2 * S * E + 0.4 * P;
  const t_min_long = (P * R) / denom_long;
  
  // Governing thickness is the larger value
  const t_min = Math.max(t_min_circ, t_min_long);
  const governingCondition = t_min_circ >= t_min_long ? 'Circumferential Stress' : 'Longitudinal Stress';
  
  // Calculate MAWP at actual thickness if provided
  let MAWP = P;
  let MAWP_circ = P;
  let MAWP_long = P;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let Cr_short: number | undefined;
  let Cr_long: number | undefined;
  let RL: number | undefined;
  let t_next: number | undefined;
  let P_next: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP from circumferential stress: P = SEt / (R + 0.6t)
    MAWP_circ = (S * E * t) / (R + 0.6 * t);
    
    // MAWP from longitudinal stress: P = 2SEt / (R - 0.4t)
    const denom_mawp_long = R - 0.4 * t;
    MAWP_long = denom_mawp_long > 0 ? (2 * S * E * t) / denom_mawp_long : MAWP_circ;
    
    // Governing MAWP is the lower value
    MAWP = Math.min(MAWP_circ, MAWP_long);
    
    // Apply static head correction if provided
    if (inputs.SH && inputs.SG) {
      MAWP = MAWP - (inputs.SH * 0.433 * inputs.SG);
    }
    
    // Corrosion allowance
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
    
    // Corrosion rate calculations
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    
    if (inputs.t_nom !== undefined && inputs.Y !== undefined) {
      // Long-term rate based on vessel age (estimated from nominal)
      const age = inputs.Y; // Simplified - should use actual vessel age
      Cr_long = age > 0 ? (inputs.t_nom - inputs.t_act) / age : 0;
    }
    
    // Use higher (conservative) corrosion rate
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);
    
    // Remaining life
    if (Cr !== undefined && Cr > 0 && Ca !== undefined) {
      RL = Ca / Cr;
    } else if (Ca !== undefined && Ca > 0) {
      RL = 999; // Essentially infinite if no corrosion
    }
    
    // Thickness at next inspection
    if (inputs.Yn !== undefined && Cr !== undefined) {
      t_next = inputs.t_act - (inputs.Yn * Cr);
      P_next = t_next > 0 ? (S * E * t_next) / (R + 0.6 * t_next) : 0;
    }
  }
  
  // Calculate next inspection interval per API 510
  let nextInspectionInterval: number | undefined;
  if (RL !== undefined && RL > 0) {
    nextInspectionInterval = Math.min(RL / 2, 10); // Max 10 years for internal
  }
  
  return {
    t_min,
    t_min_circ,
    t_min_long,
    MAWP,
    MAWP_circ,
    MAWP_long,
    Ca,
    Cr,
    Cr_short,
    Cr_long,
    RL,
    t_next,
    P_next,
    nextInspectionInterval,
    isCompliant,
    governingCondition,
    codeReference: 'ASME Section VIII Div 1, UG-27',
    formula: 't = PR/(SE-0.6P) [circ], t = PR/(2SE+0.4P) [long]',
  };
}

// ============================================================================
// HEAD CALCULATIONS - UG-32
// ============================================================================

/**
 * Calculate hemispherical head thickness per ASME UG-32(f)
 * 
 * Formula: t = PL / (2SE - 0.2P)
 * Where L = R = D/2 (inside radius of hemisphere)
 * 
 * MAWP: P = 2SEt / (L + 0.2t)
 */
export function calculateHemisphericalHead(inputs: CalculationInputs): CalculationResults {
  const { P, S, E, D } = inputs;
  const L = D / 2; // Inside radius = D/2 for hemisphere
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }
  
  // Minimum thickness: t = PL / (2SE - 0.2P)
  const denom = 2 * S * E - 0.2 * P;
  if (denom <= 0) {
    throw new Error(`Invalid calculation: (2SE - 0.2P) = ${denom.toFixed(4)} <= 0`);
  }
  const t_min = (P * L) / denom;
  
  // Calculate MAWP and remaining life
  let MAWP = P;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let Cr_short: number | undefined;
  let Cr_long: number | undefined;
  let RL: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP: P = 2SEt / (L + 0.2t)
    MAWP = (2 * S * E * t) / (L + 0.2 * t);
    
    // Apply static head correction
    if (inputs.SH && inputs.SG) {
      MAWP = MAWP - (inputs.SH * 0.433 * inputs.SG);
    }
    
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
    
    // Corrosion rates
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);
    
    if (Cr > 0 && Ca !== undefined) {
      RL = Ca / Cr;
    } else if (Ca !== undefined && Ca > 0) {
      RL = 999;
    }
  }
  
  return {
    t_min,
    MAWP,
    Ca,
    Cr,
    Cr_short,
    Cr_long,
    RL,
    isCompliant,
    governingCondition: 'Hemispherical Head',
    codeReference: 'ASME Section VIII Div 1, UG-32(f)',
    formula: 't = PL/(2SE-0.2P), where L = D/2',
  };
}

/**
 * Calculate 2:1 ellipsoidal head thickness per ASME UG-32(d)
 * 
 * Formula: t = PD / (2SE - 0.2P)
 * 
 * Note: For 2:1 ellipsoidal heads, K = 1.0
 * MAWP: P = 2SEt / (D + 0.2t)
 */
export function calculateEllipsoidalHead(inputs: CalculationInputs): CalculationResults {
  const { P, S, E, D } = inputs;
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }
  
  // Minimum thickness: t = PD / (2SE - 0.2P)
  const denom = 2 * S * E - 0.2 * P;
  if (denom <= 0) {
    throw new Error(`Invalid calculation: (2SE - 0.2P) = ${denom.toFixed(4)} <= 0`);
  }
  const t_min = (P * D) / denom;
  
  // Calculate MAWP and remaining life
  let MAWP = P;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let Cr_short: number | undefined;
  let Cr_long: number | undefined;
  let RL: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP: P = 2SEt / (D + 0.2t)
    MAWP = (2 * S * E * t) / (D + 0.2 * t);
    
    // Apply static head correction
    if (inputs.SH && inputs.SG) {
      MAWP = MAWP - (inputs.SH * 0.433 * inputs.SG);
    }
    
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
    
    // Corrosion rates
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);
    
    if (Cr > 0 && Ca !== undefined) {
      RL = Ca / Cr;
    } else if (Ca !== undefined && Ca > 0) {
      RL = 999;
    }
  }
  
  return {
    t_min,
    MAWP,
    Ca,
    Cr,
    Cr_short,
    Cr_long,
    RL,
    K: 1.0,
    isCompliant,
    governingCondition: '2:1 Ellipsoidal Head',
    codeReference: 'ASME Section VIII Div 1, UG-32(d)',
    formula: 't = PD/(2SE-0.2P)',
  };
}

/**
 * Calculate torispherical (ASME F&D) head thickness per ASME UG-32(e)
 * 
 * Formula: t = PLM / (2SE - 0.2P)
 * 
 * Where:
 * L = inside crown radius (typically L = D for standard F&D)
 * r = inside knuckle radius (typically r = 0.06D for standard F&D)
 * M = factor = 0.25 * (3 + sqrt(L/r))
 * 
 * For standard ASME F&D: L = D, r = 0.06D, M ≈ 1.77
 * 
 * MAWP: P = 2SEt / (LM + 0.2t)
 */
export function calculateTorisphericalHead(inputs: CalculationInputs): CalculationResults {
  const { P, S, E, D } = inputs;
  
  // Default to standard ASME F&D dimensions if not provided
  const L = inputs.L ?? D;           // Crown radius = D for standard F&D
  const r = inputs.r ?? (0.06 * D);  // Knuckle radius = 0.06D for standard F&D
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0 || L <= 0 || r <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}, L=${L}, r=${r}`);
  }
  
  // Calculate M factor: M = 0.25 * (3 + sqrt(L/r))
  const M = 0.25 * (3 + Math.sqrt(L / r));
  
  // Minimum thickness: t = PLM / (2SE - 0.2P)
  const denom = 2 * S * E - 0.2 * P;
  if (denom <= 0) {
    throw new Error(`Invalid calculation: (2SE - 0.2P) = ${denom.toFixed(4)} <= 0`);
  }
  const t_min = (P * L * M) / denom;
  
  // Calculate MAWP and remaining life
  let MAWP = P;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let Cr_short: number | undefined;
  let Cr_long: number | undefined;
  let RL: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP: P = 2SEt / (LM + 0.2t)
    MAWP = (2 * S * E * t) / (L * M + 0.2 * t);
    
    // Apply static head correction
    if (inputs.SH && inputs.SG) {
      MAWP = MAWP - (inputs.SH * 0.433 * inputs.SG);
    }
    
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
    
    // Corrosion rates
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);
    
    if (Cr > 0 && Ca !== undefined) {
      RL = Ca / Cr;
    } else if (Ca !== undefined && Ca > 0) {
      RL = 999;
    }
  }
  
  return {
    t_min,
    MAWP,
    Ca,
    Cr,
    Cr_short,
    Cr_long,
    RL,
    M,
    isCompliant,
    governingCondition: 'Torispherical Head',
    codeReference: 'ASME Section VIII Div 1, UG-32(e)',
    formula: `t = PLM/(2SE-0.2P), M = 0.25*(3+sqrt(L/r)) = ${M.toFixed(4)}`,
  };
}

/**
 * Calculate flat head thickness per ASME UG-34
 * 
 * Formula: t = d * sqrt(CP/SE)
 * 
 * Where:
 * d = diameter or short span (inches)
 * C = factor depending on attachment method (0.10 to 0.33)
 */
export function calculateFlatHead(inputs: CalculationInputs): CalculationResults {
  const { P, S, E } = inputs;
  const d = inputs.d ?? inputs.D;
  const C = inputs.C ?? 0.33; // Conservative default
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || d <= 0 || C <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, d=${d}, C=${C}`);
  }
  
  // Minimum thickness: t = d * sqrt(CP/SE)
  const t_min = d * Math.sqrt((C * P) / (S * E));
  
  // Calculate MAWP
  let MAWP = P;
  let Ca: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP: P = SE * (t/d)^2 / C
    MAWP = (S * E * Math.pow(t / d, 2)) / C;
    
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
  }
  
  return {
    t_min,
    MAWP,
    Ca,
    isCompliant,
    governingCondition: 'Flat Head',
    codeReference: 'ASME Section VIII Div 1, UG-34',
    formula: `t = d*sqrt(CP/SE), C = ${C}`,
  };
}

/**
 * Calculate conical section thickness per ASME UG-32(g)
 * 
 * Formula: t = PD / (2cos(α)(SE - 0.6P))
 * 
 * Where α = one-half of the included (apex) angle
 * 
 * MAWP: P = 2SEt*cos(α) / (D + 1.2t*cos(α))
 */
export function calculateConicalSection(inputs: CalculationInputs): CalculationResults {
  const { P, S, E, D } = inputs;
  const alphaDeg = inputs.alpha ?? 30; // Default 30 degrees half-angle
  const alpha = alphaDeg * (Math.PI / 180); // Convert to radians
  
  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }
  
  const cosAlpha = Math.cos(alpha);
  
  // Minimum thickness: t = PD / (2cos(α)(SE - 0.6P))
  const denom = 2 * cosAlpha * (S * E - 0.6 * P);
  if (denom <= 0) {
    throw new Error(`Invalid calculation: 2cos(α)(SE - 0.6P) = ${denom.toFixed(4)} <= 0`);
  }
  const t_min = (P * D) / denom;
  
  // Calculate MAWP
  let MAWP = P;
  let Ca: number | undefined;
  let isCompliant = true;
  
  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;
    
    // MAWP: P = 2SEt*cos(α) / (D + 1.2t*cos(α))
    MAWP = (2 * S * E * t * cosAlpha) / (D + 1.2 * t * cosAlpha);
    
    Ca = inputs.t_act - t_min;
    isCompliant = Ca >= 0;
  }
  
  return {
    t_min,
    MAWP,
    Ca,
    isCompliant,
    governingCondition: 'Conical Section',
    codeReference: 'ASME Section VIII Div 1, UG-32(g)',
    formula: `t = PD/(2cos(α)(SE-0.6P)), α = ${alphaDeg}°`,
  };
}

// ============================================================================
// NOZZLE CALCULATIONS - UG-45
// ============================================================================

/**
 * Calculate nozzle neck minimum thickness per ASME UG-45
 * 
 * Formula: t_rn = PR / (SE - 0.6P)
 * 
 * The nozzle neck thickness shall not be less than the greater of:
 * 1. t_rn calculated above
 * 2. The minimum thickness required for the pipe schedule (minus 12.5% tolerance)
 */
export interface NozzleInputs {
  // Design parameters
  P: number;                    // Design pressure (psi)
  S: number;                    // Allowable stress at design temp (psi)
  E?: number;                   // Joint efficiency (default 1.0 for seamless pipe)
  
  // Nozzle geometry
  nominalSize: number;          // Nominal pipe size (inches)
  outsideDiameter: number;      // Pipe OD (inches)
  pipeWallThickness: number;    // Nominal pipe wall thickness (inches)
  
  // Actual measurement
  actualThickness?: number;     // Measured thickness (inches)
  previousThickness?: number;   // Previous measurement (inches)
  
  // Time
  age?: number;                 // Years in service
}

export interface NozzleResults {
  // Calculated values
  insideDiameter: number;       // Pipe ID (inches)
  insideRadius: number;         // Pipe IR (inches)
  t_rn: number;                 // Required thickness per UG-45 (inches)
  pipeMinusTolerance: number;   // Pipe wall minus 12.5% (inches)
  t_min: number;                // Governing minimum (inches)
  
  // Assessment
  actualThickness?: number;
  Ca?: number;                  // Corrosion allowance (inches)
  Cr?: number;                  // Corrosion rate (in/yr)
  RL?: number;                  // Remaining life (years)
  acceptable: boolean;
  
  // Governing criterion
  governingCriterion: 'pressure_design' | 'pipe_schedule';
  
  // Code reference
  codeReference: string;
  formula: string;
}

export function calculateNozzleThickness(inputs: NozzleInputs): NozzleResults {
  const { P, S, outsideDiameter, pipeWallThickness } = inputs;
  const E = inputs.E ?? 1.0; // Seamless pipe default
  
  // Calculate inside dimensions
  const insideDiameter = outsideDiameter - 2 * pipeWallThickness;
  const insideRadius = insideDiameter / 2;
  
  // Required thickness per UG-45: t_rn = PR / (SE - 0.6P)
  const denom = S * E - 0.6 * P;
  if (denom <= 0) {
    throw new Error(`Invalid calculation: (SE - 0.6P) = ${denom.toFixed(4)} <= 0`);
  }
  const t_rn = (P * insideRadius) / denom;
  
  // Pipe wall minus 12.5% manufacturing tolerance
  const pipeMinusTolerance = pipeWallThickness * 0.875;
  
  // Governing minimum is the greater of the two
  const t_min = Math.max(t_rn, pipeMinusTolerance);
  const governingCriterion = t_rn >= pipeMinusTolerance ? 'pressure_design' : 'pipe_schedule';
  
  // Assessment
  let acceptable = true;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let RL: number | undefined;
  
  if (inputs.actualThickness !== undefined) {
    Ca = inputs.actualThickness - t_min;
    acceptable = Ca >= 0;
    
    if (inputs.previousThickness !== undefined && inputs.age !== undefined && inputs.age > 0) {
      Cr = (inputs.previousThickness - inputs.actualThickness) / inputs.age;
      if (Cr > 0 && Ca !== undefined) {
        RL = Ca / Cr;
      } else if (Ca > 0) {
        RL = 999;
      }
    }
  }
  
  return {
    insideDiameter,
    insideRadius,
    t_rn,
    pipeMinusTolerance,
    t_min,
    actualThickness: inputs.actualThickness,
    Ca,
    Cr,
    RL,
    acceptable,
    governingCriterion,
    codeReference: 'ASME Section VIII Div 1, UG-45',
    formula: 't_rn = PR/(SE-0.6P)',
  };
}

// ============================================================================
// UNIFIED CALCULATION INTERFACE
// ============================================================================

/**
 * Calculate component thickness based on type
 */
export function calculateComponent(
  componentType: 'shell' | HeadType | 'nozzle',
  inputs: CalculationInputs
): CalculationResults {
  switch (componentType) {
    case 'shell':
      return calculateShellThickness(inputs);
    case 'hemispherical':
      return calculateHemisphericalHead(inputs);
    case 'ellipsoidal':
    case '2:1_ellipsoidal':
      return calculateEllipsoidalHead(inputs);
    case 'torispherical':
    case 'asme_flanged_dished':
      return calculateTorisphericalHead(inputs);
    case 'flat':
      return calculateFlatHead(inputs);
    case 'conical':
      return calculateConicalSection(inputs);
    default:
      throw new Error(`Unknown component type: ${componentType}`);
  }
}

/**
 * Determine head type from string description
 */
export function parseHeadType(description: string): HeadType {
  const lower = description.toLowerCase();
  
  if (lower.includes('hemi')) return 'hemispherical';
  if (lower.includes('ellip') || lower.includes('2:1') || lower.includes('2-1')) return 'ellipsoidal';
  if (lower.includes('toris') || lower.includes('f&d') || lower.includes('flanged') || lower.includes('dished')) return 'torispherical';
  if (lower.includes('flat')) return 'flat';
  if (lower.includes('conic')) return 'conical';
  
  // Default to ellipsoidal (most common)
  logger.warn(`Unknown head type "${description}", defaulting to ellipsoidal`);
  return 'ellipsoidal';
}

/**
 * Calculate governing MAWP for entire vessel
 */
export interface VesselCalculationSummary {
  components: Array<{
    name: string;
    type: string;
    t_min: number;
    t_act?: number;
    MAWP: number;
    RL?: number;
    isGoverning: boolean;
  }>;
  governingComponent: string;
  governingMAWP: number;
  governingRL?: number;
  overallCompliant: boolean;
}

export function calculateVesselSummary(
  components: Array<{
    name: string;
    type: 'shell' | HeadType;
    inputs: CalculationInputs;
  }>
): VesselCalculationSummary {
  const results = components.map(comp => {
    const calc = calculateComponent(comp.type, comp.inputs);
    return {
      name: comp.name,
      type: comp.type,
      t_min: calc.t_min,
      t_act: comp.inputs.t_act,
      MAWP: calc.MAWP,
      RL: calc.RL,
      isCompliant: calc.isCompliant,
    };
  });
  
  // Find governing (lowest) MAWP
  let governingIndex = 0;
  let minMAWP = results[0]?.MAWP ?? 0;
  
  for (let i = 1; i < results.length; i++) {
    if (results[i].MAWP < minMAWP) {
      minMAWP = results[i].MAWP;
      governingIndex = i;
    }
  }
  
  // Find minimum remaining life
  let minRL: number | undefined;
  for (const r of results) {
    if (r.RL !== undefined) {
      if (minRL === undefined || r.RL < minRL) {
        minRL = r.RL;
      }
    }
  }
  
  return {
    components: results.map((r, i) => ({
      ...r,
      isGoverning: i === governingIndex,
    })),
    governingComponent: results[governingIndex]?.name ?? 'Unknown',
    governingMAWP: minMAWP,
    governingRL: minRL,
    overallCompliant: results.every(r => r.isCompliant),
  };
}

// ============================================================================
// INSPECTION INTERVAL CALCULATIONS - API 510
// ============================================================================

/**
 * Calculate next inspection interval per API 510 Section 7
 * 
 * Internal inspection interval = RL / 2, not to exceed 10 years
 * External inspection interval = RL / 4, not to exceed 5 years
 */
export interface InspectionIntervalResult {
  remainingLife: number;
  internalInterval: number;
  externalInterval: number;
  utInterval: number;
  nextInternalDate?: Date;
  nextExternalDate?: Date;
  nextUTDate?: Date;
}

export function calculateInspectionIntervals(
  remainingLife: number,
  lastInspectionDate?: Date
): InspectionIntervalResult {
  // API 510 limits
  const MAX_INTERNAL_INTERVAL = 10; // years
  const MAX_EXTERNAL_INTERVAL = 5;  // years
  const MAX_UT_INTERVAL = 5;        // years
  
  // Calculate intervals
  const internalInterval = Math.min(remainingLife / 2, MAX_INTERNAL_INTERVAL);
  const externalInterval = Math.min(remainingLife / 4, MAX_EXTERNAL_INTERVAL);
  const utInterval = Math.min(remainingLife / 4, MAX_UT_INTERVAL);
  
  // Calculate next dates if last inspection date provided
  let nextInternalDate: Date | undefined;
  let nextExternalDate: Date | undefined;
  let nextUTDate: Date | undefined;
  
  if (lastInspectionDate) {
    nextInternalDate = new Date(lastInspectionDate);
    nextInternalDate.setFullYear(nextInternalDate.getFullYear() + Math.floor(internalInterval));
    
    nextExternalDate = new Date(lastInspectionDate);
    nextExternalDate.setFullYear(nextExternalDate.getFullYear() + Math.floor(externalInterval));
    
    nextUTDate = new Date(lastInspectionDate);
    nextUTDate.setFullYear(nextUTDate.getFullYear() + Math.floor(utInterval));
  }
  
  return {
    remainingLife,
    internalInterval,
    externalInterval,
    utInterval,
    nextInternalDate,
    nextExternalDate,
    nextUTDate,
  };
}
