/**
 * ASME Section II Part D Material Properties Database
 * API 510 Pressure Vessel Inspection App
 * 
 * This module provides a version-controlled database of material properties
 * per ASME Section II Part D. This is a LOCKED module - values are read-only
 * and cannot be modified at runtime.
 * 
 * Reference: ASME Boiler and Pressure Vessel Code, Section II, Part D
 * Database Version: 2023 Edition
 * 
 * CRITICAL: This module is LOCKED. No modifications to values are permitted
 * without formal revision control and re-verification.
 */

// Database version for audit traceability
export const DATABASE_VERSION = "ASME-BPVC-2023";
export const DATABASE_EFFECTIVE_DATE = "2023-07-01";

/**
 * Material properties record
 */
export interface MaterialProperties {
  specNumber: string;
  grade: string;
  productForm: string;
  minTensileStrength: number;  // psi
  minYieldStrength: number;    // psi
  maxTemperature: number;      // °F
  tableReference: string;      // ASME Section II Part D table reference
}

/**
 * Allowable stress lookup result
 */
export interface AllowableStressResult {
  stress: number | null;
  status: 'ok' | 'ok_interpolated' | 'error';
  message: string;
  databaseVersion: string;
  tableReference: string;
  temperatureRange?: { min: number; max: number };
}

/**
 * ASME Section II Part D Table 1A - Allowable Stress Values (psi)
 * Format: { materialSpec: { temperature_F: allowable_stress_psi } }
 * Note: Values are interpolated linearly between temperature points
 */
const ALLOWABLE_STRESS_TABLE_1A: Record<string, Record<number, number>> = {
  // SA-516 Grade 70 - Carbon Steel Plate for Pressure Vessels
  "SA-516 Gr 70": {
    [-20]: 20000,
    100: 20000,
    200: 20000,
    300: 20000,
    400: 20000,
    500: 20000,
    600: 20000,
    650: 20000,
    700: 20000,
    750: 19400,
    800: 17500,
    850: 14700,
    900: 11500,
  },
  // SA-516 Grade 60 - Carbon Steel Plate for Pressure Vessels
  "SA-516 Gr 60": {
    [-20]: 17100,
    100: 17100,
    200: 17100,
    300: 17100,
    400: 17100,
    500: 17100,
    600: 17100,
    650: 17100,
    700: 17100,
    750: 16600,
    800: 15000,
    850: 12600,
    900: 9800,
  },
  // SA-285 Grade C - Carbon Steel Plate for Pressure Vessels
  "SA-285 Gr C": {
    [-20]: 13800,
    100: 13800,
    200: 13800,
    300: 13800,
    400: 13800,
    500: 13800,
    600: 13800,
    650: 13800,
    700: 13800,
    750: 13400,
    800: 12100,
    850: 10200,
    900: 7900,
  },
  // SA-240 Type 304 - Stainless Steel Plate
  "SA-240 Type 304": {
    [-20]: 20000,
    100: 20000,
    200: 20000,
    300: 20000,
    400: 18900,
    500: 17500,
    600: 16600,
    700: 16000,
    800: 15600,
    900: 15200,
    1000: 14800,
    1100: 14300,
    1200: 13600,
    1300: 12300,
    1400: 10200,
    1500: 7700,
  },
  // SA-240 Type 316L - Stainless Steel Plate (Low Carbon)
  "SA-240 Type 316L": {
    [-20]: 16700,
    100: 16700,
    200: 16700,
    300: 16700,
    400: 15800,
    500: 14600,
    600: 13900,
    700: 13400,
    800: 13100,
    900: 12800,
    1000: 12500,
    1100: 12100,
    1200: 11500,
    1300: 10400,
    1400: 8600,
    1500: 6500,
  },
  // SA-106 Grade B - Seamless Carbon Steel Pipe
  "SA-106 Gr B": {
    [-20]: 17100,
    100: 17100,
    200: 17100,
    300: 17100,
    400: 17100,
    500: 17100,
    600: 17100,
    650: 17100,
    700: 17100,
    750: 16600,
    800: 15000,
    850: 12600,
    900: 9800,
  },
  // SA-312 Type 304 - Stainless Steel Pipe
  "SA-312 TP304": {
    [-20]: 20000,
    100: 20000,
    200: 20000,
    300: 20000,
    400: 18900,
    500: 17500,
    600: 16600,
    700: 16000,
    800: 15600,
    900: 15200,
    1000: 14800,
    1100: 14300,
    1200: 13600,
    1300: 12300,
    1400: 10200,
    1500: 7700,
  },
  // SA-312 Type 316L - Stainless Steel Pipe (Low Carbon)
  "SA-312 TP316L": {
    [-20]: 16700,
    100: 16700,
    200: 16700,
    300: 16700,
    400: 15800,
    500: 14600,
    600: 13900,
    700: 13400,
    800: 13100,
    900: 12800,
    1000: 12500,
    1100: 12100,
    1200: 11500,
    1300: 10400,
    1400: 8600,
    1500: 6500,
  },
  // SA-53 Grade B - Welded and Seamless Steel Pipe
  "SA-53 Gr B": {
    [-20]: 17100,
    100: 17100,
    200: 17100,
    300: 17100,
    400: 17100,
    500: 17100,
    600: 17100,
    650: 17100,
    700: 17100,
    750: 16600,
    800: 15000,
    850: 12600,
    900: 9800,
  },
  // SA-105 - Forged Carbon Steel Fittings
  "SA-105": {
    [-20]: 17500,
    100: 17500,
    200: 17500,
    300: 17500,
    400: 17500,
    500: 17500,
    600: 17500,
    650: 17500,
    700: 17500,
    750: 17000,
    800: 15300,
    850: 12900,
    900: 10000,
  },
};

