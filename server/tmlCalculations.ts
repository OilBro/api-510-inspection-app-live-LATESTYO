/**
 * TML (Thickness Measurement Location) Calculation Engine
 * 
 * Implements all thickness-related calculations per:
 * - API 510 - Pressure Vessel Inspection Code
 * - ASME Section VIII Division 1 - Rules for Construction of Pressure Vessels
 * 
 * CALCULATION INTEGRITY RULE: All thickness data and derived calculations must be
 * traceable, auditable, and compliant with the governing codes. Missing data halts
 * calculations—no interpolation or estimation is permitted.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type CorrosionRateType = 'LT' | 'ST' | 'USER' | 'GOVERNING';
export type DataQualityStatus = 'good' | 'anomaly' | 'growth_error' | 'below_minimum' | 'confirmed';
export type TMLStatus = 'critical' | 'alert' | 'acceptable' | 'unknown';
export type InspectionType = 'Internal' | 'External' | 'On-stream' | 'IMMEDIATE';

export interface TMLReadings {
  tml1: number | null;
  tml2: number | null;
  tml3: number | null;
  tml4: number | null;
  tml5?: number | null;
  tml6?: number | null;
  tml7?: number | null;
  tml8?: number | null;
}

export interface CorrosionRateInput {
  tActual: number;
  nominalThickness: number | null;
  previousThickness: number | null;
  previousInspectionDate: Date | null;
  currentInspectionDate: Date;
  originalInstallDate: Date | null;
}

export interface CorrosionRateResult {
  shortTermRate: number | null;
  longTermRate: number | null;
  governingRate: number | null;
  rateType: CorrosionRateType | null;
  rateMpy: number | null;
  dataQualityStatus: DataQualityStatus;
  errors: string[];
  warnings: string[];
  formula?: string;
  reference: string;
}

export interface RemainingLifeInput {
  tActual: number;
  tRequired: number;
  corrosionRate: number;
}

export interface RemainingLifeResult {
  remainingLife: number;
  status: TMLStatus;
  formula: string;
  reference: string;
  message?: string;
}

export interface NextInspectionResult {
  interval: number;
  nextDate: Date;
  inspectionType: InspectionType;
  formula: string;
  reference: string;
  message?: string;
}

export interface StatusResult {
  status: TMLStatus;
  message: string;
  alertLevel: number;
  margin: number;
  marginPercent: number;
}

export interface GoverningThicknessResult {
  tActual: number;
  readingsUsed: number;
  minPosition: string;
  allReadings: { position: string; value: number }[];
}

// ============================================================================
// GOVERNING THICKNESS CALCULATION
// ============================================================================

/**
 * Calculate the governing thickness (t_actual) from TML readings.
 * Per API 510, the governing thickness is the MINIMUM of all valid readings.
 * 
 * This is a LOCKED calculation - no user modification permitted.
 * 
 * @param readings - TML readings at various positions
 * @returns Governing thickness result with audit trail
 * @throws Error if no valid readings provided
 */
export function calculateGoverningThickness(readings: TMLReadings): GoverningThicknessResult {
  const positionMap: { key: keyof TMLReadings; position: string }[] = [
    { key: 'tml1', position: '0°' },
    { key: 'tml2', position: '90°' },
    { key: 'tml3', position: '180°' },
    { key: 'tml4', position: '270°' },
    { key: 'tml5', position: '45°' },
    { key: 'tml6', position: '135°' },
    { key: 'tml7', position: '225°' },
    { key: 'tml8', position: '315°' },
  ];

  const validReadings: { position: string; value: number }[] = [];

  for (const { key, position } of positionMap) {
    const value = readings[key];
    if (value !== null && value !== undefined && value > 0) {
      validReadings.push({ position, value });
    }
  }

  if (validReadings.length === 0) {
    throw new Error('CALCULATION HALTED: No valid thickness readings provided');
  }

  // Find minimum
  let minReading = validReadings[0];
  for (const reading of validReadings) {
    if (reading.value < minReading.value) {
      minReading = reading;
    }
  }

  return {
    tActual: minReading.value,
    readingsUsed: validReadings.length,
    minPosition: minReading.position,
    allReadings: validReadings,
  };
}

// ============================================================================
// CORROSION RATE CALCULATION
// ============================================================================

/**
 * Calculate corrosion rates per API 510.
 * 
 * Short-term rate: (t_prev - t_actual) / years between inspections
 * Long-term rate: (t_nom - t_actual) / total years in service
 * Governing rate: MAX(short-term, long-term) for conservative approach
 * 
 * @param input - Thickness and date data for calculation
 * @returns Corrosion rate result with all rates and audit trail
 */
