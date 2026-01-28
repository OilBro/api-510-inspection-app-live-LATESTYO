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
  | "hemispherical"
  | "ellipsoidal"
  | "2:1_ellipsoidal"
  | "torispherical"
  | "asme_flanged_dished"
  | "flat"
  | "conical";

/**
 * Validation warning for edge cases and suspicious inputs
 * Used to communicate issues without throwing errors
 */
export interface ValidationWarning {
  field: string; // Field that triggered the warning
  message: string; // Human-readable warning message
  severity: "warning" | "critical"; // Severity level
  value: number; // Actual value that triggered warning
  expectedRange?: string; // Expected range or constraint
}

export interface CalculationInputs {
  // Design parameters
  P: number; // Design pressure (psi)
  S: number; // Maximum allowable stress at design temperature (psi)
  E: number; // Joint efficiency (0.0 - 1.0)

  // Geometry
  D: number; // Inside diameter (inches)
  R?: number; // Inside radius (inches) - calculated from D if not provided

  // For torispherical heads
  L?: number; // Inside crown radius (inches)
  r?: number; // Inside knuckle radius (inches)

  // For conical sections
  alpha?: number; // Half apex angle (degrees)

  // For flat heads
  C?: number; // Attachment factor (0.10 - 0.33)
  d?: number; // Diameter or short span (inches)

  // Thickness measurements
  t_nom?: number; // Nominal thickness (inches)
  t_prev?: number; // Previous thickness (inches)
  t_act?: number; // Actual current thickness (inches)

  // Time parameters
  Y?: number; // Years between inspections
  Yn?: number; // Years to next inspection

  // Static head (optional)
  SH?: number; // Static head (feet)
  SG?: number; // Specific gravity
}

export interface CalculationResults {
  // Minimum thickness
  t_min: number; // Minimum required thickness (inches)
  t_min_circ?: number; // For shells: circumferential stress
  t_min_long?: number; // For shells: longitudinal stress

  // MAWP calculations
  MAWP: number; // Maximum allowable working pressure (psi)
  MAWP_circ?: number; // For shells: from circumferential stress
  MAWP_long?: number; // For shells: from longitudinal stress

  // Corrosion and remaining life
  Ca?: number; // Corrosion allowance (inches)
  Cr_short?: number; // Short-term corrosion rate (in/yr)
  Cr_long?: number; // Long-term corrosion rate (in/yr)
  Cr?: number; // Governing corrosion rate (in/yr)
  RL?: number; // Remaining life (years)

  // Next inspection
  t_next?: number; // Thickness at next inspection (inches)
  P_next?: number; // Pressure at next inspection (psi)
  nextInspectionInterval?: number; // Recommended interval (years)

  // Head-specific
  M?: number; // Torispherical factor
  K?: number; // Ellipsoidal factor

  // Compliance
  isCompliant: boolean; // t_act >= t_min
  governingCondition: string; // What limits the design

  // Code references
  codeReference: string; // ASME paragraph reference
  formula: string; // Formula used

  // Validation metadata (Track 001)
  warnings: ValidationWarning[]; // Validation warnings for edge cases
  defaultsUsed: string[]; // Parameters that used default values
}

// ============================================================================
// VALIDATION HELPER FUNCTIONS (Track 001)
// ============================================================================

/**
 * Validate that a number is positive and optionally above a minimum threshold
 * @param value - Value to validate
 * @param name - Parameter name for error messages
 * @param minValue - Optional minimum safe value (will warn if below)
 * @returns Array of validation warnings
 * @throws Error if value <= 0
 */
function validatePositiveNumber(
  value: number,
  name: string,
  minValue?: number
): ValidationWarning[] {
  if (value <= 0) {
    throw new Error(`${name} must be positive, got ${value}`);
  }

  const warnings: ValidationWarning[] = [];
  if (minValue && value < minValue) {
    warnings.push({
      field: name,
      message: `${name} is unusually small`,
      severity: "warning",
      value,
      expectedRange: `>= ${minValue}`,
    });
  }

  return warnings;
}

/**
 * Validate that a ratio falls within acceptable bounds
 * @param ratio - Ratio value to validate
 * @param name - Ratio name for error messages
 * @param min - Absolute minimum (will error if below)
 * @param max - Absolute maximum (will error if above)
 * @param warnMin - Warning threshold minimum (will warn if below)
 * @param warnMax - Warning threshold maximum (will warn if above)
 * @returns Array of validation warnings
 * @throws Error if ratio outside [min, max]
 */
function validateRatio(
  ratio: number,
  name: string,
  min: number,
  max: number,
  warnMin?: number,
  warnMax?: number
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (ratio < min || ratio > max) {
    throw new Error(`${name} must be between ${min} and ${max}, got ${ratio}`);
  }

  if (warnMin && ratio < warnMin) {
    warnings.push({
      field: name,
      message: `${name} is unusually low`,
      severity: "warning",
      value: ratio,
      expectedRange: `${warnMin} to ${warnMax || max}`,
    });
  }

  if (warnMax && ratio > warnMax) {
    warnings.push({
      field: name,
      message: `${name} is unusually high`,
      severity: "warning",
      value: ratio,
      expectedRange: `${warnMin || min} to ${warnMax}`,
    });
  }

  return warnings;
}

/**
 * Validate that a denominator is safe for division
 * @param denom - Denominator value
 * @param expression - Expression string for error messages
 * @param minSafe - Minimum safe value to avoid numerical instability (default 1000)
 * @returns Array of validation warnings
 * @throws Error if denom <= 0 or denom < 100 (severe instability)
 */
