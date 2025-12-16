import { logger } from "./_core/logger";
/**
 * Nozzle Minimum Thickness Calculations per ASME Section VIII Division 1, UG-45
 * 
 * Reference: ASME BPVC Section VIII Division 1
 * - UG-45: Minimum thickness of nozzle necks and other connections
 * - UG-16: Minimum thickness requirements
 * 
 * The minimum thickness of nozzle necks shall be the greater of:
 * 1. The thickness required by the rules for the shell or head to which it is attached
 * 2. The thickness of the standard pipe schedule
 * 3. The thickness required for the nozzle opening reinforcement calculations
 */

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
  
  // Manufacturing tolerance
  manufacturingTolerance?: number; // Default 12.5% per ASME B36.10M
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
  
  // Notes
  notes: string[];
}

/**
 * Calculate nozzle minimum thickness per ASME UG-45
 */
export function calculateNozzleMinimumThickness(
  input: NozzleCalculationInput
): NozzleCalculationResult {
  const notes: string[] = [];
  
  // Manufacturing tolerance (default 12.5% per ASME B36.10M)
  const tolerance = input.manufacturingTolerance ?? 0.125;
  
  // Pipe nominal thickness minus manufacturing tolerance
  const pipeMinusTolerance = input.pipeNominalThickness * (1 - tolerance);
  notes.push(`Pipe nominal thickness: ${input.pipeNominalThickness.toFixed(4)} in`);
  notes.push(`Manufacturing tolerance: ${(tolerance * 100).toFixed(1)}%`);
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
    notes.push(`Governing: Pipe schedule (${pipeMinusTolerance.toFixed(4)} in > ${shellRequired.toFixed(4)} in)`);
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
    
    if (acceptable) {
      notes.push(`✓ Acceptable: Actual ${input.actualThickness.toFixed(4)} in >= Required ${minimumRequired.toFixed(4)} in`);
      notes.push(`  Margin: ${marginAboveMinimum.toFixed(4)} in (${marginPercent.toFixed(1)}%)`);
    } else {
      notes.push(`✗ NOT Acceptable: Actual ${input.actualThickness.toFixed(4)} in < Required ${minimumRequired.toFixed(4)} in`);
      notes.push(`  Deficiency: ${Math.abs(marginAboveMinimum).toFixed(4)} in (${Math.abs(marginPercent).toFixed(1)}%)`);
    }
  } else {
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
 * Calculate nozzle minimum thickness with pipe schedule lookup
 */
export interface NozzleWithScheduleLookup {
  nozzleNumber: string;
  nominalSize: string;
  schedule: string;
  shellHeadRequiredThickness: number;
  actualThickness?: number;
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

