import { logger } from "./_core/logger";
/**
 * Nozzle Calculations per ASME Section VIII Division 1
 * 
 * Reference: ASME BPVC Section VIII Division 1
 * - UG-36: Openings in Pressure Vessels
 * - UG-37: Reinforcement Required for Openings in Shells and Formed Heads
 * - UG-38: Openings in Flat Heads
 * - UG-39: Reinforcement Required for Openings in Flat Heads
 * - UG-40: Limits of Reinforcement
 * - UG-41: Strength of Reinforcement
 * - UG-45: Minimum thickness of nozzle necks and other connections
 * - UG-16: Minimum thickness requirements
 * 
 * The minimum thickness of nozzle necks shall be the greater of:
 * 1. The thickness required by the rules for the shell or head to which it is attached
 * 2. The thickness of the standard pipe schedule
 * 3. The thickness required for the nozzle opening reinforcement calculations (UG-37)
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface NozzleCalculationInput {
  // Nozzle identification
  nozzleNumber: string;
  nominalSize: string; // e.g., "2", "6", "12"
  schedule: string; // e.g., "STD", "40", "XS", "80"
  
  // Pipe dimensions (from pipe schedule database)
  pipeNominalThickness: number; // inches
  pipeOutsideDiameter: number; // inches
  
  // Vessel shell/head parameters
  shellHeadRequiredThickness: number; // inches (from UG-27 or UG-32 calculations)
  
  // Actual measured thickness
  actualThickness?: number; // inches (from inspection)
  
  // Manufacturing tolerance - USER OVERRIDABLE
  manufacturingTolerance?: number; // Default 12.5% per ASME B36.10M
}

export interface ReinforcementInput {
  // Nozzle identification
  nozzleNumber: string;
  
  // Opening parameters
  d: number; // Finished diameter of circular opening (inches)
  
  // Shell/head parameters
  t: number; // Nominal thickness of shell or head (inches)
  tr: number; // Required thickness of shell or head per UG-27/UG-32 (inches)
  E1: number; // Joint efficiency of shell longitudinal joint (0-1)
  
  // Nozzle parameters
  tn: number; // Nominal thickness of nozzle wall (inches)
  trn: number; // Required thickness of nozzle wall per UG-27 (inches)
  fr1?: number; // Strength reduction factor for nozzle (default 1.0)
  fr2?: number; // Strength reduction factor for nozzle attachment (default 1.0)
  
  // Nozzle projection
  h?: number; // Inward projection of nozzle (inches, default 0)
  
  // Weld and pad parameters
  te?: number; // Thickness of reinforcing pad (inches, default 0)
  Dp?: number; // Outside diameter of reinforcing pad (inches)
  
  // Weld leg dimensions
  weldLegOutside?: number; // Outside weld leg dimension (inches)
  weldLegInside?: number; // Inside weld leg dimension (inches)
  
  // Material factors
  fr3?: number; // Strength reduction factor for pad material (default 1.0)
  fr4?: number; // Strength reduction factor for pad attachment (default 1.0)
  
  // Corrosion allowance
  corrosionAllowance?: number; // inches (default 0)
}

export interface ReinforcementResult {
  // Input echo
  nozzleNumber: string;
  
  // Required area
  A: number; // Total area required (sq in) per UG-37(c)
  
  // Available areas
  A1: number; // Area available in shell (sq in) per UG-37(d)(1)
  A2: number; // Area available in nozzle projecting outward (sq in) per UG-37(d)(2)
  A3: number; // Area available in nozzle projecting inward (sq in) per UG-37(d)(3)
  A41: number; // Area available in outward weld (sq in) per UG-37(d)(4)
  A42: number; // Area available in inward weld (sq in) per UG-37(d)(4)
  A43: number; // Area available in pad-to-nozzle weld (sq in) per UG-37(d)(4)
  A5: number; // Area available in reinforcing pad (sq in) per UG-37(d)(5)
  
  // Total available
  Aavail: number; // Total area available (sq in)
  
  // Assessment
  adequate: boolean; // Aavail >= A
  marginPercent: number; // ((Aavail - A) / A) * 100
  
  // Limits of reinforcement
  Rn: number; // Inside radius of nozzle (inches)
  d_limit: number; // Limit parallel to shell (inches) per UG-40(a)
  h_limit: number; // Limit perpendicular to shell - outward (inches) per UG-40(b)
  hi_limit: number; // Limit perpendicular to shell - inward (inches) per UG-40(c)
  
  // Notes and code references
  notes: string[];
  codeReference: string;
  warnings: string[];
}

export interface NozzleCalculationResult {
  // Input echo
  nozzleNumber: string;
  nominalSize: string;
  schedule: string;
  
  // Calculated values
  pipeNominalThickness: number; // inches
  pipeMinusManufacturingTolerance: number; // inches
  shellHeadRequiredThickness: number; // inches
  minimumRequired: number; // inches (governing thickness)
  
  // Assessment
  actualThickness?: number; // inches
  acceptable: boolean;
  marginAboveMinimum?: number; // inches
  marginPercent?: number; // %
  
  // Governing criterion
  governingCriterion: 'pipe_schedule' | 'shell_head_required' | 'reinforcement';
  
  // Reinforcement results (if calculated)
  reinforcement?: ReinforcementResult;
  
  // Notes
  notes: string[];
}

// ============================================================================
// UG-37 REINFORCEMENT AREA CALCULATIONS
// ============================================================================

/**
 * Calculate reinforcement requirements per ASME UG-37
 * 
 * Reference: ASME Section VIII Division 1, UG-37
 * 
 * The total cross-sectional area of reinforcement required for any plane
 * through the center of an opening shall be not less than:
 *   A = d × tr × F + 2 × tn × tr × F × (1 - fr1)
 * 
 * For openings in cylindrical shells (F = 1.0 for circumferential plane):
 *   A = d × tr
 * 
 * @param input - Reinforcement calculation input parameters
 * @returns ReinforcementResult with all area calculations
 */
