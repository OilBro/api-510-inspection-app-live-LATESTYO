/**
 * ENGINEERING INPUT VALIDATION GUARDS
 * OilPro 510 - Regulatory-Grade Inspection Application
 *
 * This module provides engineering-realistic validation for all calculation
 * inputs BEFORE they reach the locked calculation engine. Guards reject
 * physically impossible or clearly erroneous values.
 *
 * Reference bounds are derived from:
 * - ASME Section VIII Division 1 applicability limits
 * - API 510 Pressure Vessel Inspection Code scope
 * - Physical constraints (absolute zero, material limits, etc.)
 */

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationIssue {
    field: string;
    value: number | string | undefined;
    severity: 'error' | 'warning';
    message: string;
    engineeringBasis?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}

// ============================================================================
// ENGINEERING BOUNDS (per ASME VIII-1 / API 510 scope)
// ============================================================================

export const ENGINEERING_BOUNDS = {
    // Pressure (psi)
    pressure: {
        min: 0,           // Vacuum service handled separately
        maxDesign: 15000,  // ASME VIII-1 practical upper limit for most materials
        unit: 'psi',
        basis: 'ASME Section VIII Division 1 applicability',
    },

    // Temperature (°F)
    temperature: {
        absoluteMin: -460, // Absolute zero in °F (-273.15°C)
        practicalMin: -325, // Cryogenic service lower bound (LNG, etc.)
        practicalMax: 1500,  // Upper range for austenitic stainless steels
        unit: '°F',
        basis: 'ASME Section II Part D Table 1A temperature range',
    },

    // Diameter (inches)
    diameter: {
        min: 1,            // Smallest practical pressure vessel ID
        max: 600,          // Largest practical shop-fabricated vessels (~50 ft)
        unit: 'inches',
        basis: 'Practical shop fabrication limits for ASME VIII-1 vessels',
    },

    // Thickness (inches)
    thickness: {
        min: 0.010,        // Thinnest practical measurement (~10 mils)
        maxNominal: 6.0,    // Thickest practical vessel plate
        unit: 'inches',
        basis: 'Practical measurement and fabrication limits',
    },

    // Joint Efficiency
    jointEfficiency: {
        min: 0.45,         // UW-12 Type D, no spot RT
        max: 1.0,          // Full RT per UW-11(a)(5)
        basis: 'ASME Section VIII Division 1, UW-12',
    },

    // Corrosion Allowance (inches)
    corrosionAllowance: {
        min: 0,
        max: 0.5,          // Practical upper bound (½ inch is very aggressive)
        unit: 'inches',
        basis: 'Industry practice for carbon steel vessels',
    },

    // Corrosion Rate (mpy - mils per year)
    corrosionRate: {
        min: 0,
        warningThreshold: 25,  // >25 mpy is very aggressive
        max: 200,              // >200 mpy indicates data error
        unit: 'mpy',
        basis: 'NACE/API corrosion rate classification',
    },

    // Half apex angle for conical sections (degrees)
    halfApexAngle: {
        min: 0,
        max: 30,           // UG-32(g) limit
        unit: 'degrees',
        basis: 'ASME Section VIII Division 1, UG-32(g)',
    },

    // Specific gravity (dimensionless)
    specificGravity: {
        min: 0.3,          // Lightest practical process fluids (butane ~0.58)
        max: 15.0,         // Mercury ~13.6 is about the heaviest
        basis: 'Physical properties of common process fluids',
    },
} as const;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single numeric field against bounds.
 */
function validateRange(
    field: string,
    value: number | undefined | null,
    min: number,
    max: number,
    unit: string,
    basis: string,
    required: boolean = true,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (value === undefined || value === null || isNaN(value)) {
        if (required) {
            issues.push({
                field,
                value: value ?? undefined,
                severity: 'error',
                message: `${field} is required but not provided`,
            });
        }
        return issues;
    }

    if (!isFinite(value)) {
        issues.push({
            field,
            value,
            severity: 'error',
            message: `${field} must be a finite number (got ${value})`,
        });
        return issues;
    }

    if (value < min) {
        issues.push({
            field,
            value,
            severity: 'error',
            message: `${field} = ${value} ${unit} is below minimum ${min} ${unit}`,
            engineeringBasis: basis,
        });
    }

    if (value > max) {
        issues.push({
            field,
            value,
            severity: 'error',
            message: `${field} = ${value} ${unit} exceeds maximum ${max} ${unit}`,
            engineeringBasis: basis,
        });
    }

    return issues;
}

/**
 * Validate all inputs for a calculation run.
 * Call this BEFORE passing data to the locked calculation engine.
 */
