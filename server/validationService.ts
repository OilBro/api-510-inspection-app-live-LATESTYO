import { createHash } from 'crypto';
import type { ProfessionalReport, ComponentCalculation } from '../drizzle/schema';

// =============================================================================
// Gold Standard Data Validation & Audit Service
// =============================================================================
// This service provides functions for validating data against regulatory
// requirements and creating the necessary audit trail records.
// Per API 510 and ASME VIII-1 requirements for audit defensibility.
// =============================================================================

export const APP_VERSION = '2.0.0-gold-standard';

/**
 * Validation rules for user-entered data per industry standards.
 */
export const validationRules = {
  // Thickness must be positive and not exceed nominal (no growth without explanation)
  actualThickness: (value: number, nominal: number): { valid: boolean; message?: string } => {
    if (value <= 0) return { valid: false, message: 'Actual thickness must be > 0' };
    if (value > nominal * 1.05) return { valid: false, message: 'Actual thickness exceeds nominal by >5% (possible measurement error)' };
    return { valid: true };
  },
  
  // Corrosion rate: 0 is valid (new vessel), negative indicates growth (anomaly)
  corrosionRate: (value: number): { valid: boolean; message?: string } => {
    if (value < 0) return { valid: false, message: 'Negative corrosion rate indicates thickness growth (anomaly)' };
    if (value > 0.5) return { valid: false, message: 'Corrosion rate > 0.5 in/yr is unusually high - verify measurement' };
    return { valid: true };
  },
  
  // Joint efficiency per ASME VIII-1 UW-12
  jointEfficiency: (value: number): { valid: boolean; message?: string } => {
    if (value < 0.45) return { valid: false, message: 'Joint efficiency < 0.45 is below minimum per ASME VIII-1' };
    if (value > 1.0) return { valid: false, message: 'Joint efficiency cannot exceed 1.0' };
    return { valid: true };
  },
  
  // Allowable stress per ASME Section II Part D
  allowableStress: (value: number): { valid: boolean; message?: string } => {
    if (value < 1000) return { valid: false, message: 'Allowable stress < 1,000 psi is unusually low' };
    if (value > 50000) return { valid: false, message: 'Allowable stress > 50,000 psi exceeds typical material limits' };
    return { valid: true };
  },
  
  // Design pressure validation
  designPressure: (value: number): { valid: boolean; message?: string } => {
    if (value <= 0) return { valid: false, message: 'Design pressure must be > 0' };
    if (value > 10000) return { valid: false, message: 'Design pressure > 10,000 psig requires special consideration' };
    return { valid: true };
  },
  
  // Design temperature validation
  designTemperature: (value: number): { valid: boolean; message?: string } => {
    if (value < -325) return { valid: false, message: 'Design temperature below cryogenic limit (-325°F)' };
    if (value > 1500) return { valid: false, message: 'Design temperature > 1,500°F requires special materials' };
    return { valid: true };
  },
};

/**
 * Validation result structure
 */
export interface ValidationResult {
  status: 'pending' | 'validated' | 'rejected' | 'override';
  notes: string[];
  warnings: string[];
  criticalIssues: string[];
}

/**
 * Validates a component calculation record against regulatory requirements.
 * @param record - The component calculation data.
 * @returns Validation result with status and notes.
 */