export function calculateReinforcementArea(input: ReinforcementInput): ReinforcementResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  
  // Default values per ASME
  const fr1 = input.fr1 ?? 1.0; // Nozzle material same as shell
  const fr2 = input.fr2 ?? 1.0; // Nozzle attachment weld
  const fr3 = input.fr3 ?? 1.0; // Pad material same as shell
  const fr4 = input.fr4 ?? 1.0; // Pad attachment weld
  const h = input.h ?? 0; // No inward projection by default
  const te = input.te ?? 0; // No reinforcing pad by default
  const CA = input.corrosionAllowance ?? 0;
  const weldLegOutside = input.weldLegOutside ?? 0;
  const weldLegInside = input.weldLegInside ?? 0;
  
  // Corroded dimensions
  const t_corroded = input.t - CA;
  const tn_corroded = input.tn - CA;
  const d_corroded = input.d + 2 * CA; // Opening grows with corrosion
  
  notes.push(`=== UG-37 REINFORCEMENT CALCULATION ===`);
  notes.push(`Nozzle: ${input.nozzleNumber}`);
  notes.push(`Reference: ASME Section VIII Division 1, UG-37`);
  notes.push(``);
  
  // -------------------------------------------------------------------------
  // LIMITS OF REINFORCEMENT per UG-40
  // -------------------------------------------------------------------------
  
  // Inside radius of nozzle
  const Rn = (input.d - 2 * input.tn) / 2;
  
  // UG-40(a): Limit parallel to shell surface
  // The limit is the larger of: d or (Rn + tn + t)
  const d_limit = Math.max(d_corroded, Rn + tn_corroded + t_corroded);
  
  // UG-40(b): Limit perpendicular to shell surface (outward)
  // The smaller of: 2.5t or (2.5tn + te)
  const h_limit = Math.min(2.5 * t_corroded, 2.5 * tn_corroded + te);
  
  // UG-40(c): Limit perpendicular to shell surface (inward)
  // The smaller of: 2.5t or (2.5tn) or h
  const hi_limit = Math.min(2.5 * t_corroded, 2.5 * tn_corroded, h);
  
  notes.push(`--- LIMITS OF REINFORCEMENT (UG-40) ---`);
  notes.push(`Rn (nozzle inside radius): ${Rn.toFixed(4)} in`);
  notes.push(`d_limit (parallel to shell): MAX(${d_corroded.toFixed(4)}, ${(Rn + tn_corroded + t_corroded).toFixed(4)}) = ${d_limit.toFixed(4)} in [UG-40(a)]`);
  notes.push(`h_limit (outward): MIN(${(2.5 * t_corroded).toFixed(4)}, ${(2.5 * tn_corroded + te).toFixed(4)}) = ${h_limit.toFixed(4)} in [UG-40(b)]`);
  notes.push(`hi_limit (inward): MIN(${(2.5 * t_corroded).toFixed(4)}, ${(2.5 * tn_corroded).toFixed(4)}, ${h.toFixed(4)}) = ${hi_limit.toFixed(4)} in [UG-40(c)]`);
  notes.push(``);
  
  // -------------------------------------------------------------------------
  // REQUIRED AREA per UG-37(c)
  // -------------------------------------------------------------------------
  
  // For openings in cylindrical shells and cones, F = 1.0 for the plane
  // under consideration (circumferential plane - most conservative)
  const F = 1.0;
  
  // A = d × tr × F + 2 × tn × tr × F × (1 - fr1)
  // When fr1 = 1.0 (same material), second term = 0
  // Simplified: A = d × tr
  const A = d_corroded * input.tr * F + 2 * tn_corroded * input.tr * F * (1 - fr1);
  
  notes.push(`--- REQUIRED AREA (UG-37(c)) ---`);
  notes.push(`F (correction factor): ${F.toFixed(2)} [circumferential plane]`);
  notes.push(`A = d × tr × F + 2 × tn × tr × F × (1 - fr1)`);
  notes.push(`A = ${d_corroded.toFixed(4)} × ${input.tr.toFixed(4)} × ${F} + 2 × ${tn_corroded.toFixed(4)} × ${input.tr.toFixed(4)} × ${F} × (1 - ${fr1})`);
  notes.push(`A = ${A.toFixed(4)} sq in`);
  notes.push(``);
  
  // -------------------------------------------------------------------------
  // AVAILABLE AREAS per UG-37(d)
  // -------------------------------------------------------------------------
  
  notes.push(`--- AVAILABLE AREAS (UG-37(d)) ---`);
  
  // A1: Area available in shell (larger of two calculations)
  // A1 = (E1 × t - F × tr) × d_limit - 2 × tn × (E1 × t - F × tr) × (1 - fr1)
  // When fr1 = 1.0, simplified to: A1 = (E1 × t - F × tr) × (d_limit - 2 × tn)
  // But we use the simpler form: A1 = d × (E1 × t - F × tr) - 2 × tn × (E1 × t - F × tr) × (1 - fr1)
  const A1_calc1 = d_corroded * (input.E1 * t_corroded - F * input.tr) - 2 * tn_corroded * (input.E1 * t_corroded - F * input.tr) * (1 - fr1);
  const A1_calc2 = 2 * (t_corroded + tn_corroded) * (input.E1 * t_corroded - F * input.tr) - 2 * tn_corroded * (input.E1 * t_corroded - F * input.tr) * (1 - fr1);
  const A1 = Math.max(A1_calc1, A1_calc2, 0);
  
  notes.push(`A1 (shell area) [UG-37(d)(1)]:`);
  notes.push(`  Calc 1: d × (E1×t - F×tr) = ${d_corroded.toFixed(4)} × (${input.E1}×${t_corroded.toFixed(4)} - ${F}×${input.tr.toFixed(4)}) = ${A1_calc1.toFixed(4)} sq in`);
  notes.push(`  Calc 2: 2×(t+tn)×(E1×t - F×tr) = 2×(${t_corroded.toFixed(4)}+${tn_corroded.toFixed(4)})×(...) = ${A1_calc2.toFixed(4)} sq in`);
  notes.push(`  A1 = MAX(${A1_calc1.toFixed(4)}, ${A1_calc2.toFixed(4)}, 0) = ${A1.toFixed(4)} sq in`);
  
  // A2: Area available in nozzle projecting outward
  // A2 = (tn - trn) × fr2 × h_limit (for set-in nozzle)
  // For set-on nozzle: A2 = (tn - trn) × fr2 × 2 × h_limit
  // Using set-in formula (more common)
  const A2 = Math.max((tn_corroded - input.trn) * fr2 * 2 * h_limit, 0);
  
  notes.push(`A2 (nozzle outward) [UG-37(d)(2)]:`);
  notes.push(`  A2 = (tn - trn) × fr2 × 2 × h_limit`);
  notes.push(`  A2 = (${tn_corroded.toFixed(4)} - ${input.trn.toFixed(4)}) × ${fr2} × 2 × ${h_limit.toFixed(4)}`);
  notes.push(`  A2 = ${A2.toFixed(4)} sq in`);
  
  // A3: Area available in nozzle projecting inward
  // A3 = (tn - CA) × fr2 × 2 × hi_limit (inward projection)
  const A3 = h > 0 ? Math.max((tn_corroded - input.trn) * fr2 * 2 * hi_limit, 0) : 0;
  
  notes.push(`A3 (nozzle inward) [UG-37(d)(3)]:`);
  if (h > 0) {
    notes.push(`  A3 = (tn - trn) × fr2 × 2 × hi_limit`);
    notes.push(`  A3 = (${tn_corroded.toFixed(4)} - ${input.trn.toFixed(4)}) × ${fr2} × 2 × ${hi_limit.toFixed(4)}`);
    notes.push(`  A3 = ${A3.toFixed(4)} sq in`);
  } else {
    notes.push(`  A3 = 0 sq in (no inward projection)`);
  }
  
  // A41, A42, A43: Weld areas
  // A41 = (weldLegOutside)² (outward fillet weld to shell)
  // A42 = (weldLegInside)² (inward fillet weld to shell)
  // A43 = (weldLegOutside)² × fr3 (pad-to-nozzle weld, if pad exists)
  const A41 = weldLegOutside > 0 ? Math.pow(weldLegOutside, 2) : 0;
  const A42 = weldLegInside > 0 ? Math.pow(weldLegInside, 2) : 0;
  const A43 = (te > 0 && weldLegOutside > 0) ? Math.pow(weldLegOutside, 2) * fr3 : 0;
  
  notes.push(`A41 (outward weld) [UG-37(d)(4)]: ${A41.toFixed(4)} sq in`);
  notes.push(`A42 (inward weld) [UG-37(d)(4)]: ${A42.toFixed(4)} sq in`);
  notes.push(`A43 (pad-nozzle weld) [UG-37(d)(4)]: ${A43.toFixed(4)} sq in`);
  
  // A5: Area available in reinforcing pad
  // A5 = (Dp - d - 2×tn) × te × fr4
  // Limited by d_limit
  let A5 = 0;
  if (te > 0 && input.Dp) {
    const Dp_effective = Math.min(input.Dp, d_limit);
    A5 = Math.max((Dp_effective - d_corroded - 2 * tn_corroded) * te * fr4, 0);
    notes.push(`A5 (reinforcing pad) [UG-37(d)(5)]:`);
    notes.push(`  Dp_effective = MIN(${input.Dp.toFixed(4)}, ${d_limit.toFixed(4)}) = ${Dp_effective.toFixed(4)} in`);
    notes.push(`  A5 = (Dp_eff - d - 2×tn) × te × fr4`);
    notes.push(`  A5 = (${Dp_effective.toFixed(4)} - ${d_corroded.toFixed(4)} - 2×${tn_corroded.toFixed(4)}) × ${te.toFixed(4)} × ${fr4}`);
    notes.push(`  A5 = ${A5.toFixed(4)} sq in`);
  } else {
    notes.push(`A5 (reinforcing pad) [UG-37(d)(5)]: 0 sq in (no pad)`);
  }
  
  // -------------------------------------------------------------------------
  // TOTAL AVAILABLE AREA
  // -------------------------------------------------------------------------
  
  const Aavail = A1 + A2 + A3 + A41 + A42 + A43 + A5;
  
  notes.push(``);
  notes.push(`--- TOTAL AVAILABLE AREA ---`);
  notes.push(`Aavail = A1 + A2 + A3 + A41 + A42 + A43 + A5`);
  notes.push(`Aavail = ${A1.toFixed(4)} + ${A2.toFixed(4)} + ${A3.toFixed(4)} + ${A41.toFixed(4)} + ${A42.toFixed(4)} + ${A43.toFixed(4)} + ${A5.toFixed(4)}`);
  notes.push(`Aavail = ${Aavail.toFixed(4)} sq in`);
  notes.push(``);
  
  // -------------------------------------------------------------------------
  // ASSESSMENT
  // -------------------------------------------------------------------------
  
  const adequate = Aavail >= A;
  const marginPercent = A > 0 ? ((Aavail - A) / A) * 100 : 0;
  
  notes.push(`--- ASSESSMENT ---`);
  notes.push(`Required Area (A): ${A.toFixed(4)} sq in`);
  notes.push(`Available Area (Aavail): ${Aavail.toFixed(4)} sq in`);
  notes.push(`Margin: ${(Aavail - A).toFixed(4)} sq in (${marginPercent.toFixed(1)}%)`);
  
  if (adequate) {
    notes.push(`✓ ADEQUATE: Aavail (${Aavail.toFixed(4)}) >= A (${A.toFixed(4)})`);
  } else {
    notes.push(`✗ INADEQUATE: Aavail (${Aavail.toFixed(4)}) < A (${A.toFixed(4)})`);
    warnings.push(`REINFORCEMENT INADEQUATE: Additional reinforcement of ${(A - Aavail).toFixed(4)} sq in required`);
  }
  
  // Check for negative available areas (indicates calculation issues)
  if (A1 < 0 || A2 < 0 || A3 < 0) {
    warnings.push(`WARNING: Negative area calculated. Shell or nozzle may be below minimum required thickness.`);
  }
  
  return {
    nozzleNumber: input.nozzleNumber,
    A,
    A1,
    A2,
    A3,
    A41,
    A42,
    A43,
    A5,
    Aavail,
    adequate,
    marginPercent,
    Rn,
    d_limit,
    h_limit,
    hi_limit,
    notes,
    codeReference: "ASME Section VIII Division 1, UG-37",
    warnings,
  };
}

