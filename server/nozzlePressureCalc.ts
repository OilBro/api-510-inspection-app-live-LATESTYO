/**
 * Nozzle Pressure Design Calculations per ASME Section VIII Division 1
 * UG-27: Thickness of Shells Under Internal Pressure
 * 
 * For nozzles, we calculate the required thickness based on the nozzle's
 * inside diameter and the vessel's design pressure, similar to how we would
 * calculate shell thickness.
 */

import { getAllowableStressNormalized } from './asmeMaterialDatabase';

export interface NozzlePressureCalcInput {
  nominalSize: string; // e.g., "2", "6", "12"
  outsideDiameter: number; // inches (from pipe schedule)
  wallThickness: number; // inches (from pipe schedule)
  designPressure: number; // psig
  designTemperature: number; // °F
  materialSpec?: string; // e.g., "SA-106 Grade B"
}

export interface NozzlePressureCalcResult {
  insideDiameter: number; // inches
  insideRadius: number; // inches
  allowableStress: number; // psi
  weldJointEfficiency: number; // typically 1.0 for seamless pipe
  requiredThickness: number; // inches (per UG-27)
  pipeNominalThickness: number; // inches
  pipeMinusTolerance: number; // inches (12.5% tolerance)
  minimumRequired: number; // inches (greater of required or pipe minus tolerance)
  governingCriterion: 'pressure_design' | 'pipe_schedule';
}

/**
 * Get allowable stress for pipe materials at temperature
 * Uses the authoritative ASME Section II Part D database with actual Table 1A values
 * and proper linear interpolation between temperature points.
 * 
 * Falls back to SA-106 Gr B (common seamless pipe) if material not found.
 */
function getAllowableStress(materialSpec: string | undefined, temperature: number): number {
  const material = materialSpec || 'SA-106 Gr B';
  const result = getAllowableStressNormalized(material, temperature);
  
  if (result.stress !== null) {
    return result.stress;
  }
  
  // Fallback: If material not found in authoritative database,
  // try SA-106 Gr B (most common nozzle pipe material)
  console.warn(
    `[nozzlePressureCalc] Material '${material}' not found in ASME database at ${temperature}°F. ` +
    `Using SA-106 Gr B as fallback. Error: ${result.message}`
  );
  const fallback = getAllowableStressNormalized('SA-106 Gr B', temperature);
  return fallback.stress ?? 15000; // Ultimate fallback: SA-106 Gr B room temp value
}

/**
 * Calculate nozzle minimum thickness per ASME UG-27
 * Formula: t = (P × R) / (S × E - 0.6 × P)
 * 
 * Where:
 * t = minimum required thickness (inches)
 * P = internal design pressure (psig)
 * R = inside radius (inches)
 * S = maximum allowable stress (psi)
 * E = weld joint efficiency (1.0 for seamless pipe)
 */
export function calculateNozzlePressureThickness(
  input: NozzlePressureCalcInput
): NozzlePressureCalcResult {
  // Calculate inside diameter
  const insideDiameter = input.outsideDiameter - (2 * input.wallThickness);
  const insideRadius = insideDiameter / 2;
  
  // Get allowable stress for material at design temperature
  const allowableStress = getAllowableStress(input.materialSpec, input.designTemperature);
  
  // Weld joint efficiency (1.0 for seamless pipe, which is standard for nozzles)
  const weldJointEfficiency = 1.0;
  
  // Calculate required thickness per UG-27
  // t = (P × R) / (S × E - 0.6 × P)
  const P = input.designPressure;
  const R = insideRadius;
  const S = allowableStress;
  const E = weldJointEfficiency;
  
  const requiredThickness = (P * R) / (S * E - 0.6 * P);
  
  // Pipe schedule thickness minus 12.5% manufacturing tolerance
  const pipeMinusTolerance = input.wallThickness * (1 - 0.125);
  
  // Minimum required is the greater of:
  // 1. Pressure design thickness
  // 2. Pipe schedule minus tolerance
  let minimumRequired: number;
  let governingCriterion: 'pressure_design' | 'pipe_schedule';
  
  if (requiredThickness > pipeMinusTolerance) {
    minimumRequired = requiredThickness;
    governingCriterion = 'pressure_design';
  } else {
    minimumRequired = pipeMinusTolerance;
    governingCriterion = 'pipe_schedule';
  }
  
  return {
    insideDiameter,
    insideRadius,
    allowableStress,
    weldJointEfficiency,
    requiredThickness,
    pipeNominalThickness: input.wallThickness,
    pipeMinusTolerance,
    minimumRequired,
    governingCriterion,
  };
}

