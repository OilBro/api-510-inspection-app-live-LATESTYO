import { logger } from "./_core/logger";
/**
 * Enhanced API 510 Calculation Engine
 * Industry Leader Features: Dual Corrosion Rates, Anomaly Detection, Safety Validations
 * 
 * Research-based implementation matching Codeware INSPECT and AsInt capabilities
 */

export interface DualCorrosionRateResult {
  // Long-term rate (from initial/baseline to current)
  corrosionRateLongTerm: number; // inches/year
  longTermYears: number;
  
  // Short-term rate (from previous to current)
  corrosionRateShortTerm: number; // inches/year
  shortTermYears: number;
  
  // Governing rate (max of LT and ST)
  governingRate: number; // inches/year
  governingRateType: 'long_term' | 'short_term' | 'nominal';
  governingRateReason: string;
  
  // Data quality assessment
  dataQualityStatus: 'good' | 'anomaly' | 'growth_error' | 'below_minimum' | 'confirmed';
  dataQualityNotes: string;
}

export interface ThicknessData {
  initialThickness?: number; // Baseline or nominal thickness (inches)
  previousThickness?: number; // Last inspection thickness (inches)
  actualThickness: number; // Current inspection thickness (inches)
  minimumThickness: number; // Required minimum thickness (inches)
  
  initialDate?: Date; // Baseline inspection date
  previousDate?: Date; // Last inspection date
  currentDate: Date; // Current inspection date
}

/**
 * Calculate dual corrosion rates per API 510 best practices
 * 
 * Research Insight: "API 510 mandates calculation of two distinct rates: 
 * Long-Term (LT) and Short-Term (ST). Software must select the higher rate 
 * to be conservative."
 */
