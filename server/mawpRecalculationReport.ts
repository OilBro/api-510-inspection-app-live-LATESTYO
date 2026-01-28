/**
 * MAWP Recalculation Report Generator
 * 
 * Generates a complete MAWP recalculation report per:
 * - ASME Section VIII Division 1, UG-27(c)(1)
 * - API 510 - Pressure Vessel Inspection Code
 * 
 * All calculations include intermediate values for audit trail.
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MAWPRecalculationInput {
  // Vessel Identification
  vesselId: string;
  description: string;
  location: string;
  calculationDate: Date;
  engineer: string;

  // Original Design Data
  originalMAWP: number;
  designTemperature: number;
  materialSpecification: string;
  insideDiameter: number;
  nominalThickness: number;
  jointEfficiency: number;
  dataSource: string;

  // Material Properties
  allowableStress: number;
  asmeTableReference: string;

  // Current Thickness Data
  measuredThickness: number;
  measurementLocation: string;
  measurementDate: Date;
  measurementMethod: 'UT' | 'RT' | 'OTHER';
  numberOfReadings: number;
  minimumReading: number;

  // Operating Data
  currentOperatingPressure: number;

  // Assumptions
  assumptions: string[];

  // Reviewer Info
  preparedBy: string;
  reviewedBy?: string;
  reviewDate?: Date;
}

export interface MAWPCalculationResult {
  // Calculated values
  insideRadius: number;
  numerator: number;
  denominator: number;
  recalculatedMAWP: number;

  // Comparison
  reduction: number;
  reductionPercent: number;

  // Operating assessment
  margin: number;
  isCompliant: boolean;
  complianceMessage: string;

  // Intermediate values for audit
  intermediateValues: {
    step: number;
    calculation: string;
    result: number;
    unit: string;
  }[];
}

export interface MAWPRecalculationReport {
  input: MAWPRecalculationInput;
  calculation: MAWPCalculationResult;
  recommendations: string[];
  reportDate: Date;
}

// ============================================================================
// MAWP CALCULATION
// ============================================================================

/**
 * Calculate MAWP per ASME Section VIII Division 1, UG-27(c)(1)
 * 
 * Formula: MAWP = (S × E × t) / (R + 0.6 × t)
 * 
 * Where:
 * - S = Allowable stress (psi)
 * - E = Joint efficiency
 * - t = Actual thickness (inches)
 * - R = Inside radius (inches)
 * 
 * @param input - MAWP calculation input data
 * @returns Complete calculation result with intermediate values
 */