export function validateComponentData(record: Partial<ComponentCalculation>): ValidationResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Validate actual thickness
  if (record.actualThickness && record.nominalThickness) {
    const actual = Number(record.actualThickness);
    const nominal = Number(record.nominalThickness);
    const result = validationRules.actualThickness(actual, nominal);
    if (!result.valid && result.message) {
      warnings.push(result.message);
    }
  }

  // Validate corrosion rate
  if (record.corrosionRate !== undefined && record.corrosionRate !== null) {
    const cr = Number(record.corrosionRate);
    const result = validationRules.corrosionRate(cr);
    if (!result.valid && result.message) {
      if (cr < 0) {
        warnings.push(result.message);
      } else {
        warnings.push(result.message);
      }
    }
  }

  // Validate joint efficiency
  if (record.jointEfficiency !== undefined && record.jointEfficiency !== null) {
    const je = Number(record.jointEfficiency);
    const result = validationRules.jointEfficiency(je);
    if (!result.valid && result.message) {
      warnings.push(result.message);
    }
  }

  // Validate allowable stress
  if (record.allowableStress !== undefined && record.allowableStress !== null) {
    const stress = Number(record.allowableStress);
    const result = validationRules.allowableStress(stress);
    if (!result.valid && result.message) {
      warnings.push(result.message);
    }
  }

  // Critical check: actual thickness vs minimum required
  if (record.actualThickness && record.minimumThickness) {
    const actual = Number(record.actualThickness);
    const minimum = Number(record.minimumThickness);
    if (actual < minimum) {
      criticalIssues.push(`CRITICAL: Actual thickness (${actual.toFixed(4)}") is below minimum required (${minimum.toFixed(4)}")`);
    } else if (actual < minimum * 1.1) {
      warnings.push(`WARNING: Actual thickness is within 10% of minimum required - monitor closely`);
    }
  }

  // Data quality check: negative corrosion rate (growth)
  if (record.corrosionRate !== undefined && Number(record.corrosionRate) < 0) {
    notes.push('Anomaly detected: Negative corrosion rate indicates thickness growth. Verify measurement accuracy.');
  }

  // Determine overall status
  let status: ValidationResult['status'] = 'validated';
  if (criticalIssues.length > 0) {
    status = 'rejected';
  } else if (warnings.length > 0) {
    status = 'pending';
  }

  return { status, notes, warnings, criticalIssues };
}

/**
 * Input structure for calculation audit record
 */
export interface CalculationInputForAudit {
  P: number;
  R?: number;
  D?: number;
  S: number;
  E: number;
  t: number;
  L?: number;
  r?: number;
  vesselOrientation?: string;
  componentType?: string;
  headType?: string;
}

/**
 * Creates a SHA-256 hash of the calculation inputs for integrity verification.
 * @param inputs - The input parameters for the calculation.
 * @returns A SHA-256 hash string.
 */
export function hashCalculationInputs(inputs: CalculationInputForAudit): string {
  const hash = createHash('sha256');
  // Sort keys for consistent hashing
  const sortedInputs = Object.keys(inputs).sort().reduce((obj, key) => {
    obj[key] = inputs[key as keyof CalculationInputForAudit];
    return obj;
  }, {} as Record<string, unknown>);
  hash.update(JSON.stringify(sortedInputs));
  return hash.digest('hex');
}

/**
 * Creates a full audit record for a calculation.
 * @param inputs - The inputs to the calculation.
 * @param codeReference - The code reference for the calculation.
 * @param intermediateValues - The intermediate calculation values.
 * @param userId - The ID of the user performing the calculation.
 * @returns An object with all necessary audit trail fields.
 */
export function createCalculationAuditRecord(
  inputs: CalculationInputForAudit,
  codeReference: string,
  intermediateValues: Record<string, number | string>,
  userId: string
): {
  calculationHash: string;
  calculationTimestamp: Date;
  calculationVersion: string;
  calculatedBy: string;
  intermediateValues: Record<string, number | string>;
  codeReference: string;
} {
  return {
    calculationHash: hashCalculationInputs(inputs),
    calculationTimestamp: new Date(),
    calculationVersion: APP_VERSION,
    calculatedBy: userId,
    intermediateValues,
    codeReference,
  };
}

/**
 * Input for inspector certification validation
 */
export interface InspectorCertValidationInput {
  inspectorCertExpiry?: string | Date | null;
  reportDate?: string | Date | null;
}

/**
 * Validates an inspector's certification status.
 * @param input - The inspector certification data.
 * @returns An object with validation result and message.
 */
export function validateInspectorCertification(input: InspectorCertValidationInput): {
  valid: boolean;
  message?: string;
} {
  if (!input.inspectorCertExpiry) {
    return { valid: true }; // Cannot validate without expiry date
  }
  
  const reportDate = input.reportDate ? new Date(input.reportDate) : new Date();
  const expiryDate = new Date(input.inspectorCertExpiry);
  
  if (expiryDate < reportDate) {
    return {
      valid: false,
      message: `Inspector certification expired on ${expiryDate.toISOString().split('T')[0]}. Report date is ${reportDate.toISOString().split('T')[0]}.`,
    };
  }
  
  // Warn if expiring within 30 days
  const thirtyDaysFromReport = new Date(reportDate);
  thirtyDaysFromReport.setDate(thirtyDaysFromReport.getDate() + 30);
  
  if (expiryDate < thirtyDaysFromReport) {
    return {
      valid: true,
      message: `Warning: Inspector certification expires within 30 days (${expiryDate.toISOString().split('T')[0]}).`,
    };
  }
  
  return { valid: true };
}

