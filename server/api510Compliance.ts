/**
 * API 510 Compliance Validation Module
 * 
 * Comprehensive compliance checks per API 510 (Pressure Vessel Inspection Code)
 * and ASME Section VIII Division 1
 * 
 * Reference Standards:
 * - API 510: Pressure Vessel Inspection Code
 * - ASME BPVC Section VIII Division 1: Rules for Construction of Pressure Vessels
 * - ASME BPVC Section II Part D: Materials - Allowable Stresses
 * - API 579-1/ASME FFS-1: Fitness-For-Service
 */

import { getAllowableStress, findMaterial, MATERIALS_DATABASE } from './asmeMaterialsDatabase';
import type { CalculationInputs, CalculationResults } from './asmeCalculations';

// ============================================================================
// LOCAL CALCULATION FUNCTIONS (matching ASME formulas)
// ============================================================================

/**
 * Calculate cylindrical shell minimum thickness per ASME UG-27
 * t = PR / (SE - 0.6P)
 */
function calculateCylindricalShellThickness(input: { P: number; R: number; S: number; E: number }): number {
  const { P, R, S, E } = input;
  return (P * R) / (S * E - 0.6 * P);
}

/**
 * Calculate cylindrical shell MAWP per ASME UG-27
 * P = SEt / (R + 0.6t)
 */
function calculateCylindricalShellMAWP(input: { t: number; R: number; S: number; E: number }): number {
  const { t, R, S, E } = input;
  return (S * E * t) / (R + 0.6 * t);
}

/**
 * Calculate 2:1 ellipsoidal head minimum thickness per ASME UG-32(d)
 * t = PD / (2SE - 0.2P)
 */
function calculateEllipsoidalHeadThickness(input: { P: number; D: number; S: number; E: number }): number {
  const { P, D, S, E } = input;
  return (P * D) / (2 * S * E - 0.2 * P);
}

/**
 * Calculate 2:1 ellipsoidal head MAWP per ASME UG-32(d)
 * P = 2SEt / (D + 0.2t)
 */
function calculateEllipsoidalHeadMAWP(input: { t: number; D: number; S: number; E: number }): number {
  const { t, D, S, E } = input;
  return (2 * S * E * t) / (D + 0.2 * t);
}

/**
 * Calculate hemispherical head minimum thickness per ASME UG-32(f)
 * t = PR / (2SE - 0.2P)
 */
function calculateHemisphericalHeadThickness(input: { P: number; R: number; S: number; E: number }): number {
  const { P, R, S, E } = input;
  return (P * R) / (2 * S * E - 0.2 * P);
}

/**
 * Calculate hemispherical head MAWP per ASME UG-32(f)
 * P = 2SEt / (R + 0.2t)
 */
function calculateHemisphericalHeadMAWP(input: { t: number; R: number; S: number; E: number }): number {
  const { t, R, S, E } = input;
  return (2 * S * E * t) / (R + 0.2 * t);
}

/**
 * Calculate torispherical head minimum thickness per ASME UG-32(e)
 * t = PLM / (2SE - 0.2P)
 * where M = (3 + sqrt(L/r)) / 4
 */
function calculateTorisphericalHeadThickness(input: { P: number; L: number; r: number; S: number; E: number }): number {
  const { P, L, r, S, E } = input;
  const M = (3 + Math.sqrt(L / r)) / 4;
  return (P * L * M) / (2 * S * E - 0.2 * P);
}

/**
 * Calculate torispherical head MAWP per ASME UG-32(e)
 * P = 2SEt / (LM + 0.2t)
 */
function calculateTorisphericalHeadMAWP(input: { t: number; L: number; r: number; S: number; E: number }): number {
  const { t, L, r, S, E } = input;
  const M = (3 + Math.sqrt(L / r)) / 4;
  return (2 * S * E * t) / (L * M + 0.2 * t);
}

/**
 * Calculate corrosion rate
 * Cr = (t_prev - t_act) / Y
 */
function calculateCorrosionRate(t_prev: number, t_act: number, Y: number): number {
  if (Y <= 0) return 0;
  return (t_prev - t_act) / Y;
}

/**
 * Calculate remaining life
 * RL = (t_act - t_min) / Cr
 */
