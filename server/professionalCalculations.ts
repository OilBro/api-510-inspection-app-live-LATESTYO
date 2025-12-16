/**
 * Professional API 510 Pressure Vessel Calculations
 * 
 * These formulas match EXACTLY the calculations shown in the OilPro report.
 * DO NOT modify formulas - they are per ASME Section VIII standards.
 */

// ============================================================================
// SHELL CALCULATIONS
// ============================================================================

export interface ShellCalculationInputs {
  // Design parameters
  P: number;          // Design pressure (psi)
  R: number;          // Inside radius (inches) = Inside Diameter / 2
  S: number;          // Maximum allowable stress value (psi)
  E: number;          // Joint efficiency (decimal, e.g., 1.0, 0.85)
  
  // Thickness measurements
  t_nom: number;      // Nominal design thickness (inches)
  t_prev: number;     // Previous thickness measurement (inches)
  t_act: number;      // Actual current thickness measurement (inches)
  
  // Time and corrosion
  Y: number;          // Time span between thickness readings (years)
  Yn: number;         // Estimated time to next inspection (years)
  
  // Static head (optional)
  SH?: number;        // Static head (feet), default 0
  SG?: number;        // Specific gravity, default 1.0
}

export interface ShellCalculationResults {
  // Minimum thickness
  t_min: number;      // Minimum required thickness (inches)
  
  // Remaining life
  Ca: number;         // Corrosion allowance (inches)
  Cr: number;         // Corrosion rate (in/year)
  RL: number;         // Remaining life (years)
  
  // MAWP at next inspection
  t_next: number;     // Thickness at next inspection (inches)
  P_next: number;     // Pressure at next inspection (psi)
  MAWP: number;       // Maximum allowable working pressure (psi)
}

/**
 * Calculate shell minimum thickness per ASME Section VIII
 * Formula: t = PR / (SE - 0.6P)
 */
export function calculateShellMinimumThickness(inputs: ShellCalculationInputs): number {
  const { P, R, S, E } = inputs;
  const t_min = (P * R) / (S * E - 0.6 * P);
  return t_min;
}

/**
 * Calculate shell remaining life
 */
export function calculateShellRemainingLife(inputs: ShellCalculationInputs): {
  Ca: number;
  Cr: number;
  RL: number;
} {
  const { t_act, t_prev, Y } = inputs;
  const t_min = calculateShellMinimumThickness(inputs);
  
  // Corrosion allowance
  const Ca = t_act - t_min;
  
  // Corrosion rate with division-by-zero guard
  // If Y (years between inspections) is 0 or negative, assume no corrosion
  const Cr = Y > 0 ? (t_prev - t_act) / Y : 0;
  
  // Remaining life with division-by-zero guard
  // If Cr is 0 or negative (no corrosion or gaining thickness), return >20 years
  const RL = Cr > 0 ? Ca / Cr : 999;
  
  return { Ca, Cr, RL };
}

/**
 * Calculate shell MAWP at next inspection
 */
export function calculateShellMAWP(inputs: ShellCalculationInputs): {
  t_next: number;
  P_next: number;
  MAWP: number;
} {
  const { t_act, Yn, S, E, R, SH = 0, SG = 1.0 } = inputs;
  const { Cr } = calculateShellRemainingLife(inputs);
  
  // Thickness at next inspection
  const t_next = t_act - (Yn * Cr);
  
  // Pressure at next inspection
  // Formula: P = SEt / (R + 0.6t)
  const P_next = (S * E * t_next) / (R + 0.6 * t_next);
  
  // MAWP accounting for static head
  // Formula: MAWP = P - (SH * 0.433 * SG)
  const MAWP = P_next - (SH * 0.433 * SG);
  
  return { t_next, P_next, MAWP };
}

/**
 * Complete shell evaluation
 */
export function evaluateShell(inputs: ShellCalculationInputs): ShellCalculationResults {
  const t_min = calculateShellMinimumThickness(inputs);
  const { Ca, Cr, RL } = calculateShellRemainingLife(inputs);
  const { t_next, P_next, MAWP } = calculateShellMAWP(inputs);
  
  return {
    t_min,
    Ca,
    Cr,
    RL,
    t_next,
    P_next,
    MAWP,
  };
}