/**
 * Material Properties Reference Data
 */
const MATERIAL_PROPERTIES: Record<string, MaterialProperties> = {
  "SA-516 Gr 70": {
    specNumber: "SA-516",
    grade: "70",
    productForm: "Plate",
    minTensileStrength: 70000,
    minYieldStrength: 38000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
  "SA-516 Gr 60": {
    specNumber: "SA-516",
    grade: "60",
    productForm: "Plate",
    minTensileStrength: 60000,
    minYieldStrength: 32000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
  "SA-285 Gr C": {
    specNumber: "SA-285",
    grade: "C",
    productForm: "Plate",
    minTensileStrength: 55000,
    minYieldStrength: 30000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
  "SA-240 Type 304": {
    specNumber: "SA-240",
    grade: "304",
    productForm: "Plate",
    minTensileStrength: 75000,
    minYieldStrength: 30000,
    maxTemperature: 1500,
    tableReference: "Table 1A"
  },
  "SA-240 Type 316L": {
    specNumber: "SA-240",
    grade: "316L",
    productForm: "Plate",
    minTensileStrength: 70000,
    minYieldStrength: 25000,
    maxTemperature: 1500,
    tableReference: "Table 1A"
  },
  "SA-106 Gr B": {
    specNumber: "SA-106",
    grade: "B",
    productForm: "Seamless Pipe",
    minTensileStrength: 60000,
    minYieldStrength: 35000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
  "SA-312 TP304": {
    specNumber: "SA-312",
    grade: "TP304",
    productForm: "Welded/Seamless Pipe",
    minTensileStrength: 75000,
    minYieldStrength: 30000,
    maxTemperature: 1500,
    tableReference: "Table 1A"
  },
  "SA-312 TP316L": {
    specNumber: "SA-312",
    grade: "TP316L",
    productForm: "Welded/Seamless Pipe",
    minTensileStrength: 70000,
    minYieldStrength: 25000,
    maxTemperature: 1500,
    tableReference: "Table 1A"
  },
  "SA-53 Gr B": {
    specNumber: "SA-53",
    grade: "B",
    productForm: "Welded/Seamless Pipe",
    minTensileStrength: 60000,
    minYieldStrength: 35000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
  "SA-105": {
    specNumber: "SA-105",
    grade: "N/A",
    productForm: "Forged Fittings",
    minTensileStrength: 70000,
    minYieldStrength: 36000,
    maxTemperature: 900,
    tableReference: "Table 1A"
  },
};

/**
 * Retrieve the allowable stress for a given material at a specified temperature.
 * 
 * This function performs linear interpolation between tabulated temperature values
 * per ASME Section II Part D methodology.
 * 
 * @param materialSpec - ASME material specification (e.g., "SA-516 Gr 70")
 * @param temperatureF - Design temperature in degrees Fahrenheit
 * @returns AllowableStressResult with stress value and traceability info
 * 
 * Reference: ASME Section II Part D, Table 1A
 */
export function getAllowableStress(
  materialSpec: string,
  temperatureF: number
): AllowableStressResult {
  // Validate material exists in database
  if (!(materialSpec in ALLOWABLE_STRESS_TABLE_1A)) {
    const available = Object.keys(ALLOWABLE_STRESS_TABLE_1A).sort().join(", ");
    return {
      stress: null,
      status: 'error',
      message: `Material '${materialSpec}' not found in database. Available: ${available}`,
      databaseVersion: DATABASE_VERSION,
      tableReference: "Table 1A"
    };
  }

  const stressTable = ALLOWABLE_STRESS_TABLE_1A[materialSpec];
  const temps = Object.keys(stressTable).map(Number).sort((a, b) => a - b);
  const minTemp = temps[0];
  const maxTemp = temps[temps.length - 1];

  // Validate temperature range
  if (temperatureF < minTemp) {
    return {
      stress: null,
      status: 'error',
      message: `Temperature ${temperatureF}°F below minimum ${minTemp}°F for ${materialSpec}`,
      databaseVersion: DATABASE_VERSION,
      tableReference: "Table 1A",
      temperatureRange: { min: minTemp, max: maxTemp }
    };
  }

  if (temperatureF > maxTemp) {
    return {
      stress: null,
      status: 'error',
      message: `Temperature ${temperatureF}°F exceeds maximum ${maxTemp}°F for ${materialSpec}`,
      databaseVersion: DATABASE_VERSION,
      tableReference: "Table 1A",
      temperatureRange: { min: minTemp, max: maxTemp }
    };
  }

  // Exact match
  if (temperatureF in stressTable) {
    return {
      stress: stressTable[temperatureF],
      status: 'ok',
      message: `Exact match at ${temperatureF}°F`,
      databaseVersion: DATABASE_VERSION,
      tableReference: "Table 1A",
      temperatureRange: { min: minTemp, max: maxTemp }
    };
  }

  // Linear interpolation
  const lowerTemp = Math.max(...temps.filter(t => t < temperatureF));
  const upperTemp = Math.min(...temps.filter(t => t > temperatureF));

  const lowerStress = stressTable[lowerTemp];
  const upperStress = stressTable[upperTemp];

  // Linear interpolation formula
  const interpolatedStress = lowerStress + (upperStress - lowerStress) *
    (temperatureF - lowerTemp) / (upperTemp - lowerTemp);

  return {
    stress: Math.round(interpolatedStress),
    status: 'ok_interpolated',
    message: `Interpolated between ${lowerTemp}°F (${lowerStress} psi) and ${upperTemp}°F (${upperStress} psi)`,
    databaseVersion: DATABASE_VERSION,
    tableReference: "Table 1A",
    temperatureRange: { min: minTemp, max: maxTemp }
  };
}

/**
 * Retrieve the material properties for a given specification.
 * 
 * @param materialSpec - ASME material specification (e.g., "SA-516 Gr 70")
 * @returns MaterialProperties if found, null otherwise
 */
export function getMaterialProperties(materialSpec: string): MaterialProperties | null {
  return MATERIAL_PROPERTIES[materialSpec] || null;
}

/**
 * Return a list of all available material specifications.
 */
export function listAvailableMaterials(): string[] {
  return Object.keys(ALLOWABLE_STRESS_TABLE_1A).sort();
}

/**
 * Return database version and traceability information.
 */
export function getDatabaseInfo(): {
  version: string;
  effectiveDate: string;
  reference: string;
  table: string;
  materialCount: number;
} {
  return {
    version: DATABASE_VERSION,
    effectiveDate: DATABASE_EFFECTIVE_DATE,
    reference: "ASME Boiler and Pressure Vessel Code, Section II, Part D",
    table: "Table 1A - Maximum Allowable Stress Values for Ferrous Materials",
    materialCount: Object.keys(ALLOWABLE_STRESS_TABLE_1A).length
  };
}

/**
 * Normalize material specification string to match database format.
 * Handles common variations in how materials are specified.
 * 
 * @param materialSpec - User-provided material specification
 * @returns Normalized material specification or null if not found
 */
export function normalizeMaterialSpec(materialSpec: string): string | null {
  // Direct match
  if (materialSpec in ALLOWABLE_STRESS_TABLE_1A) {
    return materialSpec;
  }

  // Try common normalizations - apply replacements in sequence
  let normalized = materialSpec
    .replace(/\s+/g, ' ')
    .replace(/GRADE\s*/gi, 'Gr ')
    .replace(/GR\.\s*/gi, 'Gr ')
    .replace(/TYPE\s*/gi, 'Type ')
    .replace(/TP\s*/gi, 'TP')
    .replace(/\s+/g, ' ')
    .trim();

  // Check normalized version against database keys
  for (const key of Object.keys(ALLOWABLE_STRESS_TABLE_1A)) {
    // Case-insensitive comparison with normalized spacing
    const normalizedKey = key.replace(/\s+/g, ' ').trim();
    const normalizedInput = normalized.replace(/\s+/g, ' ').trim();
    
    if (normalizedKey.toLowerCase() === normalizedInput.toLowerCase()) {
      return key;
    }
  }

  // Try partial matches (case-insensitive)
  const normalizedUpper = normalized.toUpperCase();
  for (const key of Object.keys(ALLOWABLE_STRESS_TABLE_1A)) {
    const keyUpper = key.toUpperCase();
    if (keyUpper.includes(normalizedUpper) || normalizedUpper.includes(keyUpper)) {
      return key;
    }
  }

  return null;
}

/**
 * Get allowable stress with automatic material specification normalization.
 * 
 * @param materialSpec - User-provided material specification (will be normalized)
 * @param temperatureF - Design temperature in degrees Fahrenheit
 * @returns AllowableStressResult with stress value and traceability info
 */
export function getAllowableStressNormalized(
  materialSpec: string,
  temperatureF: number
): AllowableStressResult & { normalizedSpec?: string } {
  const normalized = normalizeMaterialSpec(materialSpec);
  
  if (!normalized) {
    const available = Object.keys(ALLOWABLE_STRESS_TABLE_1A).sort().join(", ");
    return {
      stress: null,
      status: 'error',
      message: `Material '${materialSpec}' not found in database. Available: ${available}`,
      databaseVersion: DATABASE_VERSION,
      tableReference: "Table 1A"
    };
  }

  const result = getAllowableStress(normalized, temperatureF);
  return {
    ...result,
    normalizedSpec: normalized
  };
}
