/**
 * Remaining Life Calculation Report Generator
 * 
 * Generates a complete remaining life calculation report per:
 * - API 510 §7.1.1 - Remaining Life Calculation
 * - ASME Section VIII Division 1, UG-27 - Required Thickness
 * 
 * All calculations include intermediate values for audit trail.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface RemainingLifeReportInput {
  // Vessel Identification
  vesselId: string;
  description: string;
  location: string;
  inspectionDate: Date;
  inspector: string;

  // Design Data
  designPressure: number;
  designTemperature: number;
  materialSpecification: string;
  jointEfficiency: number;
  originalCorrosionAllowance: number;
  dataSource: string;

  // Geometry
  insideDiameter: number;
  insideRadius?: number;

  // Material Properties
  allowableStress: number;
  asmeTableReference: string;

  // Thickness Data
  nominalThickness: number;
  currentMeasuredThickness: number;
  measurementLocation: string;
  measurementDate: Date;
  measurementMethod: 'UT' | 'RT' | 'VISUAL' | 'PROFILE' | 'OTHER';

  // Corrosion Rate Data
  corrosionRateType: 'LT' | 'ST' | 'USER';
  corrosionRate: number;
  corrosionRateBasis: string;
  previousThickness?: number;
  previousInspectionDate?: Date;

  // Assumptions
  assumptions: string[];

  // Certification
  preparedBy: string;
  reviewedBy?: string;
  reviewDate?: Date;
}

export interface RequiredThicknessResult {
  tRequired: number;
  formula: string;
  intermediateValues: {
    step: number;
    calculation: string;
    result: number;
    unit: string;
  }[];
  reference: string;
}

export interface RemainingLifeResult {
  remainingLife: number;
  formula: string;
  intermediateValues: {
    step: number;
    calculation: string;
    result: number;
    unit: string;
  }[];
  reference: string;
}

export interface NextInspectionResult {
  interval: number;
  nextDate: Date;
  inspectionType: 'Internal' | 'External' | 'On-stream' | 'IMMEDIATE';
  formula: string;
  reference: string;
}

export interface ComplianceDetermination {
  isCompliant: boolean;
  remainingLifeYears: number;
  nextInspectionDue: Date;
  inspectionTypeRequired: string;
  message: string;
}

export interface RemainingLifeReport {
  input: RemainingLifeReportInput;
  requiredThickness: RequiredThicknessResult;
  remainingLife: RemainingLifeResult;
  nextInspection: NextInspectionResult;
  compliance: ComplianceDetermination;
  recommendations: string[];
  reportDate: Date;
}

// ============================================================================
// REQUIRED THICKNESS CALCULATION
// ============================================================================

/**
 * Calculate required thickness per ASME Section VIII Division 1, UG-27
 * 
 * Formula: t_required = (P × R) / (S × E - 0.6 × P)
 * 
 * @param input - Report input data
 * @returns Required thickness calculation result
 */
export function calculateRequiredThickness(input: RemainingLifeReportInput): RequiredThicknessResult {
  const P = input.designPressure;
  const R = input.insideRadius ?? input.insideDiameter / 2;
  const S = input.allowableStress;
  const E = input.jointEfficiency;

  // Intermediate calculations
  const PR = P * R;
  const SE = S * E;
  const sixTenthsP = 0.6 * P;
  const denominator = SE - sixTenthsP;
  const tRequired = PR / denominator;

  const intermediateValues = [
    { step: 1, calculation: `P × R = ${P} × ${R}`, result: PR, unit: 'psi-in' },
    { step: 2, calculation: `S × E = ${S} × ${E}`, result: SE, unit: 'psi' },
    { step: 3, calculation: `0.6 × P = 0.6 × ${P}`, result: sixTenthsP, unit: 'psi' },
    { step: 4, calculation: `S × E - 0.6 × P = ${SE} - ${sixTenthsP}`, result: denominator, unit: 'psi' },
    { step: 5, calculation: `t_required = ${PR.toFixed(2)} / ${denominator.toFixed(2)}`, result: tRequired, unit: 'inches' },
  ];

  return {
    tRequired,
    formula: `t_required = (P × R) / (S × E - 0.6 × P) = (${P} × ${R}) / (${S} × ${E} - 0.6 × ${P}) = ${tRequired.toFixed(4)} inches`,
    intermediateValues,
    reference: 'ASME Section VIII Division 1, UG-27(c)(1)',
  };
}