export function validateCalculationInputs(input: {
    designPressure?: number;
    designTemperature?: number;
    insideDiameter?: number;
    nominalThickness?: number;
    currentThickness?: number;
    previousThickness?: number;
    jointEfficiency?: number;
    corrosionAllowance?: number;
    corrosionRate?: number;
    halfApexAngle?: number;
    specificGravity?: number;
    materialSpec?: string;
}): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const B = ENGINEERING_BOUNDS;

    // --- Design Pressure ---
    errors.push(
        ...validateRange('Design Pressure', input.designPressure, B.pressure.min, B.pressure.maxDesign, B.pressure.unit, B.pressure.basis)
    );

    // --- Design Temperature ---
    if (input.designTemperature !== undefined && input.designTemperature !== null) {
        if (input.designTemperature < B.temperature.absoluteMin) {
            errors.push({
                field: 'Design Temperature',
                value: input.designTemperature,
                severity: 'error',
                message: `Design Temperature = ${input.designTemperature}°F is below absolute zero (-460°F)`,
                engineeringBasis: 'Physical impossibility',
            });
        } else if (input.designTemperature < B.temperature.practicalMin) {
            warnings.push({
                field: 'Design Temperature',
                value: input.designTemperature,
                severity: 'warning',
                message: `Design Temperature = ${input.designTemperature}°F is below typical cryogenic range (${B.temperature.practicalMin}°F)`,
                engineeringBasis: B.temperature.basis,
            });
        } else if (input.designTemperature > B.temperature.practicalMax) {
            warnings.push({
                field: 'Design Temperature',
                value: input.designTemperature,
                severity: 'warning',
                message: `Design Temperature = ${input.designTemperature}°F exceeds ASME Section II Part D table range`,
                engineeringBasis: B.temperature.basis,
            });
        }
    } else {
        errors.push({
            field: 'Design Temperature',
            value: input.designTemperature,
            severity: 'error',
            message: 'Design Temperature is required',
        });
    }

    // --- Inside Diameter ---
    errors.push(
        ...validateRange('Inside Diameter', input.insideDiameter, B.diameter.min, B.diameter.max, B.diameter.unit, B.diameter.basis)
    );

    // --- Nominal Thickness ---
    if (input.nominalThickness !== undefined) {
        errors.push(
            ...validateRange('Nominal Thickness', input.nominalThickness, B.thickness.min, B.thickness.maxNominal, B.thickness.unit, B.thickness.basis, false)
        );
    }

    // --- Current (Actual) Thickness ---
    if (input.currentThickness !== undefined) {
        errors.push(
            ...validateRange('Current Thickness', input.currentThickness, B.thickness.min, B.thickness.maxNominal, B.thickness.unit, B.thickness.basis, false)
        );

        // Cross-check: actual should not exceed nominal
        if (input.nominalThickness !== undefined && input.currentThickness > input.nominalThickness * 1.1) {
            warnings.push({
                field: 'Current Thickness',
                value: input.currentThickness,
                severity: 'warning',
                message: `Current thickness (${input.currentThickness}") exceeds nominal (${input.nominalThickness}") by >10%. Verify measurement data.`,
                engineeringBasis: 'Physical plausibility check',
            });
        }
    }

    // --- Previous Thickness ---
    if (input.previousThickness !== undefined) {
        errors.push(
            ...validateRange('Previous Thickness', input.previousThickness, B.thickness.min, B.thickness.maxNominal, B.thickness.unit, B.thickness.basis, false)
        );
    }

    // --- Joint Efficiency ---
    errors.push(
        ...validateRange('Joint Efficiency', input.jointEfficiency, B.jointEfficiency.min, B.jointEfficiency.max, '', B.jointEfficiency.basis)
    );

    // --- Corrosion Allowance ---
    if (input.corrosionAllowance !== undefined) {
        errors.push(
            ...validateRange('Corrosion Allowance', input.corrosionAllowance, B.corrosionAllowance.min, B.corrosionAllowance.max, B.corrosionAllowance.unit, B.corrosionAllowance.basis, false)
        );
    }

    // --- Corrosion Rate ---
    if (input.corrosionRate !== undefined && input.corrosionRate !== null) {
        if (input.corrosionRate < B.corrosionRate.min) {
            errors.push({
                field: 'Corrosion Rate',
                value: input.corrosionRate,
                severity: 'error',
                message: `Corrosion Rate cannot be negative (${input.corrosionRate} mpy)`,
                engineeringBasis: B.corrosionRate.basis,
            });
        } else if (input.corrosionRate > B.corrosionRate.max) {
            errors.push({
                field: 'Corrosion Rate',
                value: input.corrosionRate,
                severity: 'error',
                message: `Corrosion Rate = ${input.corrosionRate} mpy exceeds physical plausibility (max ${B.corrosionRate.max} mpy)`,
                engineeringBasis: B.corrosionRate.basis,
            });
        } else if (input.corrosionRate > B.corrosionRate.warningThreshold) {
            warnings.push({
                field: 'Corrosion Rate',
                value: input.corrosionRate,
                severity: 'warning',
                message: `Corrosion Rate = ${input.corrosionRate} mpy is unusually high (>${B.corrosionRate.warningThreshold} mpy). Verify data.`,
                engineeringBasis: B.corrosionRate.basis,
            });
        }
    }

    // --- Half Apex Angle (conical) ---
    if (input.halfApexAngle !== undefined) {
        errors.push(
            ...validateRange('Half Apex Angle', input.halfApexAngle, B.halfApexAngle.min, B.halfApexAngle.max, B.halfApexAngle.unit, B.halfApexAngle.basis, false)
        );
    }

    // --- Specific Gravity ---
    if (input.specificGravity !== undefined) {
        errors.push(
            ...validateRange('Specific Gravity', input.specificGravity, B.specificGravity.min, B.specificGravity.max, '', B.specificGravity.basis, false)
        );
    }

    // --- Material Spec ---
    if (!input.materialSpec || input.materialSpec.trim() === '') {
        warnings.push({
            field: 'Material Spec',
            value: input.materialSpec,
            severity: 'warning',
            message: 'Material spec not provided — allowable stress must be supplied manually',
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate vessel-level inspection inputs (for TRPC mutation guard).
 */
export function validateInspectionInputs(input: {
    vesselTagNumber?: string;
    designPressure?: string | number;
    designTemperature?: string | number;
    insideDiameter?: string | number;
    materialSpec?: string;
    jointEfficiency?: string | number;
    yearBuilt?: number;
}): ValidationResult {
    const toNum = (v: string | number | undefined): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return isNaN(n) ? undefined : n;
    };

    return validateCalculationInputs({
        designPressure: toNum(input.designPressure),
        designTemperature: toNum(input.designTemperature),
        insideDiameter: toNum(input.insideDiameter),
        jointEfficiency: toNum(input.jointEfficiency),
        materialSpec: input.materialSpec,
    });
}