/**
 * Creates a SHA-256 hash of a report's content for signature verification.
 * @param reportContent - A string representation of the report content to be signed.
 * @returns A SHA-256 hash string.
 */
export function hashReportContent(reportContent: string): string {
  const hash = createHash('sha256');
  hash.update(reportContent);
  return hash.digest('hex');
}

/**
 * Input for report finalization validation
 */
export interface ReportFinalizationInput {
  inspectorName?: string;
  inspectorCertification?: string;
  inspectorCertExpiry?: string;
  reportDate?: string;
  api510Compliant?: boolean;
  nonComplianceDetails?: string;
}

/**
 * Validates that a report can be finalized.
 * @param report - The professional report data.
 * @returns An object with validation result and any blocking issues.
 */
export function validateReportForFinalization(report: ReportFinalizationInput): {
  canFinalize: boolean;
  blockingIssues: string[];
  warnings: string[];
} {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // Check inspector certification
  const certValidation = validateInspectorCertification({
    inspectorCertExpiry: report.inspectorCertExpiry,
    reportDate: report.reportDate,
  });
  if (!certValidation.valid) {
    blockingIssues.push(certValidation.message || 'Inspector certification is invalid');
  } else if (certValidation.message) {
    warnings.push(certValidation.message);
  }

  // Check required fields
  if (!report.inspectorName) {
    blockingIssues.push('Inspector name is required');
  }
  if (!report.inspectorCertification) {
    blockingIssues.push('Inspector certification number is required');
  }
  if (!report.reportDate) {
    blockingIssues.push('Report date is required');
  }

  // Check compliance determination
  if (report.api510Compliant === false && !report.nonComplianceDetails) {
    blockingIssues.push('Non-compliance details are required when API 510 compliance is false');
  }

  return {
    canFinalize: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}

/**
 * Generates a compliance determination basis string.
 * @param report - The professional report data.
 * @param calculations - The component calculations.
 * @returns A formatted compliance determination basis string.
 */
export function generateComplianceDeterminationBasis(
  report: Partial<ProfessionalReport>,
  calculations: Partial<ComponentCalculation>[]
): string {
  const lines: string[] = [];
  
  lines.push('COMPLIANCE DETERMINATION BASIS');
  lines.push('=' .repeat(50));
  lines.push('');
  
  // API 510 Compliance
  lines.push('API 510 Compliance:');
  if (report.api510Compliant) {
    lines.push('  Status: COMPLIANT');
    lines.push('  Basis: All thickness measurements exceed minimum required thickness per API 510 §5.7');
  } else {
    lines.push('  Status: NON-COMPLIANT');
    lines.push(`  Details: ${report.nonComplianceDetails || 'Not specified'}`);
    lines.push(`  Code Sections: ${report.nonComplianceCodeSections || 'Not specified'}`);
  }
  lines.push('');
  
  // ASME Compliance
  lines.push('ASME VIII-1 Compliance:');
  if (report.asmeCompliant) {
    lines.push('  Status: COMPLIANT');
    lines.push('  Basis: All calculations performed per ASME Section VIII, Division 1');
  } else {
    lines.push('  Status: NON-COMPLIANT');
  }
  lines.push('');
  
  // Component Summary
  lines.push('Component Calculation Summary:');
  for (const calc of calculations) {
    if (calc.componentName) {
      lines.push(`  ${calc.componentName}:`);
      lines.push(`    t_actual: ${calc.actualThickness}" | t_min: ${calc.minimumThickness}"`);
      lines.push(`    MAWP: ${calc.calculatedMAWP} psig | Remaining Life: ${calc.remainingLife} years`);
      lines.push(`    Code Reference: ${calc.tMinCodeReference || 'N/A'}`);
    }
  }
  
  return lines.join('\n');
}