// ============================================================================
// HEAD CALCULATIONS
// ============================================================================

export type HeadType = 'hemispherical' | 'ellipsoidal' | 'torispherical';

export interface HeadCalculationInputs {
  headType: HeadType;
  
  // Design parameters
  P: number;          // Design pressure (psi)
  S: number;          // Maximum allowable stress value (psi)
  E: number;          // Joint efficiency
  D: number;          // Inside diameter (inches)
  
  // Thickness measurements
  t_nom: number;      // Nominal design thickness (inches)
  t_prev: number;     // Previous thickness measurement (inches)
  t_act: number;      // Actual current thickness measurement (inches)
  
  // Time and corrosion
  Y: number;          // Time span between thickness readings (years)
  Yn: number;         // Estimated time to next inspection (years)
  
  // Static head (optional)
  SH?: number;        // Static head (feet)
  SG?: number;        // Specific gravity
  
  // Head-specific parameters
  L?: number;         // Inside spherical or crown radius (inches) - for torispherical/ellipsoidal
  r?: number;         // Inside knuckle radius (inches) - for torispherical
}

export interface HeadCalculationResults {
  // Minimum thickness
  t_min: number;      // Minimum required thickness (inches)
  
  // Remaining life
  Ca: number;         // Corrosion allowance (inches)
  Cr: number;         // Corrosion rate (in/year)
  RL: number;         // Remaining life (years)
  
  // MAWP at next inspection
  t_next: number;     // Thickness at next inspection (inches)
  P_next: number;     // Pressure at next inspection (psi)
  MAWP: number;       // Maximum allowable working pressure (psi)
  
  // Additional parameters
  M?: number;         // Torispherical head factor (if applicable)
}

/**
 * Calculate torispherical head factor M
 * Formula: M = 0.25 * (3 + sqrt(L/r))
 */
export function calculateTorisphericalFactor(L: number, r: number): number {
  return 0.25 * (3 + Math.sqrt(L / r));
}

/**
 * Calculate head minimum thickness
 */
export function calculateHeadMinimumThickness(inputs: HeadCalculationInputs): number {
  const { headType, P, S, E, D, L, r } = inputs;
  
  // Common denominator check for all head types
  const denom = 2 * S * E - 0.2 * P;
  if (denom <= 0) {
    throw new Error(`Invalid calculation: denominator (2SE - 0.2P) = ${denom.toFixed(4)} <= 0. Check S=${S}, E=${E}, P=${P}`);
  }
  
  switch (headType) {
    case 'hemispherical':
      // Formula: t = PL / (2SE - 0.2P)
      // For hemispherical, L = R = D/2
      const R_hemi = D / 2;
      return (P * R_hemi) / denom;
    
    case 'ellipsoidal':
      // Formula: t = PD / (2SE - 0.2P)  [for 2:1 ellipsoidal]
      return (P * D) / denom;
    
    case 'torispherical':
      // Formula: t = PLM / (2SE - 0.2P)
      if (!L || !r) {
        throw new Error('L and r are required for torispherical heads');
      }
      if (r <= 0) {
        throw new Error(`Invalid knuckle radius r=${r}. Must be positive.`);
      }
      const M = calculateTorisphericalFactor(L, r);
      return (P * L * M) / denom;
    
    default:
      throw new Error(`Unknown head type: ${headType}`);
  }
}

/**
 * Calculate head remaining life
 */
export function calculateHeadRemainingLife(inputs: HeadCalculationInputs): {
  Ca: number;
  Cr: number;
  RL: number;
} {
  const { t_act, t_prev, Y } = inputs;
  const t_min = calculateHeadMinimumThickness(inputs);
  
  // Corrosion allowance
  const Ca = t_act - t_min;
  
  // Corrosion rate with division-by-zero guard
  // If Y (years between inspections) is 0 or negative, assume no corrosion
  const Cr = Y > 0 ? (t_prev - t_act) / Y : 0;
  
  // Remaining life with division-by-zero guard
  // If Cr is 0 or negative (no corrosion or gaining thickness), return >20 years
  const RL = Cr > 0 ? Ca / Cr : 999;
  
  return { Ca, Cr, RL };
}

/**
 * Calculate head MAWP at next inspection
 */