export function calculateCorrosionRates(input: CorrosionRateInput): CorrosionRateResult {
  const result: CorrosionRateResult = {
    shortTermRate: null,
    longTermRate: null,
    governingRate: null,
    rateType: null,
    rateMpy: null,
    dataQualityStatus: 'good',
    errors: [],
    warnings: [],
    reference: 'API 510',
  };

  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

  // Short-term rate calculation
  if (input.previousThickness !== null && input.previousInspectionDate !== null) {
    const yearsBetween = (input.currentInspectionDate.getTime() - input.previousInspectionDate.getTime()) / MS_PER_YEAR;

    if (yearsBetween <= 0) {
      result.errors.push('INVALID: Current date must be after previous inspection date');
    } else {
      const stRate = (input.previousThickness - input.tActual) / yearsBetween;

      if (stRate < 0) {
        result.errors.push('DATA QUALITY FLAG: Negative short-term rate indicates apparent metal growth. Manual review required.');
        result.dataQualityStatus = 'growth_error';
        result.warnings.push(`Calculated ST rate: ${stRate.toFixed(6)} in/yr (negative - flagged for review)`);
      } else {
        result.shortTermRate = stRate;
      }
    }
  }

  // Long-term rate calculation
  if (input.nominalThickness !== null && input.originalInstallDate !== null) {
    const totalYears = (input.currentInspectionDate.getTime() - input.originalInstallDate.getTime()) / MS_PER_YEAR;

    if (totalYears <= 0) {
      result.errors.push('INVALID: Current date must be after installation date');
    } else {
      const ltRate = (input.nominalThickness - input.tActual) / totalYears;

      if (ltRate < 0) {
        result.errors.push('DATA QUALITY FLAG: Negative long-term rate. Verify nominal thickness.');
        result.dataQualityStatus = 'growth_error';
        result.warnings.push(`Calculated LT rate: ${ltRate.toFixed(6)} in/yr (negative - flagged for review)`);
      } else {
        result.longTermRate = ltRate;
      }
    }
  }

  // Determine governing rate: MAX(ST, LT) per API 510 conservative approach
  if (result.shortTermRate !== null && result.longTermRate !== null) {
    if (result.shortTermRate >= result.longTermRate) {
      result.governingRate = result.shortTermRate;
      result.rateType = 'ST';
      result.formula = `Governing Rate = MAX(${result.shortTermRate.toFixed(6)}, ${result.longTermRate.toFixed(6)}) = ${result.shortTermRate.toFixed(6)} in/yr (Short-Term)`;
    } else {
      result.governingRate = result.longTermRate;
      result.rateType = 'LT';
      result.formula = `Governing Rate = MAX(${result.shortTermRate.toFixed(6)}, ${result.longTermRate.toFixed(6)}) = ${result.longTermRate.toFixed(6)} in/yr (Long-Term)`;
    }
  } else if (result.shortTermRate !== null) {
    result.governingRate = result.shortTermRate;
    result.rateType = 'ST';
    result.formula = `Governing Rate = ${result.shortTermRate.toFixed(6)} in/yr (Short-Term only - no long-term data)`;
  } else if (result.longTermRate !== null) {
    result.governingRate = result.longTermRate;
    result.rateType = 'LT';
    result.formula = `Governing Rate = ${result.longTermRate.toFixed(6)} in/yr (Long-Term only - no short-term data)`;
  } else {
    result.errors.push('CALCULATION HALTED: Insufficient data to calculate corrosion rate. User-provided rate required.');
  }

  // Calculate mpy (mils per year) for display
  if (result.governingRate !== null) {
    result.rateMpy = result.governingRate * 1000;
  }

  return result;
}

// ============================================================================
// REMAINING LIFE CALCULATION
// ============================================================================

/**
 * Calculate remaining service life per API 510 §7.1.1.
 * 
 * Formula: Remaining Life = (t_actual - t_required) / Corrosion Rate
 * 
 * @param input - Current thickness, required thickness, and corrosion rate
 * @returns Remaining life result with status and audit trail
 * @throws Error if required inputs are missing
 */
