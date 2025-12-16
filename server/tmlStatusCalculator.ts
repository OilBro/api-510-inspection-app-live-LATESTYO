import { logger } from "./_core/logger";
/**
 * TML Status Calculator
 * Determines status based on actual thickness vs minimum required
 */

interface StatusInput {
  currentThickness: number;
  nominalThickness: number;
  designPressure: number;
  insideDiameter: number;
  materialSpec: string;
  designTemperature: number;
  corrosionAllowance?: number;
  jointEfficiency?: number;
}

/**
 * Calculate TML status based on thickness vs minimum required
 */
export function calculateTMLStatus(input: StatusInput): "good" | "monitor" | "critical" {
  const { calculateComponent } = require('./componentCalculations');
  
  try {
    const calc = calculateComponent({
      designPressure: input.designPressure,
      designTemperature: input.designTemperature,
      insideDiameter: input.insideDiameter,
      materialSpec: input.materialSpec,
      nominalThickness: input.nominalThickness,
      actualThickness: input.currentThickness,
      corrosionAllowance: input.corrosionAllowance ?? 0.125, // Default to 1/8" if not provided
      jointEfficiency: input.jointEfficiency ?? 0.85, // Default to 0.85 if not provided
      componentType: 'shell',
      corrosionRate: 0
    });
    
    const minRequired = calc.minimumRequiredThickness;
    const current = input.currentThickness;
    const ca = input.corrosionAllowance ?? 0.125;
    
    if (current < minRequired) {
      return "critical";
    } else if (current < minRequired + ca * 0.5) {
      return "monitor";
    } else {
      return "good";
    }
  } catch (error) {
    logger.error('[TML Status] Calculation error:', error);
    // Fallback: simple comparison to nominal
    if (input.currentThickness < input.nominalThickness * 0.8) {
      return "critical";
    } else if (input.currentThickness < input.nominalThickness * 0.9) {
      return "monitor";
    } else {
      return "good";
    }
  }
}