export function calculateHeadMAWP(inputs: HeadCalculationInputs): {
  t_next: number;
  P_next: number;
  MAWP: number;
  M?: number;
} {
  const { headType, t_act, Yn, S, E, D, L, r, SH = 0, SG = 1.0 } = inputs;
  const { Cr } = calculateHeadRemainingLife(inputs);
  
  // Thickness at next inspection
  const t_next = t_act - (Yn * Cr);
  
  let P_next: number;
  let M: number | undefined;
  
  switch (headType) {
    case 'hemispherical':
      // Formula: P = 2SEt / (R + 0.2t)
      const R_hemi = D / 2;
      P_next = (2 * S * E * t_next) / (R_hemi + 0.2 * t_next);
      break;
    
    case 'ellipsoidal':
      // Formula: P = 2SEt / (D + 0.2t)
      P_next = (2 * S * E * t_next) / (D + 0.2 * t_next);
      break;
    
    case 'torispherical':
      // Formula: P = 2SEt / (LM + 0.2t)
      if (!L || !r) {
        throw new Error('L and r are required for torispherical heads');
      }
      M = calculateTorisphericalFactor(L, r);
      P_next = (2 * S * E * t_next) / (L * M + 0.2 * t_next);
      break;
    
    default:
      throw new Error(`Unknown head type: ${headType}`);
  }
  
  // MAWP accounting for static head
  const MAWP = P_next - (SH * 0.433 * SG);
  
  return { t_next, P_next, MAWP, M };
}

/**
 * Complete head evaluation
 */
export function evaluateHead(inputs: HeadCalculationInputs): HeadCalculationResults {
  const t_min = calculateHeadMinimumThickness(inputs);
  const { Ca, Cr, RL } = calculateHeadRemainingLife(inputs);
  const { t_next, P_next, MAWP, M } = calculateHeadMAWP(inputs);
  
  return {
    t_min,
    Ca,
    Cr,
    RL,
    t_next,
    P_next,
    MAWP,
    M,
  };
}

// ============================================================================
// MATERIAL DATABASE
// ============================================================================

export interface MaterialData {
  code: string;
  name: string;
  stressAt500F: number;  // psi
  stressAt400F: number;  // psi
  stressAt300F: number;  // psi
  stressAt200F: number;  // psi
  stressAt100F: number;  // psi
}

export const MATERIAL_DATABASE: MaterialData[] = [
  {
    code: 'CS-A455-A',
    name: 'Carbon Steel A455 Grade A',
    stressAt500F: 18800,
    stressAt400F: 18800,
    stressAt300F: 18800,
    stressAt200F: 18800,
    stressAt100F: 18800,
  },
  {
    code: 'CS-A515-70',
    name: 'Carbon Steel A515 Grade 70',
    stressAt500F: 17500,
    stressAt400F: 17500,
    stressAt300F: 17500,
    stressAt200F: 17500,
    stressAt100F: 17500,
  },
  {
    code: 'CS-A516-70',
    name: 'Carbon Steel A516 Grade 70',
    stressAt500F: 17100,
    stressAt400F: 17500,
    stressAt300F: 17500,
    stressAt200F: 17500,
    stressAt100F: 17500,
  },
  {
    code: 'SA-285-C',
    name: 'Carbon Steel SA-285 Grade C',
    stressAt500F: 13750,
    stressAt400F: 13750,
    stressAt300F: 13750,
    stressAt200F: 13750,
    stressAt100F: 13750,
  },
  {
    code: 'SA-516-60',
    name: 'Carbon Steel SA-516 Grade 60',
    stressAt500F: 15000,
    stressAt400F: 15000,
    stressAt300F: 15000,
    stressAt200F: 15000,
    stressAt100F: 15000,
  },
];

/**
 * Get material stress value at temperature
 */
export function getMaterialStress(materialCode: string, tempF: number): number {
  const material = MATERIAL_DATABASE.find(m => m.code === materialCode);
  if (!material) {
    throw new Error(`Material ${materialCode} not found in database`);
  }
  
  // Simple interpolation - in production, use proper ASME stress tables
  if (tempF >= 500) return material.stressAt500F;
  if (tempF >= 400) return material.stressAt400F;
  if (tempF >= 300) return material.stressAt300F;
  if (tempF >= 200) return material.stressAt200F;
  return material.stressAt100F;
}