// ============================================================================
// REMAINING LIFE CALCULATION
// ============================================================================

/**
 * Calculate remaining life per API 510 §7.1.1
 * 
 * Formula: Remaining Life = (t_actual - t_required) / Corrosion Rate
 * 
 * @param tActual - Current measured thickness
 * @param tRequired - Minimum required thickness
 * @param corrosionRate - Corrosion rate in inches/year
 * @returns Remaining life calculation result
 */
export function calculateRemainingLife(
  tActual: number,
  tRequired: number,
  corrosionRate: number
): RemainingLifeResult {
  // Check if already below minimum
  if (tActual <= tRequired) {
    return {
      remainingLife: 0,
      formula: `Remaining Life = (${tActual.toFixed(4)} - ${tRequired.toFixed(4)}) / ${corrosionRate.toFixed(6)} = 0 years (at or below minimum)`,
      intermediateValues: [
        { step: 1, calculation: `t_actual - t_required = ${tActual.toFixed(4)} - ${tRequired.toFixed(4)}`, result: tActual - tRequired, unit: 'inches' },
        { step: 2, calculation: 'Result ≤ 0, Remaining Life = 0', result: 0, unit: 'years' },
      ],
      reference: 'API 510 §7.1.1',
    };
  }

  const margin = tActual - tRequired;
  const remainingLife = margin / corrosionRate;

  const intermediateValues = [
    { step: 1, calculation: `t_actual - t_required = ${tActual.toFixed(4)} - ${tRequired.toFixed(4)}`, result: margin, unit: 'inches' },
    { step: 2, calculation: `Remaining Life = ${margin.toFixed(4)} / ${corrosionRate.toFixed(6)}`, result: remainingLife, unit: 'years' },
  ];

  return {
    remainingLife,
    formula: `Remaining Life = (${tActual.toFixed(4)} - ${tRequired.toFixed(4)}) / ${corrosionRate.toFixed(6)} = ${remainingLife.toFixed(2)} years`,
    intermediateValues,
    reference: 'API 510 §7.1.1',
  };
}

// ============================================================================
// NEXT INSPECTION CALCULATION
// ============================================================================

/**
 * Calculate next inspection interval per API 510
 * 
 * Formula: Next Inspection = MIN(Remaining Life / 2, 10 years)
 * 
 * @param remainingLife - Calculated remaining life in years
 * @param currentDate - Date of current inspection
 * @returns Next inspection calculation result
 */
