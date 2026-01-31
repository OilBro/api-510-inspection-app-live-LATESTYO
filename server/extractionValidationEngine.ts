/**
 * Gold-Standard Extraction Validation Engine
 * 
 * Implements physical reasonableness checks for extracted PDF data
 * per API 510 and ASME VIII-1 requirements.
 * 
 * Code References:
 * - API 510 §5.2: Inspection Data Requirements
 * - ASME VIII-1 UG-27/UG-32: Thickness Requirements
 * - API 510 §7.1.1: Corrosion Rate Determination
 */

import { nanoid } from 'nanoid';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UnitValue {
  value: number;
  unit: string;
  rawText?: string;
}

export interface ValidationResult {
  isValid: boolean;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string;
  codeReference?: string;
  suggestedCorrection?: string;
  confidenceScore?: number;
}

export interface FieldValidation {
  fieldName: string;
  rawValue: string | number | null;
  parsedValue: string | number | null;
  parsedUnit?: string;
  validation: ValidationResult;
  pageNumber?: number;
  parserSource: string;
}

export interface VesselValidationInput {
  designPressure?: UnitValue | number;
  designTemperature?: UnitValue | number;
  insideDiameter?: UnitValue | number;
  shellLength?: UnitValue | number;
  nominalThickness?: UnitValue | number;
  materialSpec?: string;
  jointEfficiency?: number;
  corrosionAllowance?: UnitValue | number;
  vesselOrientation?: 'horizontal' | 'vertical';
  headType?: string;
}

export interface TMLValidationInput {
  cmlNumber?: string;
  location?: string;
  componentType?: string;
  tActual?: UnitValue | number;
  tPrevious?: UnitValue | number;
  tNominal?: UnitValue | number;
  inspectionDate?: Date | string;
  previousInspectionDate?: Date | string;
}

// ============================================================================
// PHYSICAL REASONABLENESS RULES
// ============================================================================

/**
 * Physical limits for pressure vessel parameters
 * Based on typical API 510 inspection ranges
 */