// ============================================================================
// UG-45 NOZZLE MINIMUM THICKNESS CALCULATIONS
// ============================================================================

/**
 * Calculate nozzle minimum thickness per ASME UG-45
 * 
 * The minimum thickness of nozzle necks shall be the greater of:
 * 1. The thickness required by the rules for the shell or head to which it is attached
 * 2. The thickness of the standard pipe schedule (minus manufacturing tolerance)
 * 3. The thickness required for the nozzle opening reinforcement calculations
 */
export function calculateNozzleMinimumThickness(
  input: NozzleCalculationInput
): NozzleCalculationResult {
  const notes: string[] = [];
  
  // Manufacturing tolerance - USER OVERRIDABLE (default 12.5% per ASME B36.10M)
  const tolerance = input.manufacturingTolerance ?? 0.125;
  
  // Pipe nominal thickness minus manufacturing tolerance
  const pipeMinusTolerance = input.pipeNominalThickness * (1 - tolerance);
  notes.push(`=== UG-45 NOZZLE MINIMUM THICKNESS ===`);
  notes.push(`Reference: ASME Section VIII Division 1, UG-45`);
  notes.push(``);
  notes.push(`Pipe nominal thickness: ${input.pipeNominalThickness.toFixed(4)} in`);
  notes.push(`Manufacturing tolerance: ${(tolerance * 100).toFixed(1)}% ${tolerance !== 0.125 ? '(USER OVERRIDE)' : '(ASME B36.10M default)'}`);
  notes.push(`Pipe minus tolerance: ${pipeMinusTolerance.toFixed(4)} in`);
  
  // Shell/head required thickness
  const shellRequired = input.shellHeadRequiredThickness;
  notes.push(`Shell/head required thickness: ${shellRequired.toFixed(4)} in`);
  
  // Determine minimum required thickness (governing criterion)
  // Per UG-45: The greater of pipe schedule or shell/head required
  let minimumRequired: number;
  let governingCriterion: 'pipe_schedule' | 'shell_head_required' | 'reinforcement';
  
  if (pipeMinusTolerance >= shellRequired) {
    minimumRequired = pipeMinusTolerance;
    governingCriterion = 'pipe_schedule';
    notes.push(`Governing: Pipe schedule (${pipeMinusTolerance.toFixed(4)} in >= ${shellRequired.toFixed(4)} in)`);
  } else {
    minimumRequired = shellRequired;
    governingCriterion = 'shell_head_required';
    notes.push(`Governing: Shell/head required (${shellRequired.toFixed(4)} in > ${pipeMinusTolerance.toFixed(4)} in)`);
  }
  
  // Assessment against actual thickness
  let acceptable = true;
  let marginAboveMinimum: number | undefined;
  let marginPercent: number | undefined;
  
  if (input.actualThickness !== undefined) {
    marginAboveMinimum = input.actualThickness - minimumRequired;
    marginPercent = (marginAboveMinimum / minimumRequired) * 100;
    acceptable = input.actualThickness >= minimumRequired;
    
    notes.push(``);
    notes.push(`--- ASSESSMENT ---`);
    if (acceptable) {
      notes.push(`✓ Acceptable: Actual ${input.actualThickness.toFixed(4)} in >= Required ${minimumRequired.toFixed(4)} in`);
      notes.push(`  Margin: ${marginAboveMinimum.toFixed(4)} in (${marginPercent.toFixed(1)}%)`);
    } else {
      notes.push(`✗ NOT Acceptable: Actual ${input.actualThickness.toFixed(4)} in < Required ${minimumRequired.toFixed(4)} in`);
      notes.push(`  Deficiency: ${Math.abs(marginAboveMinimum).toFixed(4)} in (${Math.abs(marginPercent).toFixed(1)}%)`);
    }
  } else {
    notes.push(``);
    notes.push(`No actual thickness provided - assessment pending inspection`);
  }
  
  return {
    nozzleNumber: input.nozzleNumber,
    nominalSize: input.nominalSize,
    schedule: input.schedule,
    pipeNominalThickness: input.pipeNominalThickness,
    pipeMinusManufacturingTolerance: pipeMinusTolerance,
    shellHeadRequiredThickness: shellRequired,
    minimumRequired,
    actualThickness: input.actualThickness,
    acceptable,
    marginAboveMinimum,
    marginPercent,
    governingCriterion,
    notes,
  };
}