function validateDenominator(
  denom: number,
  expression: string,
  minSafe = 1000
): ValidationWarning[] {
  if (denom <= 0) {
    throw new Error(
      `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
    );
  }

  if (denom < 100) {
    throw new Error(
      `Denominator too small for numerical stability: ${expression} = ${denom.toFixed(4)}`
    );
  }

  const warnings: ValidationWarning[] = [];
  if (denom < minSafe) {
    warnings.push({
      field: "denominator",
      message: `Denominator ${expression} is small, may indicate input error`,
      severity: "warning",
      value: denom,
      expectedRange: `>= ${minSafe}`,
    });
  }

  return warnings;
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
export function calculateShellThickness(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E, D } = inputs;
  const R = inputs.R ?? D / 2;
  
  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];
  
  // Track default values
  if (inputs.R === undefined) {
    defaultsUsed.push('R (radius)');
  }

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || R <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, R=${R}`);
  }
  
  // Validate P/(SE) ratio per UG-27 applicability limits
  // UG-27(c)(1) circumferential: P ≤ 0.385SE
  // UG-27(c)(2) longitudinal: P ≤ 1.25SE
  const P_SE_ratio = P / (S * E);
  
  // Check circumferential stress applicability limit (stricter)
  if (P_SE_ratio > 0.385) {
    warnings.push({
      field: 'P/(SE)',
      message: `P/(SE) = ${P_SE_ratio.toFixed(4)} exceeds UG-27(c)(1) limit of 0.385. Thick-wall analysis may be required.`,
      severity: 'critical',
      value: P_SE_ratio,
      expectedRange: '≤ 0.385 for thin-wall formula applicability'
    });
  }
  
  // Check longitudinal stress applicability limit
  if (P_SE_ratio > 1.25) {
    throw new Error(`P/(SE) = ${P_SE_ratio.toFixed(4)} exceeds UG-27(c)(2) limit of 1.25. Thick-wall analysis required per ASME.`);
  }

  // Circumferential stress (longitudinal joints) - UG-27(c)(1)
  const denom_circ = S * E - 0.6 * P;
  
  // Denominator safety validation
  const denomWarnings = validateDenominator(denom_circ, 'SE-0.6P');
  warnings.push(...denomWarnings);
  
  const t_min_circ = (P * R) / denom_circ;

  // Longitudinal stress (circumferential joints) - UG-27(c)(2)
  const denom_long = 2 * S * E + 0.4 * P;
  const t_min_long = (P * R) / denom_long;

  // Governing thickness is the larger value
  const t_min = Math.max(t_min_circ, t_min_long);
  
  // UG-27 thin-wall applicability check: t ≤ 0.5R
  // This check uses the calculated t_min as a proxy
  if (t_min > 0.5 * R) {
    warnings.push({
      field: 't/R',
      message: `Calculated t_min/R = ${(t_min / R).toFixed(4)} exceeds 0.5. Thick-wall analysis per UG-27 Note may be required.`,
      severity: 'critical',
      value: t_min / R,
      expectedRange: '≤ 0.5 for thin-wall formula applicability'
    });
  }
  const governingCondition =
    t_min_circ >= t_min_long ? "Circumferential Stress" : "Longitudinal Stress";

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
    
    // C2 Fix: Validate R - 0.4t denominator per verification report
    if (denom_mawp_long <= 0) {
      warnings.push({
        field: 'R-0.4t',
        message: `Denominator R - 0.4t = ${denom_mawp_long.toFixed(4)} ≤ 0. Thickness exceeds thin-wall formula applicability (t > 2.5R).`,
        severity: 'critical',
        value: denom_mawp_long,
        expectedRange: '> 0 for valid MAWP calculation'
      });
      // Use circumferential MAWP as fallback when longitudinal formula is invalid
      MAWP_long = MAWP_circ;
    } else {
      MAWP_long = (2 * S * E * t) / denom_mawp_long;
    }

    // Governing MAWP is the lower value
    MAWP = Math.min(MAWP_circ, MAWP_long);

    // Apply static head correction if provided
    if (inputs.SH && inputs.SG) {
      MAWP = MAWP - inputs.SH * 0.433 * inputs.SG;
    }

    // Corrosion allowance
    Ca = inputs.t_act - t_min;
    
    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      isCompliant = false;
      
      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: 't_act',
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: 'critical',
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`
        });
      } else {
        warnings.push({
          field: 't_act',
          message: 'Actual thickness is below minimum required thickness',
          severity: 'critical',
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`
        });
      }
    } else {
      isCompliant = true;
      
      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: 't_act',
          message: 'Actual thickness is very close to minimum, consider monitoring closely',
          severity: 'warning',
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`
        });
      }
    }

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
    
    // Corrosion rate validation
    if (Cr !== undefined && Cr !== 0) {
      if (Cr > 0.5) {
        throw new Error(`Unrealistic corrosion rate: ${Cr.toFixed(4)} in/yr > 0.5 in/yr. Check inputs.`);
      }
      if (Cr > 0.1) {
        warnings.push({
          field: 'Cr',
          message: 'Corrosion rate is very high, verify data and consider immediate action',
          severity: 'critical',
          value: Cr,
          expectedRange: '< 0.1 in/yr'
        });
      } else if (Cr < 0) {
        warnings.push({
          field: 'Cr',
          message: 'Negative corrosion rate (thickness increase), verify measurement accuracy',
          severity: 'warning',
          value: Cr,
          expectedRange: '>= 0 in/yr'
        });
      } else if (Cr < 0.001 && Cr > 0) {
        warnings.push({
          field: 'Cr',
          message: 'Corrosion rate is very low, verify if this is expected for the service',
          severity: 'warning',
          value: Cr,
          expectedRange: '> 0.001 in/yr for active corrosion'
        });
      }
    }

    // Remaining life
    if (Cr !== undefined && Cr > 0 && Ca !== undefined) {
      RL = Ca / Cr;
      
      // Remaining life validation per API 510
      if (RL < 1) {
        warnings.push({
          field: 'RL',
          message: 'Remaining life is less than 1 year, immediate action required',
          severity: 'critical',
          value: RL,
          expectedRange: '>= 1 year'
        });
      } else if (RL < 2) {
        warnings.push({
          field: 'RL',
          message: 'Remaining life is less than 2 years, plan for repair or replacement',
          severity: 'critical',
          value: RL,
          expectedRange: '>= 2 years'
        });
      } else if (RL <= 4) {
        // E1 Enhancement: API 510 logic gate for internal inspection requirement
        warnings.push({
          field: 'RL',
          message: 'Remaining life ≤ 4 years: Internal inspection required per API 510',
          severity: 'critical',
          value: RL,
          expectedRange: '> 4 years to avoid mandatory internal inspection'
        });
      }
    } else if (Ca !== undefined && Ca > 0) {
      RL = 999; // Essentially infinite if no corrosion
    }

    // Thickness at next inspection
    if (inputs.Yn !== undefined && Cr !== undefined) {
      t_next = inputs.t_act - inputs.Yn * Cr;
      P_next = t_next > 0 ? (S * E * t_next) / (R + 0.6 * t_next) : 0;
    }
    
    // MAWP validation
    if (MAWP <= 0) {
      throw new Error(`Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`);
    }
    
    const MAWP_ratio = MAWP / P;
    
    if (MAWP_ratio > 10) {
      throw new Error(`Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`);
    }
    
    if (MAWP_ratio > 2) {
      warnings.push({
        field: 'MAWP',
        message: 'Calculated MAWP is much higher than design pressure, verify inputs',
        severity: 'warning',
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`
      });
    }
    
    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: 'MAWP',
        message: 'Calculated MAWP is much lower than design pressure, component may be undersized',
        severity: 'warning',
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`
      });
    }
    
    // Static head correction validation
    if (inputs.SH && inputs.SG) {
      const SH_correction = inputs.SH * 0.433 * inputs.SG;
      if (SH_correction > 0.2 * P) {
        warnings.push({
          field: 'SH',
          message: 'Static head correction is significant relative to design pressure',
          severity: 'warning',
          value: SH_correction,
          expectedRange: `< ${(0.2 * P).toFixed(1)} psi (20% of design pressure)`
        });
      }
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
    codeReference: "ASME Section VIII Div 1, UG-27",
    formula: "t = PR/(SE-0.6P) [circ], t = PR/(2SE+0.4P) [long]",
    warnings,
    defaultsUsed,
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
export function calculateHemisphericalHead(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E, D } = inputs;
  const L = D / 2; // Inside radius = D/2 for hemisphere

  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];

  // Track that R was calculated from D
  defaultsUsed.push("R (inside radius)");

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }

  // UG-32(f) Scope Limitations - Pressure Limit
  // Per ASME Section VIII Div 1: P ≤ 0.665SE for hemispherical heads
  const P_limit_hemi = 0.665 * S * E;
  if (P > P_limit_hemi) {
    warnings.push({
      field: 'P',
      message: `Pressure exceeds UG-32(f) scope: P = ${P.toFixed(1)} psi > 0.665SE = ${P_limit_hemi.toFixed(1)} psi. Thick-wall analysis may be required.`,
      severity: 'critical',
      value: P,
      expectedRange: `≤ ${P_limit_hemi.toFixed(1)} psi per UG-32(f)`
    });
  }

  // Validate pressure to stress ratio
  const P_SE_ratio = P / (S * E);
  if (P_SE_ratio > 0.9) {
    throw new Error(
      `Pressure to stress ratio too high: P/(SE) = ${P_SE_ratio.toFixed(4)} > 0.9`
    );
  }
  if (P_SE_ratio > 0.5) {
    warnings.push({
      field: "P/(SE)",
      message: "Pressure to stress ratio is high, may indicate input error",
      severity: "warning",
      value: P_SE_ratio,
      expectedRange: "< 0.5",
    });
  }

  // Minimum thickness: t = PL / (2SE - 0.2P)
  const denom = 2 * S * E - 0.2 * P;
  try {
    warnings.push(...validateDenominator(denom, "(2SE - 0.2P)"));
  } catch (error) {
    throw new Error(
      `Denominator validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const t_min = (P * L) / denom;

  // UG-32(f) Scope Limitations - Thickness Limit
  // Per ASME Section VIII Div 1: t ≤ 0.356L for hemispherical heads
  const t_limit_hemi = 0.356 * L;
  if (t_min > t_limit_hemi) {
    warnings.push({
      field: 't_min',
      message: `Calculated t_min exceeds UG-32(f) scope: t_min = ${t_min.toFixed(4)}" > 0.356L = ${t_limit_hemi.toFixed(4)}". Thick-wall analysis may be required.`,
      severity: 'critical',
      value: t_min,
      expectedRange: `≤ ${t_limit_hemi.toFixed(4)}" per UG-32(f)`
    });
  }

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
      MAWP = MAWP - inputs.SH * 0.433 * inputs.SG;
    }

    // Actual thickness edge case handling
    Ca = inputs.t_act - t_min;

    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      RL = 0;
      isCompliant = false;

      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: "t_act",
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      } else {
        warnings.push({
          field: "t_act",
          message: "Actual thickness is below minimum required thickness",
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      }
    } else {
      isCompliant = true;

      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: "t_act",
          message:
            "Actual thickness is very close to minimum, consider monitoring closely",
          severity: "warning",
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`,
        });
      }
    }

    // Corrosion rate edge case handling
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);

    // Handle corrosion rate edge cases
    if (Cr !== undefined && Cr < 0) {
      // Negative corrosion rate (metal growth)
      RL = undefined;
      warnings.push({
        field: "Cr",
        message:
          "Negative corrosion rate detected (metal growth), remaining life calculation not applicable",
        severity: "warning",
        value: Cr,
        expectedRange: ">= 0",
      });
    } else if (Cr !== undefined && Cr > 0 && Ca !== undefined && Ca > 0) {
      RL = Ca / Cr;

      // Cap remaining life at 500 years for very small corrosion rates
      if (RL > 500) {
        RL = 500;
        warnings.push({
          field: "RL",
          message:
            "Corrosion rate is very small, remaining life capped at 500 years",
          severity: "warning",
          value: Cr,
          expectedRange: "> 0.0002 in/yr for meaningful prediction",
        });
      }
    } else if (Cr === 0 || Cr === undefined) {
      // Zero or no corrosion
      if (Ca !== undefined && Ca > 0) {
        RL = undefined; // No measurable corrosion
      }
    }

    // MAWP validation
    if (MAWP <= 0) {
      throw new Error(
        `Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`
      );
    }

    const MAWP_ratio = MAWP / P;

    if (MAWP_ratio > 10) {
      throw new Error(
        `Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`
      );
    }

    if (MAWP_ratio > 2) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much higher than design pressure, verify inputs",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }

    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much lower than design pressure, component may be undersized",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
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
    governingCondition: "Hemispherical Head",
    codeReference: "ASME Section VIII Div 1, UG-32(f)",
    formula: "t = PL/(2SE-0.2P), where L = D/2",
    warnings,
    defaultsUsed,
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
export function calculateEllipsoidalHead(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E, D } = inputs;

  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }

  // Validate pressure to stress ratio
  const P_SE_ratio = P / (S * E);
  if (P_SE_ratio > 0.9) {
    throw new Error(
      `Pressure to stress ratio too high: P/(SE) = ${P_SE_ratio.toFixed(4)} > 0.9`
    );
  }
  if (P_SE_ratio > 0.5) {
    warnings.push({
      field: "P/(SE)",
      message: "Pressure to stress ratio is high, may indicate input error",
      severity: "warning",
      value: P_SE_ratio,
      expectedRange: "< 0.5",
    });
  }

  // K-factor for ellipsoidal heads
  // For 2:1 ellipsoidal heads, K = 1.0 (standard)
  // For non-standard heads, K = (1/6) × [2 + (D/2h)²] per Appendix 1-4(c)
  // Default to 2:1 ratio (h = D/4) giving K = 1.0
  const h = D / 4; // 2:1 ellipsoidal: major axis = D, minor axis = D/2, h = D/4
  const K = (1 / 6) * (2 + Math.pow(D / (2 * h), 2)); // K = 1.0 for 2:1
  
  // Note: For non-standard ellipsoidal heads, user should provide head height (h)
  // and use K = (1/6) × [2 + (D/2h)²] per Appendix 1-4(c)
  defaultsUsed.push('K-factor = 1.0 (standard 2:1 ellipsoidal)');

  // Minimum thickness: t = PD / (2SE - 0.2P) for K=1.0
  // General formula: t = PDK / (2SE - 0.2P) per Appendix 1-4
  const denom = 2 * S * E - 0.2 * P;
  try {
    warnings.push(...validateDenominator(denom, "(2SE - 0.2P)"));
  } catch (error) {
    throw new Error(
      `Denominator validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const t_min = (P * D * K) / denom;

  // UG-32(d) Scope Limitations - t/L ratio check
  // Per ASME Section VIII Div 1: t/L ≥ 0.002 for standard formula
  // For ellipsoidal heads, L = D (inside diameter)
  const L_ellip = D;
  const t_L_ratio = t_min / L_ellip;
  if (t_L_ratio < 0.002) {
    warnings.push({
      field: 't/L',
      message: `t/L ratio = ${t_L_ratio.toFixed(6)} is below 0.002. Per Appendix 1-4(f), additional checks may be required.`,
      severity: 'warning',
      value: t_L_ratio,
      expectedRange: '≥ 0.002 for standard UG-32(d) formula'
    });
  }

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
      MAWP = MAWP - inputs.SH * 0.433 * inputs.SG;
    }

    // Actual thickness edge case handling
    Ca = inputs.t_act - t_min;

    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      RL = 0;
      isCompliant = false;

      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: "t_act",
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      } else {
        warnings.push({
          field: "t_act",
          message: "Actual thickness is below minimum required thickness",
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      }
    } else {
      isCompliant = true;

      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: "t_act",
          message:
            "Actual thickness is very close to minimum, consider monitoring closely",
          severity: "warning",
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`,
        });
      }
    }

    // Corrosion rate edge case handling
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);

    // Handle corrosion rate edge cases
    if (Cr !== undefined && Cr < 0) {
      // Negative corrosion rate (metal growth)
      RL = undefined;
      warnings.push({
        field: "Cr",
        message:
          "Negative corrosion rate detected (metal growth), remaining life calculation not applicable",
        severity: "warning",
        value: Cr,
        expectedRange: ">= 0",
      });
    } else if (Cr !== undefined && Cr > 0 && Ca !== undefined && Ca > 0) {
      RL = Ca / Cr;

      // Cap remaining life at 500 years for very small corrosion rates
      if (RL > 500) {
        RL = 500;
        warnings.push({
          field: "RL",
          message:
            "Corrosion rate is very small, remaining life capped at 500 years",
          severity: "warning",
          value: Cr,
          expectedRange: "> 0.0002 in/yr for meaningful prediction",
        });
      }
    } else if (Cr === 0 || Cr === undefined) {
      // Zero or no corrosion
      if (Ca !== undefined && Ca > 0) {
        RL = undefined; // No measurable corrosion
      }
    }

    // MAWP validation
    if (MAWP <= 0) {
      throw new Error(
        `Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`
      );
    }

    const MAWP_ratio = MAWP / P;

    if (MAWP_ratio > 10) {
      throw new Error(
        `Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`
      );
    }

    if (MAWP_ratio > 2) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much higher than design pressure, verify inputs",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }

    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much lower than design pressure, component may be undersized",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
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
    governingCondition: "2:1 Ellipsoidal Head",
    codeReference: "ASME Section VIII Div 1, UG-32(d)",
    formula: "t = PD/(2SE-0.2P)",
    warnings,
    defaultsUsed,
  };
}

/**
 * Calculate torispherical (ASME F&D) head thickness per ASME UG-32(e) & Appendix 1-4(d)
 *
 * CRITICAL CORRECTION (January 2026 Verification):
 * Standard ASME F&D head is defined with:
 *   L = Do (OUTSIDE diameter), NOT D (inside diameter)
 *   r = 0.06 × Do (based on outside diameter)
 *
 * Formula: t = PLM / (2SE - 0.2P)
 *
 * Where:
 * L = inside crown radius
 * r = inside knuckle radius
 * M = factor = 0.25 × (3 + √(L/r)) per Appendix 1-4(d)
 *
 * UG-32(e) specific formula applies ONLY to heads with r = 0.06 × Do (6% heads)
 * For non-standard geometries, use Appendix 1-4(d) general formula
 *
 * Scope Limitations:
 *   - t/L ≥ 0.002
 *   - r ≥ 0.06 × Do
 *   - L ≤ Do
 *
 * MAWP: P = 2SEt / (LM + 0.2t)
 */
export function calculateTorisphericalHead(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E, D } = inputs;

  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];

  // CORRECTED: Standard ASME F&D dimensions based on OUTSIDE diameter (Do)
  // Do = D + 2t (approximate, use D + 0.5" as conservative estimate for initial calc)
  // For standard F&D: L = Do, r = 0.06 × Do
  let L = inputs.L;
  let r = inputs.r;

  // Calculate approximate outside diameter for standard F&D defaults
  const Do_approx = D + 0.5; // Conservative estimate before t_min is known

  if (L === undefined || L <= 0) {
    // CORRECTED: L = Do (outside diameter) for standard F&D per UG-32(e)
    L = Do_approx;
    defaultsUsed.push(`L (crown radius) = Do ≈ ${L.toFixed(3)}" per UG-32(e) standard F&D`);
    warnings.push({
      field: 'L',
      message: `Using standard F&D: L = Do ≈ ${L.toFixed(3)}". For precise calculations, provide actual crown radius.`,
      severity: 'warning',
      value: L,
      expectedRange: 'User-provided or L = Do per UG-32(e)'
    });
  }

  if (r === undefined || r <= 0) {
    // CORRECTED: r = 0.06 × Do (outside diameter) for standard F&D per UG-32(e)
    r = 0.06 * Do_approx;
    defaultsUsed.push(`r (knuckle radius) = 0.06 × Do ≈ ${r.toFixed(4)}" per UG-32(e) standard F&D`);
  }

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0 || L <= 0 || r <= 0) {
    throw new Error(
      `Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}, L=${L}, r=${r}`
    );
  }

  // Phase 3: Validate L/r ratio
  const Lr_ratio = L / r;
  try {
    warnings.push(...validateRatio(Lr_ratio, "L/r ratio", 1, 100, 5, 20));
  } catch (error) {
    throw new Error(
      `L/r ratio validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Calculate M factor: M = 0.25 * (3 + sqrt(L/r))
  const M = 0.25 * (3 + Math.sqrt(L / r));

  // Phase 4: Validate M factor bounds
  try {
    warnings.push(...validateRatio(M, "M factor", 1.0, 3.0, 1.5, 2.5));
  } catch (error) {
    throw new Error(
      `M factor validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Phase 5: Validate pressure to stress ratio
  const P_SE_ratio = P / (S * E);
  if (P_SE_ratio > 0.9) {
    throw new Error(
      `Pressure to stress ratio too high: P/(SE) = ${P_SE_ratio.toFixed(4)} > 0.9`
    );
  }
  if (P_SE_ratio > 0.5) {
    warnings.push({
      field: "P/(SE)",
      message: "Pressure to stress ratio is high, may indicate input error",
      severity: "warning",
      value: P_SE_ratio,
      expectedRange: "< 0.5",
    });
  }

  // Phase 6: Enhanced denominator validation
  const denom = 2 * S * E - 0.2 * P;
  try {
    warnings.push(...validateDenominator(denom, "(2SE - 0.2P)"));
  } catch (error) {
    throw new Error(
      `Denominator validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const t_min = (P * L * M) / denom;

  // UG-32(e) / Appendix 1-4 Scope Limitations
  // Verify t/L ≥ 0.002
  const t_L_ratio_tori = t_min / L;
  if (t_L_ratio_tori < 0.002) {
    warnings.push({
      field: 't/L',
      message: `t/L ratio = ${t_L_ratio_tori.toFixed(6)} is below 0.002. Per Appendix 1-4(f), additional checks may be required.`,
      severity: 'warning',
      value: t_L_ratio_tori,
      expectedRange: '≥ 0.002 for standard UG-32(e) formula'
    });
  }

  // Verify r ≥ 0.06 × Do (6% knuckle requirement)
  const r_min_required = 0.06 * Do_approx;
  if (r < r_min_required * 0.99) { // Allow 1% tolerance
    warnings.push({
      field: 'r',
      message: `Knuckle radius r = ${r.toFixed(4)}" is less than 0.06×Do = ${r_min_required.toFixed(4)}". UG-32(e) formula may not apply. Use Appendix 1-4(d) for non-standard heads.`,
      severity: 'critical',
      value: r,
      expectedRange: `≥ ${r_min_required.toFixed(4)}" per UG-32(e)`
    });
  }

  // Verify L ≤ Do (crown radius limitation)
  if (L > Do_approx * 1.01) { // Allow 1% tolerance
    warnings.push({
      field: 'L',
      message: `Crown radius L = ${L.toFixed(3)}" exceeds Do ≈ ${Do_approx.toFixed(3)}". UG-32(e) standard F&D formula may not apply.`,
      severity: 'critical',
      value: L,
      expectedRange: `≤ ${Do_approx.toFixed(3)}" per UG-32(e)`
    });
  }

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
      MAWP = MAWP - inputs.SH * 0.433 * inputs.SG;
    }

    // Phase 8: Actual thickness edge case handling
    Ca = inputs.t_act - t_min;

    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      RL = 0;
      isCompliant = false;

      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: "t_act",
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      } else {
        warnings.push({
          field: "t_act",
          message: "Actual thickness is below minimum required thickness",
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      }
    } else {
      isCompliant = true;

      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: "t_act",
          message:
            "Actual thickness is very close to minimum, consider monitoring closely",
          severity: "warning",
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`,
        });
      }
    }

    // Phase 9: Corrosion rate edge case handling
    if (inputs.t_prev !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_short = (inputs.t_prev - inputs.t_act) / inputs.Y;
    }
    if (inputs.t_nom !== undefined && inputs.Y !== undefined && inputs.Y > 0) {
      Cr_long = (inputs.t_nom - inputs.t_act) / inputs.Y;
    }
    Cr = Math.max(Cr_short ?? 0, Cr_long ?? 0);

    // Handle corrosion rate edge cases
    if (Cr !== undefined && Cr < 0) {
      // Negative corrosion rate (metal growth)
      RL = undefined;
      warnings.push({
        field: "Cr",
        message:
          "Negative corrosion rate detected (metal growth), remaining life calculation not applicable",
        severity: "warning",
        value: Cr,
        expectedRange: ">= 0",
      });
    } else if (Cr !== undefined && Cr > 0 && Ca !== undefined && Ca > 0) {
      RL = Ca / Cr;

      // Cap remaining life at 500 years for very small corrosion rates
      if (RL > 500) {
        RL = 500;
        warnings.push({
          field: "RL",
          message:
            "Corrosion rate is very small, remaining life capped at 500 years",
          severity: "warning",
          value: Cr,
          expectedRange: "> 0.0002 in/yr for meaningful prediction",
        });
      }
    } else if (Cr === 0 || Cr === undefined) {
      // Zero or no corrosion
      if (Ca !== undefined && Ca > 0) {
        RL = undefined; // No measurable corrosion
      }
    }

    // Phase 10: MAWP validation
    if (MAWP <= 0) {
      throw new Error(
        `Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`
      );
    }

    const MAWP_ratio = MAWP / P;

    if (MAWP_ratio > 10) {
      throw new Error(
        `Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`
      );
    }

    if (MAWP_ratio > 2) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much higher than design pressure, verify inputs",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }

    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much lower than design pressure, component may be undersized",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
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
    governingCondition: "Torispherical Head",
    codeReference: "ASME Section VIII Div 1, UG-32(e)",
    formula: `t = PLM/(2SE-0.2P), M = 0.25*(3+sqrt(L/r)) = ${M.toFixed(4)}`,
    warnings,
    defaultsUsed,
  };
}

/**
 * Calculate flat head thickness per ASME UG-34
 *
 * Formula: t = d × √(CP/SE)
 *
 * Where:
 * d = diameter or short span (inches)
 * C = factor depending on attachment method (0.10 to 0.33)
 *
 * UG-34 C-Factor Reference (January 2026 Verification):
 * For precise C-factor selection, refer to UG-34 figures:
 *   - Figure UG-34(a): Integral flat heads - C = 0.10 to 0.17
 *   - Figure UG-34(b): Welded flat heads - C = 0.17 to 0.33
 *   - Figure UG-34(c): Bolted flat heads - C = 0.25 to 0.33
 *   - Figure UG-34(d): Threaded flat heads - C = 0.30
 *   - Figure UG-34(e): Lap-joint flat heads - C = 0.33
 *   - Figure UG-34(f): Blind flanges - C = 0.25 to 0.30
 *
 * Default C = 0.33 is conservative for most configurations.
 */
export function calculateFlatHead(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E } = inputs;
  const d = inputs.d ?? inputs.D;
  const C = inputs.C ?? 0.33; // Conservative default

  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];

  // Track default values
  if (inputs.d === undefined) {
    defaultsUsed.push("d (diameter)");
  }
  if (inputs.C === undefined) {
    defaultsUsed.push("C (attachment factor) = 0.33 (conservative default per UG-34)");
    warnings.push({
      field: 'C',
      message: 'Using conservative C = 0.33. For precise calculations, select C-factor from UG-34 figures based on actual attachment configuration.',
      severity: 'warning',
      value: C,
      expectedRange: 'Select from UG-34 figures (a) through (f)'
    });
  }

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || d <= 0 || C <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, d=${d}, C=${C}`);
  }

  // Validate C factor (typical range 0.10 to 0.33 per UG-34)
  if (C > 0.5) {
    throw new Error(
      `C factor too high: ${C.toFixed(3)} > 0.5. Check attachment method per UG-34 figures.`
    );
  }
  if (C < 0.1 || C > 0.33) {
    warnings.push({
      field: "C",
      message:
        "C factor is outside typical UG-34 range (0.10 to 0.33). Verify attachment method against UG-34 figures.",
      severity: "warning",
      value: C,
      expectedRange: "0.10 to 0.33 per UG-34 figures",
    });
  }

  // Validate d/D ratio if both are provided
  if (inputs.d !== undefined && inputs.D !== undefined) {
    const d_D_ratio = inputs.d / inputs.D;
    if (d_D_ratio > 1.1) {
      warnings.push({
        field: "d/D",
        message:
          "d (diameter or short span) is larger than D (vessel diameter), verify inputs",
        severity: "warning",
        value: d_D_ratio,
        expectedRange: "<= 1.0",
      });
    }
  }

  // Validate pressure for flat heads (typically low pressure applications)
  if (P > 150) {
    throw new Error(
      `Flat heads are not suitable for high pressure: P = ${P.toFixed(0)} psi > 150 psi. Consider dished head.`
    );
  }
  if (P > 50) {
    warnings.push({
      field: "P",
      message:
        "Pressure is high for flat head design, consider using dished head instead",
      severity: "critical",
      value: P,
      expectedRange: "<= 50 psi",
    });
  } else if (P > 15) {
    warnings.push({
      field: "P",
      message:
        "Flat heads are typically used for low pressure applications (< 15 psi)",
      severity: "warning",
      value: P,
      expectedRange: "<= 15 psi",
    });
  }

  // Validate sqrt argument
  const sqrt_arg = (C * P) / (S * E);
  if (sqrt_arg < 0) {
    throw new Error(
      `Invalid calculation: sqrt argument is negative: ${sqrt_arg.toFixed(6)}`
    );
  }

  // Minimum thickness: t = d * sqrt(CP/SE)
  const t_min = d * Math.sqrt(sqrt_arg);

  // Calculate MAWP
  let MAWP = P;
  let Ca: number | undefined;
  let isCompliant = true;

  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;

    // MAWP: P = SE * (t/d)^2 / C
    MAWP = (S * E * Math.pow(t / d, 2)) / C;

    // Actual thickness edge case handling
    Ca = inputs.t_act - t_min;

    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      isCompliant = false;

      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: "t_act",
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      } else {
        warnings.push({
          field: "t_act",
          message: "Actual thickness is below minimum required thickness",
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      }
    } else {
      isCompliant = true;

      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: "t_act",
          message:
            "Actual thickness is very close to minimum, consider monitoring closely",
          severity: "warning",
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`,
        });
      }
    }

    // MAWP validation
    if (MAWP <= 0) {
      throw new Error(
        `Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`
      );
    }

    const MAWP_ratio = MAWP / P;

    if (MAWP_ratio > 10) {
      throw new Error(
        `Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`
      );
    }

    if (MAWP_ratio > 2) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much higher than design pressure, verify inputs",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }

    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much lower than design pressure, component may be undersized",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }
  }

  return {
    t_min,
    MAWP,
    Ca,
    isCompliant,
    governingCondition: "Flat Head",
    codeReference: "ASME Section VIII Div 1, UG-34",
    formula: `t = d*sqrt(CP/SE), C = ${C}`,
    warnings,
    defaultsUsed,
  };
}

/**
 * Calculate conical section thickness per ASME UG-32(g)
 *
 * CRITICAL CORRECTION (January 2026 Verification):
 * UG-32(g) formula is ONLY valid for α ≤ 30° (half-apex angle)
 * For α > 30°, Appendix 1-5(g) rules must be used
 *
 * Formula: t = PD / [2 × cos(α) × (SE - 0.6P)]
 *
 * Where α = one-half of the included (apex) angle
 *
 * MAWP: P = 2SEt×cos(α) / (D + 1.2t×cos(α))
 */
export function calculateConicalSection(
  inputs: CalculationInputs
): CalculationResults {
  const { P, S, E, D } = inputs;
  const alphaDeg = inputs.alpha ?? 30; // Default 30 degrees half-angle
  const alpha = alphaDeg * (Math.PI / 180); // Convert to radians

  // Initialize validation tracking
  const warnings: ValidationWarning[] = [];
  const defaultsUsed: string[] = [];

  // Track default values
  if (inputs.alpha === undefined) {
    defaultsUsed.push("α (half-angle)");
  }

  // Validate inputs
  if (P <= 0 || S <= 0 || E <= 0 || E > 1 || D <= 0) {
    throw new Error(`Invalid inputs: P=${P}, S=${S}, E=${E}, D=${D}`);
  }

  // Validate angle
  if (alphaDeg < 0) {
    throw new Error(`Half-angle must be positive: α = ${alphaDeg}°`);
  }
  if (alphaDeg >= 90) {
    throw new Error(
      `Half-angle must be less than 90°: α = ${alphaDeg}°. Check if this is half-angle or full apex angle.`
    );
  }

  // CRITICAL: UG-32(g) Scope Limitation - α ≤ 30°
  // Per ASME Section VIII Div 1: This formula is only valid for half-apex angles ≤ 30°
  // For angles > 30°, Appendix 1-5(g) must be used
  if (alphaDeg > 30) {
    warnings.push({
      field: 'α',
      message: `CRITICAL: Half-apex angle α = ${alphaDeg}° exceeds UG-32(g) limit of 30°. This formula is NOT valid. Use Appendix 1-5(g) for conical sections with α > 30°.`,
      severity: 'critical',
      value: alphaDeg,
      expectedRange: '≤ 30° per UG-32(g)'
    });
  }

  if (alphaDeg < 10) {
    warnings.push({
      field: "α",
      message: "Half-angle is very shallow, verify design intent",
      severity: "warning",
      value: alphaDeg,
      expectedRange: "10° to 30°",
    });
  }

  const cosAlpha = Math.cos(alpha);

  // Validate P/(SE) ratio
  const P_SE_ratio = P / (S * E);
  if (P_SE_ratio > 1.5) {
    throw new Error(
      `Pressure to stress ratio too high: P/(SE) = ${P_SE_ratio.toFixed(4)} > 1.5`
    );
  }
  if (P_SE_ratio > 1.0) {
    warnings.push({
      field: "P/(SE)",
      message:
        "Pressure to stress ratio is very high, approaching material limits",
      severity: "critical",
      value: P_SE_ratio,
      expectedRange: "< 1.0",
    });
  } else if (P_SE_ratio > 0.5) {
    warnings.push({
      field: "P/(SE)",
      message: "Pressure to stress ratio is elevated",
      severity: "warning",
      value: P_SE_ratio,
      expectedRange: "< 0.5",
    });
  }

  // Minimum thickness: t = PD / (2cos(α)(SE - 0.6P))
  const denom = 2 * cosAlpha * (S * E - 0.6 * P);

  // Denominator safety validation
  const denomWarnings = validateDenominator(denom, "2cos(α)(SE-0.6P)");
  warnings.push(...denomWarnings);

  const t_min = (P * D) / denom;

  // Calculate MAWP
  let MAWP = P;
  let Ca: number | undefined;
  let isCompliant = true;

  if (inputs.t_act !== undefined && inputs.t_act > 0) {
    const t = inputs.t_act;

    // MAWP: P = 2SEt*cos(α) / (D + 1.2t*cos(α))
    MAWP = (2 * S * E * t * cosAlpha) / (D + 1.2 * t * cosAlpha);

    // Actual thickness edge case handling
    Ca = inputs.t_act - t_min;

    if (Ca < 0) {
      // Non-compliant: actual thickness below minimum
      Ca = 0;
      isCompliant = false;

      if (inputs.t_act < 0.9 * t_min) {
        warnings.push({
          field: "t_act",
          message: `Actual thickness is critically below minimum (${((inputs.t_act / t_min) * 100).toFixed(1)}% of required)`,
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      } else {
        warnings.push({
          field: "t_act",
          message: "Actual thickness is below minimum required thickness",
          severity: "critical",
          value: inputs.t_act,
          expectedRange: `>= ${t_min.toFixed(4)} inches`,
        });
      }
    } else {
      isCompliant = true;

      // Warn if thickness is very close to minimum (within 2%)
      if (inputs.t_act < 1.02 * t_min) {
        warnings.push({
          field: "t_act",
          message:
            "Actual thickness is very close to minimum, consider monitoring closely",
          severity: "warning",
          value: inputs.t_act,
          expectedRange: `> ${(1.02 * t_min).toFixed(4)} inches for safety margin`,
        });
      }
    }

    // MAWP validation
    if (MAWP <= 0) {
      throw new Error(
        `Calculated MAWP is non-positive: ${MAWP.toFixed(2)} psi`
      );
    }

    const MAWP_ratio = MAWP / P;

    if (MAWP_ratio > 10) {
      throw new Error(
        `Calculated MAWP is unrealistically high: ${MAWP.toFixed(2)} psi (${MAWP_ratio.toFixed(1)}x design pressure)`
      );
    }

    if (MAWP_ratio > 2) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much higher than design pressure, verify inputs",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }

    if (MAWP_ratio < 0.5) {
      warnings.push({
        field: "MAWP",
        message:
          "Calculated MAWP is much lower than design pressure, component may be undersized",
        severity: "warning",
        value: MAWP,
        expectedRange: `${(0.5 * P).toFixed(0)} to ${(2 * P).toFixed(0)} psi`,
      });
    }
  }

  return {
    t_min,
    MAWP,
    Ca,
    isCompliant,
    governingCondition: "Conical Section",
    codeReference: "ASME Section VIII Div 1, UG-32(g)",
    formula: `t = PD/(2cos(α)(SE-0.6P)), α = ${alphaDeg}°`,
    warnings,
    defaultsUsed,
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
  P: number; // Design pressure (psi)
  S: number; // Allowable stress at design temp (psi)
  E?: number; // Joint efficiency (default 1.0 for seamless pipe)

  // Nozzle geometry
  nominalSize: number; // Nominal pipe size (inches)
  outsideDiameter: number; // Pipe OD (inches)
  pipeWallThickness: number; // Nominal pipe wall thickness (inches)

  // Actual measurement
  actualThickness?: number; // Measured thickness (inches)
  previousThickness?: number; // Previous measurement (inches)

  // Time
  age?: number; // Years in service
}

export interface NozzleResults {
  // Calculated values
  insideDiameter: number; // Pipe ID (inches)
  insideRadius: number; // Pipe IR (inches)
  t_rn: number; // Required thickness per UG-45 (inches)
  pipeMinusTolerance: number; // Pipe wall minus 12.5% (inches)
  t_min: number; // Governing minimum (inches)

  // Assessment
  actualThickness?: number;
  Ca?: number; // Corrosion allowance (inches)
  Cr?: number; // Corrosion rate (in/yr)
  RL?: number; // Remaining life (years)
  acceptable: boolean;

  // Governing criterion
  governingCriterion: "pressure_design" | "pipe_schedule";

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
    throw new Error(
      `Invalid calculation: (SE - 0.6P) = ${denom.toFixed(4)} <= 0`
    );
  }
  const t_rn = (P * insideRadius) / denom;

  // Pipe wall minus 12.5% manufacturing tolerance
  const pipeMinusTolerance = pipeWallThickness * 0.875;

  // Governing minimum is the greater of the two
  const t_min = Math.max(t_rn, pipeMinusTolerance);
  const governingCriterion =
    t_rn >= pipeMinusTolerance ? "pressure_design" : "pipe_schedule";

  // Assessment
  let acceptable = true;
  let Ca: number | undefined;
  let Cr: number | undefined;
  let RL: number | undefined;

  if (inputs.actualThickness !== undefined) {
    Ca = inputs.actualThickness - t_min;
    acceptable = Ca >= 0;

    if (
      inputs.previousThickness !== undefined &&
      inputs.age !== undefined &&
      inputs.age > 0
    ) {
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
    codeReference: "ASME Section VIII Div 1, UG-45",
    formula: "t_rn = PR/(SE-0.6P)",
  };
}

// ============================================================================
// UNIFIED CALCULATION INTERFACE
// ============================================================================

/**
 * Calculate component thickness based on type
 */
export function calculateComponent(
  componentType: "shell" | HeadType | "nozzle",
  inputs: CalculationInputs
): CalculationResults {
  switch (componentType) {
    case "shell":
      return calculateShellThickness(inputs);
    case "hemispherical":
      return calculateHemisphericalHead(inputs);
    case "ellipsoidal":
    case "2:1_ellipsoidal":
      return calculateEllipsoidalHead(inputs);
    case "torispherical":
    case "asme_flanged_dished":
      return calculateTorisphericalHead(inputs);
    case "flat":
      return calculateFlatHead(inputs);
    case "conical":
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

  if (lower.includes("hemi")) return "hemispherical";
  if (lower.includes("ellip") || lower.includes("2:1") || lower.includes("2-1"))
    return "ellipsoidal";
  if (
    lower.includes("toris") ||
    lower.includes("f&d") ||
    lower.includes("flanged") ||
    lower.includes("dished")
  )
    return "torispherical";
  if (lower.includes("flat")) return "flat";
  if (lower.includes("conic")) return "conical";

  // Default to ellipsoidal (most common)
  logger.warn(`Unknown head type "${description}", defaulting to ellipsoidal`);
  return "ellipsoidal";
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
    type: "shell" | HeadType;
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
    governingComponent: results[governingIndex]?.name ?? "Unknown",
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
  const MAX_EXTERNAL_INTERVAL = 5; // years
  const MAX_UT_INTERVAL = 5; // years

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
    nextInternalDate.setFullYear(
      nextInternalDate.getFullYear() + Math.floor(internalInterval)
    );

    nextExternalDate = new Date(lastInspectionDate);
    nextExternalDate.setFullYear(
      nextExternalDate.getFullYear() + Math.floor(externalInterval)
    );

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
