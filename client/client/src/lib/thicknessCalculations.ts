/**
 * Client-side thickness calculation utilities
 * Based on ASME Section VIII Division 1
 */

export interface ComponentData {
  designPressure: number; // psi
  insideRadius: number; // inches
  allowableStress: number; // psi
  jointEfficiency: number; // 0.7-1.0
  corrosionAllowance?: number; // inches
}

export interface HeadData extends ComponentData {
  headType: 'hemispherical' | 'ellipsoidal' | 'torispherical';
}

/**
 * Calculate minimum required thickness for cylindrical shell (ASME UG-27)
 * t = (P * R) / (S * E - 0.6 * P) + CA
 */
export function calculateShellMinimumThickness(data: ComponentData): number {
  const { designPressure: P, insideRadius: R, allowableStress: S, jointEfficiency: E, corrosionAllowance: CA = 0 } = data;
  
  if (!P || !R || !S || !E) return 0;
  
  const t = (P * R) / (S * E - 0.6 * P);
  return t + CA;
}

/**
 * Calculate minimum required thickness for heads (ASME UG-32)
 */
export function calculateHeadMinimumThickness(data: HeadData): number {
  const { designPressure: P, insideRadius: R, allowableStress: S, jointEfficiency: E, corrosionAllowance: CA = 0, headType } = data;
  
  if (!P || !R || !S || !E) return 0;
  
  let t: number;
  
  switch (headType) {
    case 'hemispherical':
      // t = (P * L) / (2 * S * E - 0.2 * P)
      t = (P * R) / (2 * S * E - 0.2 * P);
      break;
      
    case 'ellipsoidal':
      // t = (P * D) / (2 * S * E - 0.2 * P) where D = 2R
      t = (P * R) / (S * E - 0.1 * P);
      break;
      
    case 'torispherical':
      // t = (0.885 * P * L) / (S * E - 0.1 * P)
      t = (0.885 * P * R) / (S * E - 0.1 * P);
      break;
      
    default:
      t = 0;
  }
  
  return t + CA;
}

/**
 * Calculate MAWP (Maximum Allowable Working Pressure) for shell
 * P = (S * E * t) / (R + 0.6 * t)
 */
export function calculateShellMAWP(actualThickness: number, data: Omit<ComponentData, 'designPressure'>): number {
  const { insideRadius: R, allowableStress: S, jointEfficiency: E, corrosionAllowance: CA = 0 } = data;
  
  if (!actualThickness || !R || !S || !E) return 0;
  
  const t = actualThickness - CA; // Subtract corrosion allowance
  const P = (S * E * t) / (R + 0.6 * t);
  
  return P;
}

/**
 * Calculate remaining life in years
 * RL = (t_actual - t_required) / corrosion_rate
 */
export function calculateRemainingLife(
  actualThickness: number,
  requiredThickness: number,
  corrosionRate: number, // mils per year
  safetyFactor: number = 2.0
): { years: number; nextInspectionDate: Date | null } {
  if (!actualThickness || !requiredThickness || !corrosionRate || corrosionRate <= 0) {
    return { years: 0, nextInspectionDate: null };
  }
  
  const excessThickness = actualThickness - requiredThickness;
  const corrosionRateInches = corrosionRate / 1000; // Convert mils to inches
  
  const years = excessThickness / corrosionRateInches;
  const nextInspectionYears = years / safetyFactor;
  
  const nextInspectionDate = new Date();
  nextInspectionDate.setFullYear(nextInspectionDate.getFullYear() + Math.floor(nextInspectionYears));
  
  return {
    years: Math.max(0, years),
    nextInspectionDate: nextInspectionYears > 0 ? nextInspectionDate : null
  };
}

/**
 * Get status color based on thickness ratio
 */
export function getThicknessStatus(actual: number, required: number): {
  status: 'good' | 'monitor' | 'critical' | 'failed';
  color: string;
  label: string;
} {
  if (!actual || !required) {
    return { status: 'monitor', color: 'gray', label: 'Unknown' };
  }
  
  const ratio = actual / required;
  
  if (ratio < 1.0) {
    return { status: 'failed', color: 'red', label: 'Below Minimum' };
  } else if (ratio < 1.1) {
    return { status: 'critical', color: 'orange', label: 'Critical' };
  } else if (ratio < 1.3) {
    return { status: 'monitor', color: 'yellow', label: 'Monitor' };
  } else {
    return { status: 'good', color: 'green', label: 'Good' };
  }
}

/**
 * Format thickness value for display
 */
export function formatThickness(value: number | string | undefined): string {
  if (!value) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toFixed(3) + '"';
}

/**
 * Format pressure value for display
 */
export function formatPressure(value: number | string | undefined): string {
  if (!value) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toFixed(1) + ' psi';
}