/**
 * Calculate complete nozzle evaluation including UG-37 reinforcement
 */
export interface CompleteNozzleInput {
  // Basic nozzle info
  nozzleNumber: string;
  nominalSize: string;
  schedule: string;
  service?: string;
  
  // Pipe dimensions
  pipeNominalThickness: number;
  pipeOutsideDiameter: number;
  
  // Shell/head parameters
  shellThickness: number;
  shellRequiredThickness: number;
  shellInsideRadius: number;
  jointEfficiency: number;
  
  // Design parameters
  designPressure: number;
  allowableStress: number;
  
  // Actual measured thickness
  actualThickness?: number;
  
  // Manufacturing tolerance (user overridable)
  manufacturingTolerance?: number;
  
  // Corrosion allowance
  corrosionAllowance?: number;
  
  // Reinforcing pad (optional)
  padThickness?: number;
  padOutsideDiameter?: number;
  
  // Weld dimensions (optional)
  weldLegOutside?: number;
  weldLegInside?: number;
  
  // Inward projection (optional)
  inwardProjection?: number;
  
  // Nozzle-specific corrosion rate fields
  shortTermCorrosionRate?: number; // in/yr
  longTermCorrosionRate?: number; // in/yr
  corrosionRateType?: 'LT' | 'ST' | 'USER' | 'GOVERNING';
}

