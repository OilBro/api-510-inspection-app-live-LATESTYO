/**
 * Material Stress Resolver
 * 
 * Resolves allowable stress values from either:
 * 1. ASME Section II Part D material database (preferred)
 * 2. Manual input (fallback)
 * 
 * This module ensures traceability and audit defensibility by documenting
 * the source of all stress values used in calculations.
 */

import { 
  getAllowableStressNormalized, 
  getDatabaseInfo,
  type AllowableStressResult 
} from "./asmeMaterialDatabase";

export interface StressResolutionResult {
  /** Resolved allowable stress value (psi) */
  stress: number;
  
  /** Source of the stress value */
  source: 'database' | 'manual';
  
  /** Material specification (if from database) */
  materialSpec?: string;
  
  /** Design temperature (if from database) */
  designTemperature?: number;
  
  /** Lookup status (if from database) */
  lookupStatus?: 'ok' | 'ok_interpolated' | 'error';
  
  /** Status message */
  message: string;
  
  /** Database version (if from database) */
  databaseVersion?: string;
  
  /** Table reference (if from database) */
  tableReference?: string;
  
  /** Whether interpolation was used */
  wasInterpolated?: boolean;
}

/**
 * Resolve allowable stress from material database or manual input.
 * 
 * Priority:
 * 1. If materialSpec and designTemperature are provided, use database lookup
 * 2. Otherwise, use the provided manual stress value (S)
 * 
 * @param manualStress - Manually provided stress value (psi)
 * @param materialSpec - ASME material specification (optional)
 * @param designTemperature - Design temperature in °F (optional)
 * @returns StressResolutionResult with resolved stress and traceability info
 */
export function resolveAllowableStress(
  manualStress: number,
  materialSpec?: string,
  designTemperature?: number
): StressResolutionResult {
  // If material spec and temperature are provided, try database lookup
  if (materialSpec && designTemperature !== undefined) {
    const lookupResult = getAllowableStressNormalized(materialSpec, designTemperature);
    
    if (lookupResult.stress !== null) {
      return {
        stress: lookupResult.stress,
        source: 'database',
        materialSpec: lookupResult.normalizedSpec || materialSpec,
        designTemperature,
        lookupStatus: lookupResult.status,
        message: lookupResult.message,
        databaseVersion: lookupResult.databaseVersion,
        tableReference: lookupResult.tableReference,
        wasInterpolated: lookupResult.status === 'ok_interpolated'
      };
    }
    
    // Database lookup failed - fall back to manual but warn
    return {
      stress: manualStress,
      source: 'manual',
      materialSpec,
      designTemperature,
      lookupStatus: 'error',
      message: `Database lookup failed: ${lookupResult.message}. Using manual stress value.`,
      databaseVersion: lookupResult.databaseVersion,
      tableReference: lookupResult.tableReference
    };
  }
  
  // No material spec provided - use manual stress
  return {
    stress: manualStress,
    source: 'manual',
    message: 'Using manually provided allowable stress value'
  };
}

/**
 * Validate that a stress value is reasonable for pressure vessel calculations.
 * 
 * @param stress - Stress value to validate (psi)
 * @returns Object with isValid flag and any warning messages
 */
export function validateStressValue(stress: number): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (stress <= 0) {
    return {
      isValid: false,
      warnings: ['Allowable stress must be positive']
    };
  }
  
  // Typical carbon steel stress range: 12,000 - 25,000 psi
  // Typical stainless steel stress range: 15,000 - 25,000 psi
  if (stress < 5000) {
    warnings.push(`Allowable stress ${stress} psi is unusually low. Verify material specification.`);
  }
  
  if (stress > 30000) {
    warnings.push(`Allowable stress ${stress} psi is unusually high. Verify material specification.`);
  }
  
  return {
    isValid: true,
    warnings
  };
}

/**
 * Get a formatted string describing the stress source for audit documentation.
 * 
 * @param result - StressResolutionResult from resolveAllowableStress
 * @returns Formatted string for audit trail
 */
export function formatStressSourceForAudit(result: StressResolutionResult): string {
  if (result.source === 'database') {
    const interpNote = result.wasInterpolated ? ' (interpolated)' : '';
    return `S = ${result.stress} psi per ASME Section II Part D, ${result.tableReference}, ` +
           `${result.materialSpec} at ${result.designTemperature}°F${interpNote} ` +
           `[Database Version: ${result.databaseVersion}]`;
  }
  
  return `S = ${result.stress} psi (manually entered)`;
}