const PHYSICAL_LIMITS = {
  // Pressure limits (psig)
  pressure: {
    min: 0,
    max: 15000,
    typicalMax: 3000,
    warningThreshold: 5000
  },
  
  // Temperature limits (°F)
  temperature: {
    min: -320, // Cryogenic
    max: 1500,
    typicalMin: -50,
    typicalMax: 1000
  },
  
  // Diameter limits (inches)
  diameter: {
    min: 6,
    max: 600,
    typicalMin: 12,
    typicalMax: 240
  },
  
  // Thickness limits (inches)
  thickness: {
    min: 0.0625, // 1/16"
    max: 6.0,
    typicalMin: 0.125,
    typicalMax: 2.0,
    minMeasurable: 0.050 // Below this, measurement is suspect
  },
  
  // Length limits (inches)
  length: {
    min: 12,
    max: 2400, // 200 feet
    typicalMax: 600
  },
  
  // Joint efficiency limits
  jointEfficiency: {
    min: 0.45,
    max: 1.0,
    validValues: [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80, 0.85, 1.0]
  },
  
  // Corrosion allowance limits (inches)
  corrosionAllowance: {
    min: 0,
    max: 0.500,
    typical: 0.125
  },
  
  // Corrosion rate limits (mpy - mils per year)
  corrosionRate: {
    min: 0,
    max: 100,
    typicalMax: 20,
    warningThreshold: 10
  }
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Extract numeric value from UnitValue or number
 */
function extractValue(input: UnitValue | number | undefined | null): number | null {
  if (input === undefined || input === null) return null;
  if (typeof input === 'number') return input;
  return input.value;
}

/**
 * Validate design pressure
 */
export function validateDesignPressure(pressure: UnitValue | number | undefined): ValidationResult {
  const value = extractValue(pressure);
  
  if (value === null) {
    return {
      isValid: false,
      status: 'failed',
      message: 'Design pressure is required',
      codeReference: 'API 510 §5.2'
    };
  }
  
  if (value < PHYSICAL_LIMITS.pressure.min) {
    return {
      isValid: false,
      status: 'failed',
      message: `Design pressure ${value} psig is below minimum (${PHYSICAL_LIMITS.pressure.min} psig)`,
      codeReference: 'API 510 §5.2'
    };
  }
  
  if (value > PHYSICAL_LIMITS.pressure.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `Design pressure ${value} psig exceeds maximum reasonable value (${PHYSICAL_LIMITS.pressure.max} psig)`,
      codeReference: 'API 510 §5.2',
      suggestedCorrection: 'Verify pressure units (psig vs kPa)'
    };
  }
  
  if (value > PHYSICAL_LIMITS.pressure.warningThreshold) {
    return {
      isValid: true,
      status: 'warning',
      message: `Design pressure ${value} psig is unusually high - verify extraction`,
      codeReference: 'API 510 §5.2'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Design pressure ${value} psig is within acceptable range`,
    codeReference: 'API 510 §5.2',
    confidenceScore: 0.95
  };
}

/**
 * Validate design temperature
 */
export function validateDesignTemperature(temperature: UnitValue | number | undefined): ValidationResult {
  const value = extractValue(temperature);
  
  if (value === null) {
    return {
      isValid: false,
      status: 'failed',
      message: 'Design temperature is required',
      codeReference: 'API 510 §5.2'
    };
  }
  
  if (value < PHYSICAL_LIMITS.temperature.min || value > PHYSICAL_LIMITS.temperature.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `Design temperature ${value}°F is outside physical limits (${PHYSICAL_LIMITS.temperature.min} to ${PHYSICAL_LIMITS.temperature.max}°F)`,
      codeReference: 'API 510 §5.2',
      suggestedCorrection: 'Verify temperature units (°F vs °C)'
    };
  }
  
  if (value < PHYSICAL_LIMITS.temperature.typicalMin || value > PHYSICAL_LIMITS.temperature.typicalMax) {
    return {
      isValid: true,
      status: 'warning',
      message: `Design temperature ${value}°F is outside typical range - verify extraction`,
      codeReference: 'API 510 §5.2'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Design temperature ${value}°F is within acceptable range`,
    codeReference: 'API 510 §5.2',
    confidenceScore: 0.95
  };
}

/**
 * Validate inside diameter
 */
export function validateInsideDiameter(diameter: UnitValue | number | undefined): ValidationResult {
  const value = extractValue(diameter);
  
  if (value === null) {
    return {
      isValid: false,
      status: 'failed',
      message: 'Inside diameter is required for thickness calculations',
      codeReference: 'ASME VIII-1 UG-27'
    };
  }
  
  if (value < PHYSICAL_LIMITS.diameter.min || value > PHYSICAL_LIMITS.diameter.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `Inside diameter ${value}" is outside physical limits (${PHYSICAL_LIMITS.diameter.min} to ${PHYSICAL_LIMITS.diameter.max}")`,
      codeReference: 'ASME VIII-1 UG-27',
      suggestedCorrection: 'Verify diameter units (inches vs mm)'
    };
  }
  
  if (value < PHYSICAL_LIMITS.diameter.typicalMin || value > PHYSICAL_LIMITS.diameter.typicalMax) {
    return {
      isValid: true,
      status: 'warning',
      message: `Inside diameter ${value}" is outside typical range - verify extraction`,
      codeReference: 'ASME VIII-1 UG-27'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Inside diameter ${value}" is within acceptable range`,
    codeReference: 'ASME VIII-1 UG-27',
    confidenceScore: 0.95
  };
}

/**
 * Validate thickness measurement
 */
export function validateThickness(
  thickness: UnitValue | number | undefined,
  fieldName: string = 'Thickness'
): ValidationResult {
  const value = extractValue(thickness);
  
  if (value === null) {
    return {
      isValid: false,
      status: 'failed',
      message: `${fieldName} is required`,
      codeReference: 'API 510 §7.1'
    };
  }
  
  if (value < PHYSICAL_LIMITS.thickness.minMeasurable) {
    return {
      isValid: false,
      status: 'failed',
      message: `${fieldName} ${value}" is below measurable threshold (${PHYSICAL_LIMITS.thickness.minMeasurable}")`,
      codeReference: 'API 510 §7.1',
      suggestedCorrection: 'Verify measurement or consider component replacement'
    };
  }
  
  if (value < PHYSICAL_LIMITS.thickness.min || value > PHYSICAL_LIMITS.thickness.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `${fieldName} ${value}" is outside physical limits (${PHYSICAL_LIMITS.thickness.min} to ${PHYSICAL_LIMITS.thickness.max}")`,
      codeReference: 'API 510 §7.1',
      suggestedCorrection: 'Verify thickness units (inches vs mm)'
    };
  }
  
  if (value < PHYSICAL_LIMITS.thickness.typicalMin || value > PHYSICAL_LIMITS.thickness.typicalMax) {
    return {
      isValid: true,
      status: 'warning',
      message: `${fieldName} ${value}" is outside typical range - verify extraction`,
      codeReference: 'API 510 §7.1'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `${fieldName} ${value}" is within acceptable range`,
    codeReference: 'API 510 §7.1',
    confidenceScore: 0.95
  };
}

/**
 * Validate joint efficiency
 */
export function validateJointEfficiency(efficiency: number | undefined): ValidationResult {
  if (efficiency === undefined || efficiency === null) {
    return {
      isValid: true,
      status: 'warning',
      message: 'Joint efficiency not specified - will use default based on weld type',
      codeReference: 'ASME VIII-1 UW-12'
    };
  }
  
  if (efficiency < PHYSICAL_LIMITS.jointEfficiency.min || efficiency > PHYSICAL_LIMITS.jointEfficiency.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `Joint efficiency ${efficiency} is outside valid range (${PHYSICAL_LIMITS.jointEfficiency.min} to ${PHYSICAL_LIMITS.jointEfficiency.max})`,
      codeReference: 'ASME VIII-1 UW-12'
    };
  }
  
  // Check if it's a standard value
  const isStandardValue = PHYSICAL_LIMITS.jointEfficiency.validValues.some(
    v => Math.abs(v - efficiency) < 0.01
  );
  
  if (!isStandardValue) {
    return {
      isValid: true,
      status: 'warning',
      message: `Joint efficiency ${efficiency} is not a standard ASME value - verify extraction`,
      codeReference: 'ASME VIII-1 UW-12',
      suggestedCorrection: `Standard values: ${PHYSICAL_LIMITS.jointEfficiency.validValues.join(', ')}`
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Joint efficiency ${efficiency} is a valid ASME value`,
    codeReference: 'ASME VIII-1 UW-12',
    confidenceScore: 0.98
  };
}

/**
 * Validate material specification format
 */
export function validateMaterialSpec(materialSpec: string | undefined): ValidationResult {
  if (!materialSpec) {
    return {
      isValid: false,
      status: 'failed',
      message: 'Material specification is required for allowable stress lookup',
      codeReference: 'ASME II-D Table 1A'
    };
  }
  
  // Common ASME material patterns
  const validPatterns = [
    /^SA-\d{2,3}(\s+Gr(ade)?\.?\s*\d+)?$/i,  // SA-516 Grade 70
    /^SA-\d{2,3}-\d+$/i,                       // SA-516-70
    /^A-?\d{2,3}(\s+Gr\.?\s*\d+)?$/i,         // A516 Gr 70
    /^ASTM\s*A-?\d{2,3}/i,                     // ASTM A516
    /^SB-\d{2,3}/i,                            // SB-xxx (non-ferrous)
  ];
  
  const isValidFormat = validPatterns.some(pattern => pattern.test(materialSpec.trim()));
  
  if (!isValidFormat) {
    return {
      isValid: true,
      status: 'warning',
      message: `Material specification "${materialSpec}" may not be in standard ASME format`,
      codeReference: 'ASME II-D Table 1A',
      suggestedCorrection: 'Expected format: SA-516 Grade 70 or SA-516-70'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Material specification "${materialSpec}" is in valid ASME format`,
    codeReference: 'ASME II-D Table 1A',
    confidenceScore: 0.90
  };
}

// ============================================================================
// CROSS-FIELD VALIDATION
// ============================================================================

/**
 * Validate thickness relationships (t_actual vs t_previous vs t_nominal)
 */
export function validateThicknessRelationships(
  tActual: number | undefined,
  tPrevious: number | undefined,
  tNominal: number | undefined
): ValidationResult {
  const results: string[] = [];
  let hasWarning = false;
  let hasFailed = false;
  
  // t_actual should be <= t_previous (corrosion occurs)
  if (tActual !== undefined && tPrevious !== undefined) {
    if (tActual > tPrevious * 1.01) { // Allow 1% tolerance for measurement error
      results.push(`t_actual (${tActual}") > t_previous (${tPrevious}") - indicates measurement error or data swap`);
      hasWarning = true;
    }
  }
  
  // t_actual should be <= t_nominal
  if (tActual !== undefined && tNominal !== undefined) {
    if (tActual > tNominal * 1.05) { // Allow 5% for mill tolerance
      results.push(`t_actual (${tActual}") > t_nominal (${tNominal}") - verify nominal thickness`);
      hasWarning = true;
    }
  }
  
  // t_previous should be <= t_nominal
  if (tPrevious !== undefined && tNominal !== undefined) {
    if (tPrevious > tNominal * 1.05) {
      results.push(`t_previous (${tPrevious}") > t_nominal (${tNominal}") - verify nominal thickness`);
      hasWarning = true;
    }
  }
  
  // Check for unreasonable corrosion (> 50% loss)
  if (tActual !== undefined && tNominal !== undefined) {
    const lossPercent = ((tNominal - tActual) / tNominal) * 100;
    if (lossPercent > 50) {
      results.push(`Thickness loss ${lossPercent.toFixed(1)}% exceeds 50% - component may require replacement`);
      hasWarning = true;
    }
  }
  
  if (results.length === 0) {
    return {
      isValid: true,
      status: 'passed',
      message: 'Thickness relationships are consistent',
      codeReference: 'API 510 §7.1.1',
      confidenceScore: 0.95
    };
  }
  
  return {
    isValid: !hasFailed,
    status: hasFailed ? 'failed' : 'warning',
    message: results.join('; '),
    codeReference: 'API 510 §7.1.1'
  };
}

/**
 * Validate corrosion rate reasonableness
 */
export function validateCorrosionRate(
  tActual: number | undefined,
  tPrevious: number | undefined,
  yearsBetweenInspections: number | undefined
): ValidationResult {
  if (tActual === undefined || tPrevious === undefined || yearsBetweenInspections === undefined) {
    return {
      isValid: true,
      status: 'pending',
      message: 'Insufficient data to calculate corrosion rate',
      codeReference: 'API 510 §7.1.1'
    };
  }
  
  if (yearsBetweenInspections <= 0) {
    return {
      isValid: false,
      status: 'failed',
      message: 'Invalid inspection interval - must be > 0 years',
      codeReference: 'API 510 §7.1.1'
    };
  }
  
  const thicknessLoss = tPrevious - tActual;
  const corrosionRateMPY = (thicknessLoss * 1000) / yearsBetweenInspections; // mils per year
  
  if (corrosionRateMPY < 0) {
    return {
      isValid: false,
      status: 'failed',
      message: `Negative corrosion rate (${corrosionRateMPY.toFixed(2)} mpy) - t_actual > t_previous indicates data error`,
      codeReference: 'API 510 §7.1.1',
      suggestedCorrection: 'Verify thickness values are not swapped'
    };
  }
  
  if (corrosionRateMPY > PHYSICAL_LIMITS.corrosionRate.max) {
    return {
      isValid: false,
      status: 'failed',
      message: `Corrosion rate ${corrosionRateMPY.toFixed(2)} mpy exceeds maximum reasonable value (${PHYSICAL_LIMITS.corrosionRate.max} mpy)`,
      codeReference: 'API 510 §7.1.1',
      suggestedCorrection: 'Verify thickness measurements and inspection dates'
    };
  }
  
  if (corrosionRateMPY > PHYSICAL_LIMITS.corrosionRate.warningThreshold) {
    return {
      isValid: true,
      status: 'warning',
      message: `Corrosion rate ${corrosionRateMPY.toFixed(2)} mpy is high - verify measurements`,
      codeReference: 'API 510 §7.1.1'
    };
  }
  
  return {
    isValid: true,
    status: 'passed',
    message: `Corrosion rate ${corrosionRateMPY.toFixed(2)} mpy is within acceptable range`,
    codeReference: 'API 510 §7.1.1',
    confidenceScore: 0.90
  };
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Validate complete vessel data extraction
 */
export function validateVesselData(vessel: VesselValidationInput): {
  validations: FieldValidation[];
  overallStatus: 'passed' | 'failed' | 'warning' | 'pending';
  completenessScore: number;
  physicalValidationPassRate: number;
} {
  const validations: FieldValidation[] = [];
  let passedCount = 0;
  let totalRequired = 0;
  let fieldsPresent = 0;
  const requiredFields = ['designPressure', 'designTemperature', 'insideDiameter', 'materialSpec'];
  
  // Validate design pressure
  const pressureResult = validateDesignPressure(vessel.designPressure);
  validations.push({
    fieldName: 'designPressure',
    rawValue: extractValue(vessel.designPressure),
    parsedValue: extractValue(vessel.designPressure),
    parsedUnit: 'psig',
    validation: pressureResult,
    parserSource: 'extraction'
  });
  totalRequired++;
  if (pressureResult.status === 'passed') passedCount++;
  if (vessel.designPressure !== undefined) fieldsPresent++;
  
  // Validate design temperature
  const tempResult = validateDesignTemperature(vessel.designTemperature);
  validations.push({
    fieldName: 'designTemperature',
    rawValue: extractValue(vessel.designTemperature),
    parsedValue: extractValue(vessel.designTemperature),
    parsedUnit: '°F',
    validation: tempResult,
    parserSource: 'extraction'
  });
  totalRequired++;
  if (tempResult.status === 'passed') passedCount++;
  if (vessel.designTemperature !== undefined) fieldsPresent++;
  
  // Validate inside diameter
  const diameterResult = validateInsideDiameter(vessel.insideDiameter);
  validations.push({
    fieldName: 'insideDiameter',
    rawValue: extractValue(vessel.insideDiameter),
    parsedValue: extractValue(vessel.insideDiameter),
    parsedUnit: 'inches',
    validation: diameterResult,
    parserSource: 'extraction'
  });
  totalRequired++;
  if (diameterResult.status === 'passed') passedCount++;
  if (vessel.insideDiameter !== undefined) fieldsPresent++;
  
  // Validate material spec
  const materialResult = validateMaterialSpec(vessel.materialSpec);
  validations.push({
    fieldName: 'materialSpec',
    rawValue: vessel.materialSpec || null,
    parsedValue: vessel.materialSpec || null,
    validation: materialResult,
    parserSource: 'extraction'
  });
  totalRequired++;
  if (materialResult.status === 'passed') passedCount++;
  if (vessel.materialSpec) fieldsPresent++;
  
  // Validate joint efficiency (optional)
  if (vessel.jointEfficiency !== undefined) {
    const efficiencyResult = validateJointEfficiency(vessel.jointEfficiency);
    validations.push({
      fieldName: 'jointEfficiency',
      rawValue: vessel.jointEfficiency,
      parsedValue: vessel.jointEfficiency,
      validation: efficiencyResult,
      parserSource: 'extraction'
    });
    if (efficiencyResult.status === 'passed') passedCount++;
    fieldsPresent++;
  }
  
  // Validate nominal thickness (optional)
  if (vessel.nominalThickness !== undefined) {
    const thicknessResult = validateThickness(vessel.nominalThickness, 'Nominal thickness');
    validations.push({
      fieldName: 'nominalThickness',
      rawValue: extractValue(vessel.nominalThickness),
      parsedValue: extractValue(vessel.nominalThickness),
      parsedUnit: 'inches',
      validation: thicknessResult,
      parserSource: 'extraction'
    });
    if (thicknessResult.status === 'passed') passedCount++;
    fieldsPresent++;
  }
  
  // Calculate scores
  const completenessScore = (fieldsPresent / requiredFields.length) * 100;
  const physicalValidationPassRate = totalRequired > 0 ? (passedCount / totalRequired) * 100 : 0;
  
  // Determine overall status
  const hasFailed = validations.some(v => v.validation.status === 'failed');
  const hasWarning = validations.some(v => v.validation.status === 'warning');
  
  let overallStatus: 'passed' | 'failed' | 'warning' | 'pending' = 'passed';
  if (hasFailed) overallStatus = 'failed';
  else if (hasWarning) overallStatus = 'warning';
  else if (completenessScore < 100) overallStatus = 'pending';
  
  return {
    validations,
    overallStatus,
    completenessScore,
    physicalValidationPassRate
  };
}

/**
 * Validate TML reading extraction
 */
export function validateTMLReading(tml: TMLValidationInput): {
  validations: FieldValidation[];
  overallStatus: 'passed' | 'failed' | 'warning' | 'pending';
} {
  const validations: FieldValidation[] = [];
  
  // Validate t_actual
  if (tml.tActual !== undefined) {
    const result = validateThickness(tml.tActual, 't_actual');
    validations.push({
      fieldName: 'tActual',
      rawValue: extractValue(tml.tActual),
      parsedValue: extractValue(tml.tActual),
      parsedUnit: 'inches',
      validation: result,
      parserSource: 'extraction'
    });
  }
  
  // Validate t_previous
  if (tml.tPrevious !== undefined) {
    const result = validateThickness(tml.tPrevious, 't_previous');
    validations.push({
      fieldName: 'tPrevious',
      rawValue: extractValue(tml.tPrevious),
      parsedValue: extractValue(tml.tPrevious),
      parsedUnit: 'inches',
      validation: result,
      parserSource: 'extraction'
    });
  }
  
  // Validate t_nominal
  if (tml.tNominal !== undefined) {
    const result = validateThickness(tml.tNominal, 't_nominal');
    validations.push({
      fieldName: 'tNominal',
      rawValue: extractValue(tml.tNominal),
      parsedValue: extractValue(tml.tNominal),
      parsedUnit: 'inches',
      validation: result,
      parserSource: 'extraction'
    });
  }
  
  // Cross-field validation: thickness relationships
  const tActualVal = extractValue(tml.tActual) ?? undefined;
  const tPreviousVal = extractValue(tml.tPrevious) ?? undefined;
  const tNominalVal = extractValue(tml.tNominal) ?? undefined;
  
  if (tActualVal !== undefined || tPreviousVal !== undefined || tNominalVal !== undefined) {
    const relationshipResult = validateThicknessRelationships(tActualVal, tPreviousVal, tNominalVal);
    validations.push({
      fieldName: 'thicknessRelationships',
      rawValue: null,
      parsedValue: null,
      validation: relationshipResult,
      parserSource: 'cross-field'
    });
  }
  
  // Determine overall status
  const hasFailed = validations.some(v => v.validation.status === 'failed');
  const hasWarning = validations.some(v => v.validation.status === 'warning');
  
  let overallStatus: 'passed' | 'failed' | 'warning' | 'pending' = 'passed';
  if (hasFailed) overallStatus = 'failed';
  else if (hasWarning) overallStatus = 'warning';
  
  return {
    validations,
    overallStatus
  };
}

/**
 * Generate extraction audit entry ID
 */
export function generateAuditEntryId(): string {
  return `audit_${nanoid(16)}`;
}

/**
 * Calculate overall extraction quality
 */
export function calculateExtractionQuality(
  vesselCompleteness: number,
  tmlCompleteness: number,
  physicalValidationPassRate: number
): 'complete' | 'partial' | 'needs_review' | 'failed' {
  const avgCompleteness = (vesselCompleteness + tmlCompleteness) / 2;
  
  if (physicalValidationPassRate < 50) return 'failed';
  if (avgCompleteness >= 90 && physicalValidationPassRate >= 90) return 'complete';
  if (avgCompleteness >= 70 && physicalValidationPassRate >= 70) return 'partial';
  return 'needs_review';
}