function calculateRemainingLife(t_act: number, t_min: number, Cr: number): number {
  if (Cr <= 0) return 999; // No corrosion = infinite life (capped at 999)
  const rl = (t_act - t_min) / Cr;
  return Math.max(0, rl);
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface VesselData {
  vesselTagNumber: string;
  vesselName?: string;
  manufacturer?: string;
  yearBuilt?: number;
  designPressure: number; // psig
  designTemperature: number; // °F
  operatingPressure?: number; // psig
  operatingTemperature?: number; // °F
  mdmt?: number; // °F - Minimum Design Metal Temperature
  materialSpec: string;
  allowableStress?: number; // psi
  jointEfficiency: number; // 0.0 - 1.0
  radiographyType?: string; // RT-1, RT-2, RT-3, RT-4
  insideDiameter: number; // inches
  overallLength?: number; // inches
  vesselConfiguration?: string; // Horizontal, Vertical
  headType?: string; // 2:1 Ellipsoidal, Hemispherical, Torispherical, Flat
  constructionCode?: string;
  nbNumber?: string;
  crownRadius?: number; // L for torispherical
  knuckleRadius?: number; // r for torispherical
}

export interface ComponentData {
  componentName: string;
  componentType: 'shell' | 'head';
  headType?: 'ellipsoidal' | 'hemispherical' | 'torispherical' | 'flat';
  nominalThickness: number; // inches
  actualThickness: number; // inches (current measured)
  previousThickness?: number; // inches (previous inspection)
  insideDiameter?: number; // inches (for heads)
  crownRadius?: number; // L for torispherical
  knuckleRadius?: number; // r for torispherical
  inspectionDate: Date;
  previousInspectionDate?: Date;
  material?: string;
}

export interface NozzleData {
  nozzleNumber: string;
  service?: string;
  nominalSize: number; // inches
  schedule?: string;
  actualThickness: number; // inches
  minimumRequired?: number; // inches
  material?: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'CRITICAL';
  checks: ComplianceCheck[];
  recommendations: string[];
  nextInspectionDates: {
    external: Date;
    internal: Date;
    ut: Date;
  };
  governingComponent?: string;
  governingMAWP?: number;
  summary: string;
}

export interface ComplianceCheck {
  checkId: string;
  checkName: string;
  category: 'THICKNESS' | 'MAWP' | 'CORROSION' | 'REMAINING_LIFE' | 'INSPECTION_INTERVAL' | 'MATERIAL' | 'NOZZLE' | 'MDMT';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  requirement: string;
  actualValue: string;
  referenceCode: string;
  details?: string;
}

// ============================================================================
// API 510 INSPECTION INTERVAL REQUIREMENTS
// ============================================================================

/**
 * API 510 Section 6.4 - Maximum Inspection Intervals
 */
export const API510_INSPECTION_INTERVALS = {
  // External inspection (visual)
  EXTERNAL_MAX_YEARS: 5,
  
  // Internal/On-stream inspection
  INTERNAL_MAX_YEARS: 10,
  
  // Half remaining life rule
  HALF_REMAINING_LIFE: true,
  
  // Minimum remaining life for continued operation
  MIN_REMAINING_LIFE_YEARS: 2,
  
  // Risk-based inspection adjustments
  RBI_ADJUSTMENTS: {
    LOW_RISK: 1.5,    // Can extend by 50%
    MEDIUM_RISK: 1.0, // Standard intervals
    HIGH_RISK: 0.5,   // Reduce by 50%
    CRITICAL: 0.25,   // Reduce by 75%
  },
};

// ============================================================================
// COMPLIANCE CHECK FUNCTIONS
// ============================================================================

/**
 * Perform comprehensive API 510 compliance validation
 */
export function performComplianceValidation(
  vessel: VesselData,
  components: ComponentData[],
  nozzles: NozzleData[]
): ComplianceResult {
  const checks: ComplianceCheck[] = [];
  const recommendations: string[] = [];
  
  // Get material data
  const materialData = findMaterial(vessel.materialSpec);
  const allowableStress = vessel.allowableStress || 
    getAllowableStress(vessel.materialSpec, vessel.designTemperature) ||
    20000;
  
  // Track governing values
  let governingMAWP = Infinity;
  let governingComponent = '';
  let minRemainingLife = Infinity;
  let governingRLComponent = '';
  
  // ========================================
  // 1. THICKNESS CHECKS (per ASME UG-27, UG-32)
  // ========================================
  for (const component of components) {
    const tMin = calculateMinimumThickness(
      vessel,
      component,
      allowableStress
    );
    
    // Check actual vs minimum required
    const thicknessCheck: ComplianceCheck = {
      checkId: `THICK-${component.componentName}`,
      checkName: `Minimum Thickness - ${component.componentName}`,
      category: 'THICKNESS',
      status: component.actualThickness >= tMin ? 'PASS' : 'FAIL',
      requirement: `t_actual >= t_min (${tMin.toFixed(4)}")`,
      actualValue: `${component.actualThickness.toFixed(4)}"`,
      referenceCode: component.componentType === 'shell' ? 'ASME UG-27' : 'ASME UG-32',
      details: component.actualThickness < tMin 
        ? `CRITICAL: Actual thickness ${component.actualThickness.toFixed(4)}" is below minimum required ${tMin.toFixed(4)}". Immediate action required.`
        : undefined,
    };
    checks.push(thicknessCheck);
    
    if (component.actualThickness < tMin) {
      recommendations.push(
        `CRITICAL: ${component.componentName} thickness (${component.actualThickness.toFixed(4)}") is below minimum required (${tMin.toFixed(4)}"). ` +
        `Consider: (1) De-rate MAWP, (2) Repair/replacement, or (3) Fitness-for-service evaluation per API 579.`
      );
    }
    
    // Calculate MAWP at current thickness
    const mawp = calculateMAWPAtThickness(
      vessel,
      component,
      allowableStress
    );
    
    if (mawp < governingMAWP) {
      governingMAWP = mawp;
      governingComponent = component.componentName;
    }
    
    // MAWP check
    const mawpCheck: ComplianceCheck = {
      checkId: `MAWP-${component.componentName}`,
      checkName: `MAWP Check - ${component.componentName}`,
      category: 'MAWP',
      status: mawp >= vessel.designPressure ? 'PASS' : 'WARNING',
      requirement: `Calculated MAWP >= Design Pressure (${vessel.designPressure} psig)`,
      actualValue: `${mawp.toFixed(1)} psig`,
      referenceCode: 'API 510 Section 5.4',
      details: mawp < vessel.designPressure
        ? `Calculated MAWP (${mawp.toFixed(1)} psig) is below design pressure. Vessel must be de-rated or repaired.`
        : undefined,
    };
    checks.push(mawpCheck);
    
    // ========================================
    // 2. CORROSION RATE CHECKS
    // ========================================
    if (component.previousThickness && component.previousInspectionDate) {
      const timeSpan = calculateTimeSpanYears(
        component.previousInspectionDate,
        component.inspectionDate
      );
      
      const corrosionRate = calculateCorrosionRate(
        component.previousThickness,
        component.actualThickness,
        timeSpan
      );
      
      // Check for anomalous readings (growth)
      const corrosionCheck: ComplianceCheck = {
        checkId: `CR-${component.componentName}`,
        checkName: `Corrosion Rate - ${component.componentName}`,
        category: 'CORROSION',
        status: corrosionRate >= 0 ? (corrosionRate > 0.010 ? 'WARNING' : 'PASS') : 'WARNING',
        requirement: 'Corrosion rate should be positive and reasonable',
        actualValue: `${corrosionRate.toFixed(6)} in/yr`,
        referenceCode: 'API 510 Section 7.1',
        details: corrosionRate < 0 
          ? `Negative corrosion rate indicates measurement anomaly or thickness growth. Verify readings.`
          : corrosionRate > 0.010
            ? `High corrosion rate detected. Consider increased monitoring frequency.`
            : undefined,
      };
      checks.push(corrosionCheck);
      
      // ========================================
      // 3. REMAINING LIFE CHECKS
      // ========================================
      const remainingLife = calculateRemainingLife(
        component.actualThickness,
        tMin,
        Math.max(corrosionRate, 0.0001) // Use minimum rate if zero/negative
      );
      
      if (remainingLife < minRemainingLife) {
        minRemainingLife = remainingLife;
        governingRLComponent = component.componentName;
      }
      
      const rlCheck: ComplianceCheck = {
        checkId: `RL-${component.componentName}`,
        checkName: `Remaining Life - ${component.componentName}`,
        category: 'REMAINING_LIFE',
        status: remainingLife >= API510_INSPECTION_INTERVALS.MIN_REMAINING_LIFE_YEARS 
          ? (remainingLife < 5 ? 'WARNING' : 'PASS') 
          : 'FAIL',
        requirement: `Remaining life >= ${API510_INSPECTION_INTERVALS.MIN_REMAINING_LIFE_YEARS} years`,
        actualValue: `${remainingLife.toFixed(1)} years`,
        referenceCode: 'API 510 Section 6.4',
        details: remainingLife < API510_INSPECTION_INTERVALS.MIN_REMAINING_LIFE_YEARS
          ? `CRITICAL: Remaining life is below minimum. Immediate action required.`
          : remainingLife < 5
            ? `Remaining life is limited. Plan for repair/replacement.`
            : undefined,
      };
      checks.push(rlCheck);
      
      if (remainingLife < API510_INSPECTION_INTERVALS.MIN_REMAINING_LIFE_YEARS) {
        recommendations.push(
          `CRITICAL: ${component.componentName} has only ${remainingLife.toFixed(1)} years remaining life. ` +
          `Immediate evaluation required. Options: (1) Repair, (2) Replace, (3) De-rate, (4) API 579 FFS assessment.`
        );
      } else if (remainingLife < 5) {
        recommendations.push(
          `${component.componentName} has ${remainingLife.toFixed(1)} years remaining life. ` +
          `Schedule repair/replacement planning within next inspection cycle.`
        );
      }
    }
  }
  
  // ========================================
  // 4. NOZZLE CHECKS (per ASME UG-45)
  // ========================================
  for (const nozzle of nozzles) {
    const tMin = nozzle.minimumRequired || calculateNozzleMinThickness(
      vessel.designPressure,
      nozzle.nominalSize,
      allowableStress,
      vessel.jointEfficiency
    );
    
    const nozzleCheck: ComplianceCheck = {
      checkId: `NOZ-${nozzle.nozzleNumber}`,
      checkName: `Nozzle Thickness - ${nozzle.nozzleNumber} (${nozzle.service || 'Unknown'})`,
      category: 'NOZZLE',
      status: nozzle.actualThickness >= tMin ? 'PASS' : 'FAIL',
      requirement: `t_actual >= t_min (${tMin.toFixed(4)}")`,
      actualValue: `${nozzle.actualThickness.toFixed(4)}"`,
      referenceCode: 'ASME UG-45',
      details: nozzle.actualThickness < tMin
        ? `Nozzle ${nozzle.nozzleNumber} thickness is below minimum. Evaluate reinforcement and consider repair.`
        : undefined,
    };
    checks.push(nozzleCheck);
    
    if (nozzle.actualThickness < tMin) {
      recommendations.push(
        `Nozzle ${nozzle.nozzleNumber} (${nozzle.service || 'Unknown'}): Actual thickness ${nozzle.actualThickness.toFixed(4)}" ` +
        `is below minimum ${tMin.toFixed(4)}". Evaluate reinforcement per UG-37 and consider repair.`
      );
    }
  }
  
  // ========================================
  // 5. MDMT CHECK (Minimum Design Metal Temperature)
  // ========================================
  if (vessel.mdmt !== undefined) {
    const operatingTemp = vessel.operatingTemperature || vessel.designTemperature;
    const mdmtCheck: ComplianceCheck = {
      checkId: 'MDMT-CHECK',
      checkName: 'Minimum Design Metal Temperature',
      category: 'MDMT',
      status: operatingTemp >= vessel.mdmt ? 'PASS' : 'FAIL',
      requirement: `Operating temp >= MDMT (${vessel.mdmt}°F)`,
      actualValue: `${operatingTemp}°F`,
      referenceCode: 'ASME UCS-66',
      details: operatingTemp < vessel.mdmt
        ? `Operating temperature is below MDMT. Risk of brittle fracture. Do not operate below MDMT.`
        : undefined,
    };
    checks.push(mdmtCheck);
    
    if (operatingTemp < vessel.mdmt) {
      recommendations.push(
        `CRITICAL: Operating temperature (${operatingTemp}°F) is below MDMT (${vessel.mdmt}°F). ` +
        `Do not operate vessel below MDMT. Risk of brittle fracture.`
      );
    }
  }
  
  // ========================================
  // 6. INSPECTION INTERVAL CALCULATION
  // ========================================
  const halfRL = minRemainingLife / 2;
  const maxExternal = API510_INSPECTION_INTERVALS.EXTERNAL_MAX_YEARS;
  const maxInternal = API510_INSPECTION_INTERVALS.INTERNAL_MAX_YEARS;
  
  // Per API 510 Section 6.4: Next inspection = lesser of (max interval) or (half remaining life)
  const nextExternalYears = Math.min(maxExternal, halfRL);
  const nextInternalYears = Math.min(maxInternal, halfRL);
  const nextUTYears = Math.min(maxExternal, halfRL);
  
  const now = new Date();
  const nextInspectionDates = {
    external: new Date(now.getTime() + nextExternalYears * 365.25 * 24 * 60 * 60 * 1000),
    internal: new Date(now.getTime() + nextInternalYears * 365.25 * 24 * 60 * 60 * 1000),
    ut: new Date(now.getTime() + nextUTYears * 365.25 * 24 * 60 * 60 * 1000),
  };
  
  const intervalCheck: ComplianceCheck = {
    checkId: 'INTERVAL-CHECK',
    checkName: 'Inspection Interval Compliance',
    category: 'INSPECTION_INTERVAL',
    status: halfRL >= 1 ? 'PASS' : 'WARNING',
    requirement: `Half remaining life rule: Next inspection within ${halfRL.toFixed(1)} years`,
    actualValue: `External: ${nextExternalYears.toFixed(1)} yrs, Internal: ${nextInternalYears.toFixed(1)} yrs`,
    referenceCode: 'API 510 Section 6.4',
    details: `Based on ${governingRLComponent || 'governing component'} with ${minRemainingLife.toFixed(1)} years remaining life.`,
  };
  checks.push(intervalCheck);
  
  // ========================================
  // 7. MATERIAL VERIFICATION
  // ========================================
  if (materialData) {
    const materialCheck: ComplianceCheck = {
      checkId: 'MAT-VERIFY',
      checkName: 'Material Specification Verification',
      category: 'MATERIAL',
      status: 'PASS',
      requirement: 'Material must be listed in ASME Section II Part D',
      actualValue: vessel.materialSpec,
      referenceCode: 'ASME Section II Part D',
      details: `Material ${vessel.materialSpec} verified. Allowable stress at ${vessel.designTemperature}°F: ${allowableStress.toLocaleString()} psi`,
    };
    checks.push(materialCheck);
  } else {
    const materialCheck: ComplianceCheck = {
      checkId: 'MAT-VERIFY',
      checkName: 'Material Specification Verification',
      category: 'MATERIAL',
      status: 'WARNING',
      requirement: 'Material must be listed in ASME Section II Part D',
      actualValue: vessel.materialSpec,
      referenceCode: 'ASME Section II Part D',
      details: `Material ${vessel.materialSpec} not found in database. Using default stress value. Verify material specification.`,
    };
    checks.push(materialCheck);
    recommendations.push(
      `Verify material specification ${vessel.materialSpec} against ASME Section II Part D. ` +
      `Confirm allowable stress value used in calculations.`
    );
  }
  
  // ========================================
  // DETERMINE OVERALL STATUS
  // ========================================
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;
  
  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'CRITICAL';
  if (failCount > 0) {
    // Check if any critical failures
    const criticalFailures = checks.filter(c => 
      c.status === 'FAIL' && 
      (c.category === 'THICKNESS' || c.category === 'REMAINING_LIFE' || c.category === 'MDMT')
    );
    overallStatus = criticalFailures.length > 0 ? 'CRITICAL' : 'FAIL';
  } else if (warningCount > 0) {
    overallStatus = 'WARNING';
  } else {
    overallStatus = 'PASS';
  }
  
  // Generate summary
  const summary = generateComplianceSummary(
    vessel,
    checks,
    governingComponent,
    governingMAWP,
    minRemainingLife,
    governingRLComponent
  );
  
  return {
    isCompliant: failCount === 0,
    overallStatus,
    checks,
    recommendations,
    nextInspectionDates,
    governingComponent,
    governingMAWP: governingMAWP === Infinity ? undefined : governingMAWP,
    summary,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate minimum required thickness for a component
 */
function calculateMinimumThickness(
  vessel: VesselData,
  component: ComponentData,
  allowableStress: number
): number {
  const P = vessel.designPressure;
  const R = (component.insideDiameter || vessel.insideDiameter) / 2;
  const S = allowableStress;
  const E = vessel.jointEfficiency;
  
  if (component.componentType === 'shell') {
    // ASME UG-27: t = PR / (SE - 0.6P)
    return calculateCylindricalShellThickness({ P, R, S, E });
  } else {
    // Head calculations based on type
    const headType = component.headType || 
      (vessel.headType?.toLowerCase().includes('hemi') ? 'hemispherical' :
       vessel.headType?.toLowerCase().includes('tori') ? 'torispherical' : 'ellipsoidal');
    
    const D = component.insideDiameter || vessel.insideDiameter;
    
    switch (headType) {
      case 'hemispherical':
        // ASME UG-32(f): t = PR / (2SE - 0.2P)
        return calculateHemisphericalHeadThickness({ P, R, S, E });
        
      case 'torispherical':
        // ASME UG-32(e): t = PLM / (2SE - 0.2P)
        const L = component.crownRadius || vessel.crownRadius || D;
        const r = component.knuckleRadius || vessel.knuckleRadius || D * 0.06;
        return calculateTorisphericalHeadThickness({ P, L, r, S, E });
        
      case 'ellipsoidal':
      default:
        // ASME UG-32(d): t = PD / (2SE - 0.2P) for 2:1 ellipsoidal
        return calculateEllipsoidalHeadThickness({ P, D, S, E });
    }
  }
}

/**
 * Calculate MAWP at current thickness
 */
function calculateMAWPAtThickness(
  vessel: VesselData,
  component: ComponentData,
  allowableStress: number
): number {
  const t = component.actualThickness;
  const R = (component.insideDiameter || vessel.insideDiameter) / 2;
  const S = allowableStress;
  const E = vessel.jointEfficiency;
  
  if (component.componentType === 'shell') {
    // ASME UG-27: P = SEt / (R + 0.6t)
    return calculateCylindricalShellMAWP({ t, R, S, E });
  } else {
    const headType = component.headType || 
      (vessel.headType?.toLowerCase().includes('hemi') ? 'hemispherical' :
       vessel.headType?.toLowerCase().includes('tori') ? 'torispherical' : 'ellipsoidal');
    
    const D = component.insideDiameter || vessel.insideDiameter;
    
    switch (headType) {
      case 'hemispherical':
        return calculateHemisphericalHeadMAWP({ t, R, S, E });
        
      case 'torispherical':
        const L = component.crownRadius || vessel.crownRadius || D;
        const r = component.knuckleRadius || vessel.knuckleRadius || D * 0.06;
        return calculateTorisphericalHeadMAWP({ t, L, r, S, E });
        
      case 'ellipsoidal':
      default:
        return calculateEllipsoidalHeadMAWP({ t, D, S, E });
    }
  }
}

/**
 * Calculate minimum thickness for nozzle per ASME UG-45
 */
function calculateNozzleMinThickness(
  P: number,
  nominalSize: number,
  S: number,
  E: number
): number {
  // t = PR / (SE - 0.6P) where R = nominal size / 2
  const R = nominalSize / 2;
  return (P * R) / (S * E - 0.6 * P);
}

/**
 * Calculate time span in years between two dates
 */
function calculateTimeSpanYears(
  previousDate: Date,
  currentDate: Date
): number {
  const diffMs = currentDate.getTime() - previousDate.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Generate compliance summary text
 */
function generateComplianceSummary(
  vessel: VesselData,
  checks: ComplianceCheck[],
  governingComponent: string,
  governingMAWP: number,
  minRemainingLife: number,
  governingRLComponent: string
): string {
  const passCount = checks.filter(c => c.status === 'PASS').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;
  
  let summary = `API 510 Compliance Assessment for ${vessel.vesselTagNumber}\n\n`;
  
  summary += `SUMMARY:\n`;
  summary += `- Total Checks: ${checks.length}\n`;
  summary += `- Passed: ${passCount}\n`;
  summary += `- Warnings: ${warningCount}\n`;
  summary += `- Failed: ${failCount}\n\n`;
  
  if (governingMAWP !== Infinity) {
    summary += `GOVERNING MAWP: ${governingMAWP.toFixed(1)} psig (limited by ${governingComponent})\n`;
    if (governingMAWP < vessel.designPressure) {
      summary += `*** MAWP IS BELOW DESIGN PRESSURE - VESSEL MUST BE DE-RATED ***\n`;
    }
  }
  
  if (minRemainingLife !== Infinity) {
    summary += `MINIMUM REMAINING LIFE: ${minRemainingLife.toFixed(1)} years (${governingRLComponent})\n`;
    if (minRemainingLife < 2) {
      summary += `*** CRITICAL: REMAINING LIFE IS BELOW MINIMUM - IMMEDIATE ACTION REQUIRED ***\n`;
    }
  }
  
  summary += `\nDESIGN CONDITIONS:\n`;
  summary += `- Design Pressure: ${vessel.designPressure} psig\n`;
  summary += `- Design Temperature: ${vessel.designTemperature}°F\n`;
  if (vessel.mdmt !== undefined) {
    summary += `- MDMT: ${vessel.mdmt}°F\n`;
  }
  
  return summary;
}

/**
 * Validate joint efficiency based on radiography type
 */
export function validateJointEfficiency(
  radiographyType: string | undefined,
  jointEfficiency: number
): { isValid: boolean; expectedE: number; message: string } {
  const rtMap: Record<string, number> = {
    'RT-1': 1.0,   // Full radiography
    'RT-2': 0.85,  // Spot radiography
    'RT-3': 0.70,  // No radiography (Type A joints)
    'RT-4': 0.65,  // No radiography (Type B joints)
  };
  
  if (!radiographyType) {
    return {
      isValid: true,
      expectedE: jointEfficiency,
      message: 'Radiography type not specified. Using provided joint efficiency.',
    };
  }
  
  const expectedE = rtMap[radiographyType.toUpperCase()] || 0.85;
  const isValid = jointEfficiency <= expectedE;
  
  return {
    isValid,
    expectedE,
    message: isValid
      ? `Joint efficiency ${jointEfficiency} is valid for ${radiographyType} (max ${expectedE})`
      : `Joint efficiency ${jointEfficiency} exceeds maximum ${expectedE} for ${radiographyType}`,
  };
}

/**
 * Generate API 510 compliant inspection report data
 */
export function generateReportData(
  vessel: VesselData,
  components: ComponentData[],
  nozzles: NozzleData[],
  complianceResult: ComplianceResult
): Record<string, any> {
  return {
    reportType: 'API 510 Pressure Vessel Inspection Report',
    vesselIdentification: {
      tagNumber: vessel.vesselTagNumber,
      name: vessel.vesselName,
      manufacturer: vessel.manufacturer,
      yearBuilt: vessel.yearBuilt,
      nbNumber: vessel.nbNumber,
      constructionCode: vessel.constructionCode,
    },
    designData: {
      designPressure: vessel.designPressure,
      designTemperature: vessel.designTemperature,
      mdmt: vessel.mdmt,
      materialSpec: vessel.materialSpec,
      jointEfficiency: vessel.jointEfficiency,
      insideDiameter: vessel.insideDiameter,
      overallLength: vessel.overallLength,
    },
    complianceStatus: {
      isCompliant: complianceResult.isCompliant,
      overallStatus: complianceResult.overallStatus,
      governingComponent: complianceResult.governingComponent,
      governingMAWP: complianceResult.governingMAWP,
    },
    componentResults: components.map(c => ({
      name: c.componentName,
      type: c.componentType,
      nominalThickness: c.nominalThickness,
      actualThickness: c.actualThickness,
      minimumRequired: calculateMinimumThickness(vessel, c, vessel.allowableStress || 20000),
    })),
    nozzleResults: nozzles.map(n => ({
      number: n.nozzleNumber,
      service: n.service,
      size: n.nominalSize,
      actualThickness: n.actualThickness,
      minimumRequired: n.minimumRequired,
    })),
    nextInspectionDates: complianceResult.nextInspectionDates,
    recommendations: complianceResult.recommendations,
    summary: complianceResult.summary,
  };
}