export interface CompleteNozzleResult {
  // UG-45 results
  ug45: NozzleCalculationResult;
  
  // UG-37 reinforcement results
  ug37: ReinforcementResult;
  
  // Overall assessment
  overallAcceptable: boolean;
  governingIssue?: string;
  
  // Corrosion data
  corrosionRate?: number;
  corrosionRateType?: string;
  remainingLife?: number;
  
  // Combined notes
  allNotes: string[];
  allWarnings: string[];
}

/**
 * Perform complete nozzle evaluation per ASME UG-37 and UG-45
 */
export function calculateCompleteNozzleEvaluation(
  input: CompleteNozzleInput
): CompleteNozzleResult {
  const allNotes: string[] = [];
  const allWarnings: string[] = [];
  
  // Calculate nozzle inside diameter
  const nozzleInsideDiameter = input.pipeOutsideDiameter - 2 * input.pipeNominalThickness;
  
  // Calculate required thickness for nozzle neck per UG-27
  // t = PR / (SE - 0.6P) for cylindrical nozzle
  const P = input.designPressure;
  const S = input.allowableStress;
  const E = 1.0; // Seamless pipe
  const R = nozzleInsideDiameter / 2;
  const trn = (P * R) / (S * E - 0.6 * P);
  
  // UG-45 calculation
  const ug45Result = calculateNozzleMinimumThickness({
    nozzleNumber: input.nozzleNumber,
    nominalSize: input.nominalSize,
    schedule: input.schedule,
    pipeNominalThickness: input.pipeNominalThickness,
    pipeOutsideDiameter: input.pipeOutsideDiameter,
    shellHeadRequiredThickness: input.shellRequiredThickness,
    actualThickness: input.actualThickness,
    manufacturingTolerance: input.manufacturingTolerance,
  });
  
  allNotes.push(...ug45Result.notes);
  allNotes.push(``);
  
  // UG-37 reinforcement calculation
  const ug37Result = calculateReinforcementArea({
    nozzleNumber: input.nozzleNumber,
    d: nozzleInsideDiameter + 2 * (input.corrosionAllowance ?? 0), // Finished opening diameter
    t: input.shellThickness,
    tr: input.shellRequiredThickness,
    E1: input.jointEfficiency,
    tn: input.pipeNominalThickness,
    trn: trn,
    h: input.inwardProjection,
    te: input.padThickness,
    Dp: input.padOutsideDiameter,
    weldLegOutside: input.weldLegOutside,
    weldLegInside: input.weldLegInside,
    corrosionAllowance: input.corrosionAllowance,
  });
  
  allNotes.push(...ug37Result.notes);
  allWarnings.push(...ug37Result.warnings);
  
  // Overall assessment
  const overallAcceptable = ug45Result.acceptable && ug37Result.adequate;
  let governingIssue: string | undefined;
  
  if (!ug45Result.acceptable) {
    governingIssue = `UG-45: Nozzle thickness below minimum required`;
  } else if (!ug37Result.adequate) {
    governingIssue = `UG-37: Reinforcement area inadequate`;
  }
  
  // Calculate remaining life if corrosion rate provided
  let remainingLife: number | undefined;
  let corrosionRate: number | undefined;
  let corrosionRateType: string | undefined;
  
  if (input.shortTermCorrosionRate !== undefined || input.longTermCorrosionRate !== undefined) {
    const stRate = input.shortTermCorrosionRate ?? 0;
    const ltRate = input.longTermCorrosionRate ?? 0;
    
    // Use governing (maximum) rate per API 510
    if (stRate >= ltRate) {
      corrosionRate = stRate;
      corrosionRateType = 'ST';
    } else {
      corrosionRate = ltRate;
      corrosionRateType = 'LT';
    }
    
    // Override if user specified
    if (input.corrosionRateType === 'USER') {
      corrosionRateType = 'USER';
    }
    
    // Calculate remaining life per API 510
    if (input.actualThickness !== undefined && corrosionRate > 0) {
      remainingLife = (input.actualThickness - ug45Result.minimumRequired) / corrosionRate;
      
      allNotes.push(``);
      allNotes.push(`--- REMAINING LIFE (API 510) ---`);
      allNotes.push(`Corrosion Rate: ${corrosionRate.toFixed(6)} in/yr (${corrosionRateType})`);
      allNotes.push(`Remaining Life = (t_actual - t_required) / CR`);
      allNotes.push(`Remaining Life = (${input.actualThickness.toFixed(4)} - ${ug45Result.minimumRequired.toFixed(4)}) / ${corrosionRate.toFixed(6)}`);
      allNotes.push(`Remaining Life = ${remainingLife.toFixed(2)} years`);
      
      if (remainingLife <= 4) {
        allWarnings.push(`API 510: Remaining life ≤ 4 years - Internal inspection required`);
      }
    }
  }
  
  return {
    ug45: ug45Result,
    ug37: ug37Result,
    overallAcceptable,
    governingIssue,
    corrosionRate,
    corrosionRateType,
    remainingLife,
    allNotes,
    allWarnings,
  };
}