export function calculateRemainingLife(input: RemainingLifeInput): RemainingLifeResult {
  // Validation
  if (input.tActual === null || input.tActual === undefined) {
    throw new Error('CALCULATION HALTED: t_actual is required');
  }
  if (input.tRequired === null || input.tRequired === undefined) {
    throw new Error('CALCULATION HALTED: t_required is required');
  }
  if (input.corrosionRate === null || input.corrosionRate === undefined || input.corrosionRate <= 0) {
    throw new Error('CALCULATION HALTED: Valid corrosion rate > 0 is required');
  }

  // Check if already below minimum
  if (input.tActual <= input.tRequired) {
    return {
      remainingLife: 0,
      status: 'critical',
      formula: `(${input.tActual.toFixed(4)} - ${input.tRequired.toFixed(4)}) / ${input.corrosionRate.toFixed(6)} = 0 years (at or below minimum)`,
      reference: 'API 510 §7.1.1',
      message: 'NON-COMPLIANT: Current thickness is at or below minimum required thickness per ASME calculation',
    };
  }

  // API 510 §7.1.1 formula
  const remainingLife = (input.tActual - input.tRequired) / input.corrosionRate;

  let status: TMLStatus = 'acceptable';
  let message: string | undefined;

  if (remainingLife <= 0) {
    status = 'critical';
    message = 'Immediate action required - remaining life exhausted';
  } else if (remainingLife <= 4) {
    status = 'alert';
    message = 'Internal inspection required per API 510 (RL ≤ 4 years)';
  }

  return {
    remainingLife,
    status,
    formula: `(${input.tActual.toFixed(4)} - ${input.tRequired.toFixed(4)}) / ${input.corrosionRate.toFixed(6)} = ${remainingLife.toFixed(2)} years`,
    reference: 'API 510 §7.1.1',
    message,
  };
}

// ============================================================================
// NEXT INSPECTION INTERVAL CALCULATION
// ============================================================================

/**
 * Calculate next inspection interval per API 510.
 * 
 * Formula: Next Inspection = MIN(Remaining Life / 2, 10 years)
 * 
 * Per API 510, if remaining life ≤ 4 years, internal inspection is required.
 * 
 * @param remainingLife - Calculated remaining life in years
 * @param currentInspectionDate - Date of current inspection
 * @returns Next inspection result with date, type, and audit trail
 */
export function calculateNextInspection(remainingLife: number, currentInspectionDate: Date): NextInspectionResult {
  if (remainingLife <= 0) {
    return {
      interval: 0,
      nextDate: currentInspectionDate,
      inspectionType: 'IMMEDIATE',
      formula: 'Remaining Life ≤ 0 - Immediate action required',
      reference: 'API 510',
      message: 'Immediate action required - remaining life exhausted',
    };
  }

  // API 510: Next inspection = MIN(remaining life / 2, 10 years)
  const halfLife = remainingLife / 2;
  const maxInterval = 10;
  const interval = Math.min(halfLife, maxInterval);

  // Calculate next date
  const nextDate = new Date(currentInspectionDate);
  const yearsToAdd = Math.floor(interval);
  const monthsToAdd = Math.round((interval % 1) * 12);
  nextDate.setFullYear(nextDate.getFullYear() + yearsToAdd);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

  // Determine inspection type per API 510
  let inspectionType: InspectionType;
  let message: string | undefined;

  if (remainingLife <= 4) {
    inspectionType = 'Internal';
    message = 'Internal inspection required per API 510 (RL ≤ 4 years)';
  } else {
    inspectionType = 'External';
    message = 'External or on-stream inspection acceptable';
  }

  return {
    interval,
    nextDate,
    inspectionType,
    formula: `MIN(${remainingLife.toFixed(2)} / 2, 10) = MIN(${halfLife.toFixed(2)}, 10) = ${interval.toFixed(2)} years`,
    reference: 'API 510',
    message,
  };
}

// ============================================================================
// STATUS DETERMINATION
// ============================================================================

/**
 * Determine TML status with configurable threshold.
 * 
 * Status levels:
 * - critical: t_actual ≤ t_required (NON-COMPLIANT)
 * - alert: t_actual ≤ t_required × threshold (approaching minimum)
 * - acceptable: t_actual > t_required × threshold
 * - unknown: insufficient data
 * 
 * @param tActual - Current measured thickness
 * @param tRequired - Minimum required thickness per ASME
 * @param threshold - Alert threshold multiplier (default 1.10 = 110%)
 * @returns Status result with margin information
 */