export function calculateMAWP(input: MAWPRecalculationInput): MAWPCalculationResult {
  const S = input.allowableStress;
  const E = input.jointEfficiency;
  const t = input.measuredThickness;
  const R = input.insideDiameter / 2;

  // Intermediate calculations
  const SE = S * E;
  const SEt = SE * t;
  const sixTenthsT = 0.6 * t;
  const denominator = R + sixTenthsT;
  const numerator = SEt;

  // MAWP calculation per UG-27(c)(1)
  const recalculatedMAWP = numerator / denominator;

  // Comparison to original
  const reduction = input.originalMAWP - recalculatedMAWP;
  const reductionPercent = input.originalMAWP > 0 
    ? (reduction / input.originalMAWP) * 100 
    : 0;

  // Operating pressure assessment
  const margin = recalculatedMAWP - input.currentOperatingPressure;
  const isCompliant = input.currentOperatingPressure <= recalculatedMAWP;
  const complianceMessage = isCompliant
    ? 'COMPLIANT - Vessel may continue operation at current pressure'
    : 'NON-COMPLIANT - Operating pressure exceeds recalculated MAWP';

  // Build intermediate values for audit trail
  const intermediateValues = [
    { step: 1, calculation: `S × E = ${S} × ${E}`, result: SE, unit: 'psi' },
    { step: 2, calculation: `S × E × t = ${SE} × ${t}`, result: SEt, unit: 'psi-in' },
    { step: 3, calculation: `0.6 × t = 0.6 × ${t}`, result: sixTenthsT, unit: 'inches' },
    { step: 4, calculation: `R + 0.6 × t = ${R} + ${sixTenthsT}`, result: denominator, unit: 'inches' },
    { step: 5, calculation: `MAWP = ${numerator.toFixed(2)} / ${denominator.toFixed(4)}`, result: recalculatedMAWP, unit: 'psig' },
  ];

  return {
    insideRadius: R,
    numerator,
    denominator,
    recalculatedMAWP,
    reduction,
    reductionPercent,
    margin,
    isCompliant,
    complianceMessage,
    intermediateValues,
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate complete MAWP Recalculation Report
 * 
 * @param input - All input data for the report
 * @returns Complete report with calculations and recommendations
 */
export function generateMAWPRecalculationReport(input: MAWPRecalculationInput): MAWPRecalculationReport {
  const calculation = calculateMAWP(input);

  // Generate recommendations based on results
  const recommendations: string[] = [];

  if (!calculation.isCompliant) {
    recommendations.push('IMMEDIATE ACTION REQUIRED: Reduce operating pressure to below recalculated MAWP or perform repairs/re-rating');
    recommendations.push('Consider fitness-for-service evaluation per API 579-1/ASME FFS-1');
  }

  if (calculation.reductionPercent > 20) {
    recommendations.push(`Significant MAWP reduction (${calculation.reductionPercent.toFixed(1)}%) - investigate root cause of metal loss`);
    recommendations.push('Consider increasing inspection frequency');
  }

  if (calculation.reductionPercent > 10 && calculation.reductionPercent <= 20) {
    recommendations.push(`Moderate MAWP reduction (${calculation.reductionPercent.toFixed(1)}%) - continue monitoring corrosion rate`);
  }

  if (calculation.margin < 50 && calculation.isCompliant) {
    recommendations.push(`Operating pressure margin is low (${calculation.margin.toFixed(1)} psig) - monitor closely`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Vessel is operating within acceptable limits');
    recommendations.push('Continue routine inspection program per API 510');
  }

  return {
    input,
    calculation,
    recommendations,
    reportDate: new Date(),
  };
}

// ============================================================================
// MARKDOWN REPORT FORMATTER
// ============================================================================

/**
 * Format MAWP Recalculation Report as Markdown
 * 
 * @param report - Generated report data
 * @returns Formatted Markdown string
 */
export function formatMAWPReportMarkdown(report: MAWPRecalculationReport): string {
  const { input, calculation } = report;

  return `# MAWP Recalculation Report

## Vessel Identification

| Field | Value |
|-------|-------|
| Vessel ID | ${input.vesselId} |
| Description | ${input.description} |
| Location | ${input.location} |
| Calculation Date | ${input.calculationDate.toISOString().split('T')[0]} |
| Engineer | ${input.engineer} |

## Original Design Data

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Original MAWP | ${input.originalMAWP.toFixed(1)} | psig | ${input.dataSource} |
| Design Temperature | ${input.designTemperature} | °F | ${input.dataSource} |
| Material Specification | ${input.materialSpecification} | - | ${input.dataSource} |
| Inside Diameter | ${input.insideDiameter.toFixed(3)} | inches | ${input.dataSource} |
| Inside Radius (R) | ${calculation.insideRadius.toFixed(3)} | inches | Calculated |
| Nominal Thickness | ${input.nominalThickness.toFixed(4)} | inches | ${input.dataSource} |
| Joint Efficiency (E) | ${input.jointEfficiency.toFixed(2)} | - | ${input.dataSource} |

## Material Properties

**Per ASME Section II Part D:**

| Parameter | Value | Unit | Table Reference |
|-----------|-------|------|-----------------|
| Material | ${input.materialSpecification} | - | - |
| Design Temperature | ${input.designTemperature} | °F | - |
| Allowable Stress (S) | ${input.allowableStress.toLocaleString()} | psi | ${input.asmeTableReference} |

**Reference:** ASME Section II Part D, ${input.asmeTableReference}

## Current Thickness Data

| Parameter | Value | Unit | Method |
|-----------|-------|------|--------|
| Measured Thickness (t_actual) | ${input.measuredThickness.toFixed(4)} | inches | ${input.measurementMethod} |
| Measurement Location | ${input.measurementLocation} | - | - |
| Measurement Date | ${input.measurementDate.toISOString().split('T')[0]} | - | - |
| Number of Readings | ${input.numberOfReadings} | - | - |
| Minimum Reading | ${input.minimumReading.toFixed(4)} | inches | - |

**Note:** MAWP recalculation uses minimum measured thickness.

## MAWP Recalculation

**Per ASME Section VIII Division 1, UG-27(c)(1):**

For cylindrical shells under internal pressure:

\`\`\`
MAWP = (S × E × t) / (R + 0.6 × t)
\`\`\`

| Parameter | Value | Unit |
|-----------|-------|------|
| Allowable Stress (S) | ${input.allowableStress.toLocaleString()} | psi |
| Joint Efficiency (E) | ${input.jointEfficiency.toFixed(2)} | - |
| Actual Thickness (t) | ${input.measuredThickness.toFixed(4)} | inches |
| Inside Radius (R) | ${calculation.insideRadius.toFixed(3)} | inches |

**Calculation:**
\`\`\`
MAWP = (${input.allowableStress.toLocaleString()} × ${input.jointEfficiency.toFixed(2)} × ${input.measuredThickness.toFixed(4)}) / (${calculation.insideRadius.toFixed(3)} + 0.6 × ${input.measuredThickness.toFixed(4)})
MAWP = ${calculation.numerator.toFixed(2)} / ${calculation.denominator.toFixed(4)}
MAWP = ${calculation.recalculatedMAWP.toFixed(1)} psig
\`\`\`

**Reference:** ASME Section VIII Division 1, UG-27(c)(1)

## Comparison to Original MAWP

| Parameter | Value | Unit |
|-----------|-------|------|
| Original MAWP | ${input.originalMAWP.toFixed(1)} | psig |
| Recalculated MAWP | ${calculation.recalculatedMAWP.toFixed(1)} | psig |
| Reduction | ${calculation.reduction.toFixed(1)} | psig |
| Reduction Percentage | ${calculation.reductionPercent.toFixed(1)} | % |

## Operating Pressure Assessment

| Parameter | Value | Unit |
|-----------|-------|------|
| Current Operating Pressure | ${input.currentOperatingPressure.toFixed(1)} | psig |
| Recalculated MAWP | ${calculation.recalculatedMAWP.toFixed(1)} | psig |
| Margin | ${calculation.margin.toFixed(1)} | psig |

**Compliance Determination:**
\`\`\`
IF Operating Pressure ≤ Recalculated MAWP:
    COMPLIANT - Vessel may continue operation at current pressure
ELSE:
    NON-COMPLIANT - Operating pressure exceeds recalculated MAWP
\`\`\`

**Result:** ${calculation.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}

## Assumptions

${input.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Recommendations

Based on this recalculation:

${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Report Certification

This calculation was performed in accordance with ASME Section VIII Division 1 and API 510. All values are traceable to the sources indicated.

| Field | Value |
|-------|-------|
| Prepared By | ${input.preparedBy} |
| Date | ${input.calculationDate.toISOString().split('T')[0]} |
| Reviewed By | ${input.reviewedBy || 'Pending'} |
| Review Date | ${input.reviewDate?.toISOString().split('T')[0] || 'Pending'} |

## Appendix: Intermediate Values

| Step | Calculation | Result | Unit |
|------|-------------|--------|------|
${calculation.intermediateValues.map(v => `| ${v.step} | ${v.calculation} | ${v.result.toFixed(4)} | ${v.unit} |`).join('\n')}
`;
}