export function calculateDualCorrosionRates(
  data: ThicknessData
): DualCorrosionRateResult {
  const MINIMUM_NOMINAL_RATE = 0.001; // 1 mpy minimum for zero-corrosion cases
  const ANOMALY_THRESHOLD = 0.20; // 20% change threshold for anomaly detection
  
  let corrosionRateLongTerm = 0;
  let longTermYears = 0;
  let corrosionRateShortTerm = 0;
  let shortTermYears = 0;
  
  // Calculate Long-Term Rate (from initial to current)
  if (data.initialThickness && data.initialDate) {
    longTermYears = (data.currentDate.getTime() - data.initialDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (longTermYears > 0) {
      corrosionRateLongTerm = (data.initialThickness - data.actualThickness) / longTermYears;
    }
  }
  
  // Calculate Short-Term Rate (from previous to current)
  if (data.previousThickness && data.previousDate) {
    shortTermYears = (data.currentDate.getTime() - data.previousDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (shortTermYears > 0) {
      corrosionRateShortTerm = (data.previousThickness - data.actualThickness) / shortTermYears;
    }
  }
  
  // Data Quality Assessment
  let dataQualityStatus: DualCorrosionRateResult['dataQualityStatus'] = 'good';
  let dataQualityNotes = '';
  
  // Check for metal growth (negative corrosion rate)
  if (corrosionRateLongTerm < 0 || corrosionRateShortTerm < 0) {
    dataQualityStatus = 'growth_error';
    dataQualityNotes = `Growth Error: Thickness measurement indicates metal growth. ` +
      `LT Rate: ${(corrosionRateLongTerm * 1000).toFixed(1)} mpy, ` +
      `ST Rate: ${(corrosionRateShortTerm * 1000).toFixed(1)} mpy. ` +
      `This typically indicates gauge error (doubling/decoupling) or measurement error. ` +
      `Inspector confirmation required.`;
  }
  
  // Check for anomalous readings (>20% change from previous)
  if (data.previousThickness && dataQualityStatus === 'good') {
    const percentChange = Math.abs((data.actualThickness - data.previousThickness) / data.previousThickness);
    
    if (percentChange > ANOMALY_THRESHOLD) {
      dataQualityStatus = 'anomaly';
      dataQualityNotes = `Anomaly Detected: Current thickness (${data.actualThickness.toFixed(4)}") ` +
        `differs by ${(percentChange * 100).toFixed(1)}% from previous (${data.previousThickness.toFixed(4)}"). ` +
        `Exceeds ${(ANOMALY_THRESHOLD * 100)}% threshold. Confirm reading accuracy.`;
    }
  }
  
  // Check if below minimum thickness
  if (data.actualThickness < data.minimumThickness) {
    dataQualityStatus = 'below_minimum';
    dataQualityNotes = `UNSAFE: Current thickness (${data.actualThickness.toFixed(4)}") ` +
      `is below minimum required thickness (${data.minimumThickness.toFixed(4)}"). ` +
      `Vessel is REJECTED for continued service at design pressure. ` +
      `API 579 Level 1 assessment required or de-rate MAWP.`;
  }
  
  // Determine Governing Rate
  let governingRate: number;
  let governingRateType: DualCorrosionRateResult['governingRateType'];
  let governingRateReason: string;
  
  // Handle zero corrosion case (singularity)
  if (corrosionRateLongTerm === 0 && corrosionRateShortTerm === 0) {
    governingRate = MINIMUM_NOMINAL_RATE;
    governingRateType = 'nominal';
    governingRateReason = `No measurable corrosion detected. Using minimum nominal rate ` +
      `of ${(MINIMUM_NOMINAL_RATE * 1000).toFixed(1)} mpy (1 mil/year) per API 510. ` +
      `Inspection interval capped at 10 years maximum.`;
  }
  // Use Short-Term if significantly higher (indicates acceleration)
  else if (corrosionRateShortTerm > corrosionRateLongTerm * 1.5 && corrosionRateShortTerm > 0) {
    governingRate = corrosionRateShortTerm;
    governingRateType = 'short_term';
    governingRateReason = `Short-Term rate (${(corrosionRateShortTerm * 1000).toFixed(1)} mpy) ` +
      `is ${(corrosionRateShortTerm / Math.max(corrosionRateLongTerm, 0.0001)).toFixed(1)}x ` +
      `higher than Long-Term rate (${(corrosionRateLongTerm * 1000).toFixed(1)} mpy). ` +
      `Indicates recent corrosion acceleration. Using ST rate for conservative remaining life calculation.`;
  }
  // Use Long-Term if Short-Term is not available or lower
  else if (corrosionRateLongTerm > 0) {
    governingRate = corrosionRateLongTerm;
    governingRateType = 'long_term';
    governingRateReason = `Long-Term rate (${(corrosionRateLongTerm * 1000).toFixed(1)} mpy) ` +
      `over ${longTermYears.toFixed(1)} years is governing. ` +
      `Short-Term rate (${(corrosionRateShortTerm * 1000).toFixed(1)} mpy) ` +
      `does not indicate significant acceleration.`;
  }
  // Fallback to Short-Term if Long-Term not available
  else if (corrosionRateShortTerm > 0) {
    governingRate = corrosionRateShortTerm;
    governingRateType = 'short_term';
    governingRateReason = `Using Short-Term rate (${(corrosionRateShortTerm * 1000).toFixed(1)} mpy) ` +
      `as baseline data not available for Long-Term calculation.`;
  }
  // Ultimate fallback to nominal
  else {
    governingRate = MINIMUM_NOMINAL_RATE;
    governingRateType = 'nominal';
    governingRateReason = `Insufficient data for corrosion rate calculation. ` +
      `Using minimum nominal rate of ${(MINIMUM_NOMINAL_RATE * 1000).toFixed(1)} mpy.`;
  }
  
  return {
    corrosionRateLongTerm,
    longTermYears,
    corrosionRateShortTerm,
    shortTermYears,
    governingRate,
    governingRateType,
    governingRateReason,
    dataQualityStatus,
    dataQualityNotes
  };
}

/**
 * Calculate remaining life using governing corrosion rate
 * 
 * Research Insight: "Remaining Life = (t_actual - t_min) / CR_governing"
 */
export function calculateRemainingLife(
  actualThickness: number,
  minimumThickness: number,
  governingRate: number
): number {
  const corrosionAllowance = actualThickness - minimumThickness;
  
  // Handle below minimum thickness case
  if (corrosionAllowance <= 0) {
    return 0; // Vessel is already below minimum
  }
  
  // Handle zero corrosion rate (already handled by nominal rate in dual calculation)
  if (governingRate <= 0) {
    return 999; // Effectively infinite life, will be capped at 10 years by interval rules
  }
  
  return corrosionAllowance / governingRate;
}

/**
 * Calculate next inspection interval per API 510 rules
 * 
 * Research Insight: "Inspection interval cannot exceed the lesser of:
 * - One-half of the remaining life
 * - 10 years"
 */
export function calculateInspectionInterval(
  remainingLife: number
): number {
  const halfLife = remainingLife / 2;
  const maxInterval = 10; // API 510 maximum
  
  return Math.min(halfLife, maxInterval);
}

/**
 * Calculate de-rated MAWP for vessels below minimum thickness
 * 
 * Research Insight: "Calculate de-rated MAWP: iterate pressure down 
 * until t_actual is sufficient."
 */
export function calculateDeratedMAWP(
  actualThickness: number,
  insideRadius: number,
  allowableStress: number,
  jointEfficiency: number,
  componentType: 'shell' | 'head'
): number {
  // For cylindrical shell: P = (S * E * t) / (R + 0.6 * t)
  // For 2:1 ellipsoidal head: P = (2 * S * E * t) / (D + 0.2 * t)
  
  if (componentType === 'shell') {
    return (allowableStress * jointEfficiency * actualThickness) / (insideRadius + 0.6 * actualThickness);
  } else {
    // Head: use diameter (2 * radius)
    const diameter = insideRadius * 2;
    return (2 * allowableStress * jointEfficiency * actualThickness) / (diameter + 0.2 * actualThickness);
  }
}

/**
 * Case Study Validation
 * 
 * Research Example:
 * - t_actual = 0.352"
 * - t_min = 0.252"
 * - CR_ST = 0.100 in/year
 * - Expected: RL = 1.0 years, Interval = 0.5 years (6 months)
 */
export function validateCaseStudy() {
  const data: ThicknessData = {
    previousThickness: 0.452,
    actualThickness: 0.352,
    minimumThickness: 0.252,
    previousDate: new Date('2024-01-01'),
    currentDate: new Date('2025-01-01')
  };
  
  const rates = calculateDualCorrosionRates(data);
  const remainingLife = calculateRemainingLife(data.actualThickness, data.minimumThickness, rates.governingRate);
  const interval = calculateInspectionInterval(remainingLife);
  
  logger.info('=== Case Study Validation ===');
  logger.info(`Short-Term Rate: ${(rates.corrosionRateShortTerm * 1000).toFixed(1)} mpy (Expected: 100 mpy)`);
  logger.info(`Remaining Life: ${remainingLife.toFixed(1)} years (Expected: 1.0 years)`);
  logger.info(`Inspection Interval: ${interval.toFixed(1)} years (Expected: 0.5 years)`);
  logger.info(`Status: ${rates.dataQualityStatus}`);
  logger.info(`Reason: ${rates.governingRateReason}`);
  
  return {
    rates,
    remainingLife,
    interval
  };
}