export function determineStatus(
  tActual: number | null,
  tRequired: number | null,
  threshold: number = 1.10
): StatusResult {
  if (tActual === null || tRequired === null) {
    return {
      status: 'unknown',
      message: 'Insufficient data for status determination',
      alertLevel: 0,
      margin: 0,
      marginPercent: 0,
    };
  }

  const alertLevel = tRequired * threshold;
  const margin = tActual - tRequired;
  const marginPercent = tRequired > 0 ? (margin / tRequired) * 100 : 0;

  if (tActual <= tRequired) {
    return {
      status: 'critical',
      message: `NON-COMPLIANT: Current thickness (${tActual.toFixed(4)}") is at or below minimum required (${tRequired.toFixed(4)}")`,
      alertLevel,
      margin,
      marginPercent,
    };
  }

  if (tActual <= alertLevel) {
    return {
      status: 'alert',
      message: `ALERT: Current thickness (${tActual.toFixed(4)}") is within ${((threshold - 1) * 100).toFixed(0)}% of minimum required (${tRequired.toFixed(4)}")`,
      alertLevel,
      margin,
      marginPercent,
    };
  }

  return {
    status: 'acceptable',
    message: `ACCEPTABLE: Current thickness (${tActual.toFixed(4)}") exceeds alert level (${alertLevel.toFixed(4)}")`,
    alertLevel,
    margin,
    marginPercent,
  };
}

// ============================================================================
// METAL LOSS CALCULATION
// ============================================================================

/**
 * Calculate metal loss from nominal thickness.
 * 
 * @param nominalThickness - Original/as-built thickness
 * @param tActual - Current measured thickness
 * @returns Metal loss in inches and percentage
 */
export function calculateMetalLoss(
  nominalThickness: number,
  tActual: number
): { metalLoss: number; metalLossPercent: number } {
  const metalLoss = nominalThickness - tActual;
  const metalLossPercent = nominalThickness > 0 ? (metalLoss / nominalThickness) * 100 : 0;

  return {
    metalLoss,
    metalLossPercent,
  };
}

// ============================================================================
// COMPLETE TML CALCULATION
// ============================================================================

export interface CompleteTMLCalculationInput {
  readings: TMLReadings;
  nominalThickness: number;
  tRequired: number;
  previousThickness: number | null;
  previousInspectionDate: Date | null;
  currentInspectionDate: Date;
  originalInstallDate: Date | null;
  statusThreshold?: number;
}

export interface CompleteTMLCalculationResult {
  governingThickness: GoverningThicknessResult;
  corrosionRate: CorrosionRateResult;
  remainingLife: RemainingLifeResult | null;
  nextInspection: NextInspectionResult | null;
  status: StatusResult;
  metalLoss: { metalLoss: number; metalLossPercent: number };
  errors: string[];
  warnings: string[];
}

/**
 * Perform complete TML calculation including all derived values.
 * 
 * @param input - All required input data
 * @returns Complete calculation result with all derived values
 */
export function calculateCompleteTML(input: CompleteTMLCalculationInput): CompleteTMLCalculationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Calculate governing thickness
  const governingThickness = calculateGoverningThickness(input.readings);

  // Step 2: Calculate corrosion rates
  const corrosionRate = calculateCorrosionRates({
    tActual: governingThickness.tActual,
    nominalThickness: input.nominalThickness,
    previousThickness: input.previousThickness,
    previousInspectionDate: input.previousInspectionDate,
    currentInspectionDate: input.currentInspectionDate,
    originalInstallDate: input.originalInstallDate,
  });

  errors.push(...corrosionRate.errors);
  warnings.push(...corrosionRate.warnings);

  // Step 3: Calculate remaining life (if corrosion rate available)
  let remainingLife: RemainingLifeResult | null = null;
  let nextInspection: NextInspectionResult | null = null;

  if (corrosionRate.governingRate !== null && corrosionRate.governingRate > 0) {
    remainingLife = calculateRemainingLife({
      tActual: governingThickness.tActual,
      tRequired: input.tRequired,
      corrosionRate: corrosionRate.governingRate,
    });

    // Step 4: Calculate next inspection
    nextInspection = calculateNextInspection(
      remainingLife.remainingLife,
      input.currentInspectionDate
    );
  } else {
    warnings.push('Remaining life and next inspection cannot be calculated without valid corrosion rate');
  }

  // Step 5: Determine status
  const status = determineStatus(
    governingThickness.tActual,
    input.tRequired,
    input.statusThreshold ?? 1.10
  );

  // Step 6: Calculate metal loss
  const metalLoss = calculateMetalLoss(input.nominalThickness, governingThickness.tActual);

  return {
    governingThickness,
    corrosionRate,
    remainingLife,
    nextInspection,
    status,
    metalLoss,
    errors,
    warnings,
  };
}