/**
 * Calculate nozzle minimum thickness with pipe schedule lookup
 */
export interface NozzleWithScheduleLookup {
  nozzleNumber: string;
  nominalSize: string;
  schedule: string;
  shellHeadRequiredThickness: number;
  actualThickness?: number;
  manufacturingTolerance?: number;
  pipeScheduleData?: {
    outsideDiameter: number;
    wallThickness: number;
  };
}

export function calculateNozzleWithSchedule(
  input: NozzleWithScheduleLookup
): NozzleCalculationResult | null {
  if (!input.pipeScheduleData) {
    logger.error(`Pipe schedule data not found for ${input.nominalSize}" ${input.schedule}`);
    return null;
  }
  
  return calculateNozzleMinimumThickness({
    nozzleNumber: input.nozzleNumber,
    nominalSize: input.nominalSize,
    schedule: input.schedule,
    pipeNominalThickness: input.pipeScheduleData.wallThickness,
    pipeOutsideDiameter: input.pipeScheduleData.outsideDiameter,
    shellHeadRequiredThickness: input.shellHeadRequiredThickness,
    actualThickness: input.actualThickness,
    manufacturingTolerance: input.manufacturingTolerance,
  });
}

/**
 * Batch calculate multiple nozzles
 */
export function calculateMultipleNozzles(
  nozzles: NozzleWithScheduleLookup[]
): NozzleCalculationResult[] {
  const results: NozzleCalculationResult[] = [];
  
  for (const nozzle of nozzles) {
    const result = calculateNozzleWithSchedule(nozzle);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}