export function calculateNextInspection(
  remainingLife: number,
  currentDate: Date
): NextInspectionResult {
  if (remainingLife <= 0) {
    return {
      interval: 0,
      nextDate: currentDate,
      inspectionType: 'IMMEDIATE',
      formula: 'Remaining Life ≤ 0 - Immediate action required',
      reference: 'API 510',
    };
  }

  const halfLife = remainingLife / 2;
  const maxInterval = 10;
  const interval = Math.min(halfLife, maxInterval);

  // Calculate next date
  const nextDate = new Date(currentDate);
  const yearsToAdd = Math.floor(interval);
  const monthsToAdd = Math.round((interval % 1) * 12);
  nextDate.setFullYear(nextDate.getFullYear() + yearsToAdd);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

  // Determine inspection type
  let inspectionType: 'Internal' | 'External' | 'On-stream' | 'IMMEDIATE';
  if (remainingLife <= 4) {
    inspectionType = 'Internal';
  } else {
    inspectionType = 'External';
  }

  return {
    interval,
    nextDate,
    inspectionType,
    formula: `Next Inspection = MIN(${remainingLife.toFixed(2)} / 2, 10) = MIN(${halfLife.toFixed(2)}, 10) = ${interval.toFixed(2)} years`,
    reference: 'API 510',
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate complete Remaining Life Calculation Report
 * 
 * @param input - All input data for the report
 * @returns Complete report with calculations and recommendations
 */
export function generateRemainingLifeReport(input: RemainingLifeReportInput): RemainingLifeReport {
  // Calculate required thickness
  const requiredThickness = calculateRequiredThickness(input);

  // Calculate remaining life
  const remainingLife = calculateRemainingLife(
    input.currentMeasuredThickness,
    requiredThickness.tRequired,
    input.corrosionRate
  );

  // Calculate next inspection
  const nextInspection = calculateNextInspection(
    remainingLife.remainingLife,
    input.inspectionDate
  );

  // Determine compliance
  const compliance: ComplianceDetermination = {
    isCompliant: remainingLife.remainingLife > 0,
    remainingLifeYears: remainingLife.remainingLife,
    nextInspectionDue: nextInspection.nextDate,
    inspectionTypeRequired: nextInspection.inspectionType,
    message: remainingLife.remainingLife > 0
      ? `Vessel has ${remainingLife.remainingLife.toFixed(2)} years of remaining service life`
      : 'NON-COMPLIANT: Current thickness is at or below minimum required',
  };

  // Generate recommendations
  const recommendations: string[] = [];

  if (remainingLife.remainingLife <= 0) {
    recommendations.push('IMMEDIATE ACTION REQUIRED: Vessel is at or below minimum required thickness');
    recommendations.push('Perform fitness-for-service evaluation per API 579-1/ASME FFS-1');
    recommendations.push('Consider repair, re-rating, or retirement');
  } else if (remainingLife.remainingLife <= 4) {
    recommendations.push('Internal inspection required per API 510 (remaining life ≤ 4 years)');
    recommendations.push('Consider increasing inspection frequency');
    recommendations.push('Evaluate corrosion mitigation options');
  } else if (remainingLife.remainingLife <= 10) {
    recommendations.push('Continue routine inspection program per API 510');
    recommendations.push('Monitor corrosion rate trends');
  } else {
    recommendations.push('Vessel is in acceptable condition');
    recommendations.push('Continue routine inspection program per API 510');
  }

  return {
    input,
    requiredThickness,
    remainingLife,
    nextInspection,
    compliance,
    recommendations,
    reportDate: new Date(),
  };
}

// ============================================================================
// MARKDOWN REPORT FORMATTER
// ============================================================================

/**
 * Format Remaining Life Report as Markdown
 * 
 * @param report - Generated report data
 * @returns Formatted Markdown string
 */
export function formatRemainingLifeReportMarkdown(report: RemainingLifeReport): string {
  const { input, requiredThickness, remainingLife, nextInspection, compliance } = report;
  const R = input.insideRadius ?? input.insideDiameter / 2;

  return `# Remaining Life Calculation Report

## Vessel Identification

| Field | Value |
|-------|-------|
| Vessel ID | ${input.vesselId} |
| Description | ${input.description} |
| Location | ${input.location} |
| Inspection Date | ${input.inspectionDate.toISOString().split('T')[0]} |
| Inspector | ${input.inspector} |

## Design Data

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Design Pressure | ${input.designPressure} | psig | ${input.dataSource} |
| Design Temperature | ${input.designTemperature} | °F | ${input.dataSource} |
| Material Specification | ${input.materialSpecification} | - | ${input.dataSource} |
| Joint Efficiency (E) | ${input.jointEfficiency.toFixed(2)} | - | ${input.dataSource} |
| Original Corrosion Allowance | ${input.originalCorrosionAllowance.toFixed(4)} | inches | ${input.dataSource} |

## Thickness Data

| Parameter | Value | Unit | Method |
|-----------|-------|------|--------|
| Nominal Thickness | ${input.nominalThickness.toFixed(4)} | inches | Design |
| Current Measured Thickness (t_actual) | ${input.currentMeasuredThickness.toFixed(4)} | inches | ${input.measurementMethod} |
| Measurement Location | ${input.measurementLocation} | - | - |
| Measurement Date | ${input.measurementDate.toISOString().split('T')[0]} | - | - |

## Required Thickness Calculation

**Per ASME Section VIII Division 1, UG-27:**

\`\`\`
t_required = (P × R) / (S × E - 0.6 × P)
\`\`\`

| Parameter | Value | Unit |
|-----------|-------|------|
| Design Pressure (P) | ${input.designPressure} | psig |
| Inside Radius (R) | ${R.toFixed(3)} | inches |
| Allowable Stress (S) | ${input.allowableStress.toLocaleString()} | psi |
| Joint Efficiency (E) | ${input.jointEfficiency.toFixed(2)} | - |

**Calculation:**
\`\`\`
t_required = (${input.designPressure} × ${R.toFixed(3)}) / (${input.allowableStress.toLocaleString()} × ${input.jointEfficiency.toFixed(2)} - 0.6 × ${input.designPressure})
t_required = ${requiredThickness.tRequired.toFixed(4)} inches
\`\`\`

**Reference:** ${requiredThickness.reference}

## Corrosion Rate

| Parameter | Value | Unit | Basis |
|-----------|-------|------|-------|
| Corrosion Rate Type | ${input.corrosionRateType} | - | - |
| Corrosion Rate Value | ${input.corrosionRate.toFixed(6)} | in/yr | ${input.corrosionRateBasis} |
| Corrosion Rate (mpy) | ${(input.corrosionRate * 1000).toFixed(2)} | mpy | Converted |
${input.previousThickness ? `| Previous Thickness | ${input.previousThickness.toFixed(4)} | inches | ${input.previousInspectionDate?.toISOString().split('T')[0] || '-'} |` : ''}
| Current Thickness | ${input.currentMeasuredThickness.toFixed(4)} | inches | ${input.measurementDate.toISOString().split('T')[0]} |

${input.previousThickness && input.previousInspectionDate ? `
**Corrosion Rate Calculation (if derived):**
\`\`\`
CR = (t_prev - t_actual) / Time Interval
CR = (${input.previousThickness.toFixed(4)} - ${input.currentMeasuredThickness.toFixed(4)}) / ${((input.measurementDate.getTime() - input.previousInspectionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(2)}
CR = ${input.corrosionRate.toFixed(6)} in/yr
\`\`\`
` : ''}

## Remaining Life Calculation

**Per API 510 §7.1.1:**

\`\`\`
Remaining Life = (t_actual - t_required) / Corrosion Rate
\`\`\`

| Parameter | Value | Unit |
|-----------|-------|------|
| Current Thickness (t_actual) | ${input.currentMeasuredThickness.toFixed(4)} | inches |
| Required Thickness (t_required) | ${requiredThickness.tRequired.toFixed(4)} | inches |
| Corrosion Rate | ${input.corrosionRate.toFixed(6)} | in/yr |

**Calculation:**
\`\`\`
Remaining Life = (${input.currentMeasuredThickness.toFixed(4)} - ${requiredThickness.tRequired.toFixed(4)}) / ${input.corrosionRate.toFixed(6)}
Remaining Life = ${remainingLife.remainingLife.toFixed(2)} years
\`\`\`

**Reference:** ${remainingLife.reference}

## Assumptions

${input.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Compliance Determination

| Criterion | Result |
|-----------|--------|
| Remaining Life | ${remainingLife.remainingLife.toFixed(2)} years |
| Next Inspection Due | ${nextInspection.nextDate.toISOString().split('T')[0]} |
| Inspection Type Required | ${nextInspection.inspectionType} |

**Determination Basis:**
Per API 510, next inspection interval shall not exceed one-half the remaining life or 10 years, whichever is less.

\`\`\`
Next Inspection = MIN(Remaining Life / 2, 10 years)
Next Inspection = MIN(${remainingLife.remainingLife.toFixed(2)} / 2, 10)
Next Inspection = ${nextInspection.interval.toFixed(2)} years from ${input.inspectionDate.toISOString().split('T')[0]}
\`\`\`

## Recommendations

${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Report Certification

This calculation was performed in accordance with API 510 and ASME Section VIII Division 1. All values are traceable to the sources indicated.

| Field | Value |
|-------|-------|
| Prepared By | ${input.preparedBy} |
| Date | ${input.inspectionDate.toISOString().split('T')[0]} |
| Reviewed By | ${input.reviewedBy || 'Pending'} |
| Review Date | ${input.reviewDate?.toISOString().split('T')[0] || 'Pending'} |
`;
}
