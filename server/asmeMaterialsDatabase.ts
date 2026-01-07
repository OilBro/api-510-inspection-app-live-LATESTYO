/**
 * ASME Section II Part D Materials Database
 * Comprehensive Allowable Stress Values for Pressure Vessel Materials
 * 
 * Reference: ASME BPVC Section II Part D (2023 Edition)
 * - Table 1A: Maximum Allowable Stress Values for Ferrous Materials
 * - Table 1B: Maximum Allowable Stress Values for Nonferrous Materials
 * 
 * All values in psi (pounds per square inch)
 * Temperature values in °F (Fahrenheit)
 */

export interface MaterialStressEntry {
  temperatureF: number;
  allowableStressPsi: number;
}

export interface MaterialSpec {
  code: string;                    // e.g., "SA-516 Gr 70"
  aliases: string[];               // Alternative names/codes
  category: string;                // e.g., "Carbon Steel Plate"
  description: string;             // Full description
  minTensileStrength: number;      // psi
  minYieldStrength: number;        // psi
  asmeTable: string;               // e.g., "1A"
  temperatureRange: [number, number]; // [min, max] °F
  stressValues: MaterialStressEntry[];
}

// ============================================================================
// CARBON STEEL PLATE MATERIALS
// ============================================================================

const SA_516_GR_70: MaterialSpec = {
  code: 'SA-516 Gr 70',
  aliases: ['SA516-70', 'SA-516-70', 'A516-70', 'CS-A516-70', 'SA 516 70', 'SA516 GR70'],
  category: 'Carbon Steel Plate',
  description: 'Carbon steel plate for moderate and lower temperature service',
  minTensileStrength: 70000,
  minYieldStrength: 38000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 20000 },
    { temperatureF: 500, allowableStressPsi: 20000 },
    { temperatureF: 600, allowableStressPsi: 18400 },
    { temperatureF: 650, allowableStressPsi: 17300 },
    { temperatureF: 700, allowableStressPsi: 15500 },
    { temperatureF: 750, allowableStressPsi: 13200 },
    { temperatureF: 800, allowableStressPsi: 10800 },
    { temperatureF: 850, allowableStressPsi: 8500 },
    { temperatureF: 900, allowableStressPsi: 6500 },
    { temperatureF: 950, allowableStressPsi: 4800 },
    { temperatureF: 1000, allowableStressPsi: 3500 },
  ],
};

const SA_516_GR_65: MaterialSpec = {
  code: 'SA-516 Gr 65',
  aliases: ['SA516-65', 'SA-516-65', 'A516-65', 'CS-A516-65'],
  category: 'Carbon Steel Plate',
  description: 'Carbon steel plate for moderate and lower temperature service',
  minTensileStrength: 65000,
  minYieldStrength: 35000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 18800 },
    { temperatureF: 100, allowableStressPsi: 18800 },
    { temperatureF: 200, allowableStressPsi: 18800 },
    { temperatureF: 300, allowableStressPsi: 18800 },
    { temperatureF: 400, allowableStressPsi: 18800 },
    { temperatureF: 500, allowableStressPsi: 18800 },
    { temperatureF: 600, allowableStressPsi: 17300 },
    { temperatureF: 650, allowableStressPsi: 16300 },
    { temperatureF: 700, allowableStressPsi: 14600 },
    { temperatureF: 750, allowableStressPsi: 12400 },
    { temperatureF: 800, allowableStressPsi: 10200 },
  ],
};

const SA_516_GR_60: MaterialSpec = {
  code: 'SA-516 Gr 60',
  aliases: ['SA516-60', 'SA-516-60', 'A516-60', 'CS-A516-60'],
  category: 'Carbon Steel Plate',
  description: 'Carbon steel plate for moderate and lower temperature service',
  minTensileStrength: 60000,
  minYieldStrength: 32000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 17100 },
    { temperatureF: 100, allowableStressPsi: 17100 },
    { temperatureF: 200, allowableStressPsi: 17100 },
    { temperatureF: 300, allowableStressPsi: 17100 },
    { temperatureF: 400, allowableStressPsi: 17100 },
    { temperatureF: 500, allowableStressPsi: 17100 },
    { temperatureF: 600, allowableStressPsi: 15700 },
    { temperatureF: 650, allowableStressPsi: 14800 },
    { temperatureF: 700, allowableStressPsi: 13300 },
    { temperatureF: 750, allowableStressPsi: 11300 },
    { temperatureF: 800, allowableStressPsi: 9200 },
  ],
};

const SA_515_GR_70: MaterialSpec = {
  code: 'SA-515 Gr 70',
  aliases: ['SA515-70', 'SA-515-70', 'A515-70', 'CS-A515-70'],
  category: 'Carbon Steel Plate',
  description: 'Carbon steel plate for intermediate and higher temperature service',
  minTensileStrength: 70000,
  minYieldStrength: 38000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 20000 },
    { temperatureF: 500, allowableStressPsi: 19500 },
    { temperatureF: 600, allowableStressPsi: 17900 },
    { temperatureF: 650, allowableStressPsi: 16300 },
    { temperatureF: 700, allowableStressPsi: 13800 },
    { temperatureF: 750, allowableStressPsi: 11100 },
    { temperatureF: 800, allowableStressPsi: 8700 },
  ],
};

const SA_515_GR_60: MaterialSpec = {
  code: 'SA-515 Gr 60',
  aliases: ['SA515-60', 'SA-515-60', 'A515-60', 'CS-A515-60'],
  category: 'Carbon Steel Plate',
  description: 'Carbon steel plate for intermediate and higher temperature service',
  minTensileStrength: 60000,
  minYieldStrength: 32000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 17100 },
    { temperatureF: 100, allowableStressPsi: 17100 },
    { temperatureF: 200, allowableStressPsi: 17100 },
    { temperatureF: 300, allowableStressPsi: 17100 },
    { temperatureF: 400, allowableStressPsi: 17100 },
    { temperatureF: 500, allowableStressPsi: 16700 },
    { temperatureF: 600, allowableStressPsi: 15300 },
    { temperatureF: 650, allowableStressPsi: 14000 },
    { temperatureF: 700, allowableStressPsi: 11800 },
  ],
};

const SA_285_GR_C: MaterialSpec = {
  code: 'SA-285 Gr C',
  aliases: ['SA285-C', 'SA-285-C', 'A285-C', 'CS-A285-C'],
  category: 'Carbon Steel Plate',
  description: 'Low and intermediate tensile strength carbon steel plate',
  minTensileStrength: 55000,
  minYieldStrength: 30000,
  asmeTable: '1A',
  temperatureRange: [-20, 900],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 13800 },
    { temperatureF: 100, allowableStressPsi: 13800 },
    { temperatureF: 200, allowableStressPsi: 13800 },
    { temperatureF: 300, allowableStressPsi: 13800 },
    { temperatureF: 400, allowableStressPsi: 13800 },
    { temperatureF: 500, allowableStressPsi: 13500 },
    { temperatureF: 600, allowableStressPsi: 12400 },
    { temperatureF: 650, allowableStressPsi: 11700 },
    { temperatureF: 700, allowableStressPsi: 10500 },
    { temperatureF: 750, allowableStressPsi: 8900 },
    { temperatureF: 800, allowableStressPsi: 7300 },
  ],
};

const SA_612: MaterialSpec = {
  code: 'SA-612',
  aliases: ['SA612', 'A612', 'CS-A612', 'CS-A612-A'],
  category: 'Carbon Steel Plate',
  description: 'High-strength carbon steel plate for moderate and lower temperature service',
  minTensileStrength: 83000,
  minYieldStrength: 50000,
  asmeTable: '1A',
  temperatureRange: [-50, 700],
  stressValues: [
    { temperatureF: -50, allowableStressPsi: 20700 },
    { temperatureF: -20, allowableStressPsi: 20700 },
    { temperatureF: 100, allowableStressPsi: 20700 },
    { temperatureF: 200, allowableStressPsi: 20700 },
    { temperatureF: 300, allowableStressPsi: 20700 },
    { temperatureF: 400, allowableStressPsi: 20700 },
    { temperatureF: 500, allowableStressPsi: 20200 },
    { temperatureF: 600, allowableStressPsi: 18500 },
    { temperatureF: 650, allowableStressPsi: 16900 },
    { temperatureF: 700, allowableStressPsi: 14300 },
  ],
};

// ============================================================================
// STAINLESS STEEL MATERIALS
// ============================================================================

const SA_240_TYPE_304: MaterialSpec = {
  code: 'SA-240 Type 304',
  aliases: ['SA240-304', 'SA-240-304', 'SS-304', 'SS-A304', 'Type 304', '304 SS', 'A240 304'],
  category: 'Stainless Steel Plate',
  description: 'Chromium-nickel stainless steel plate',
  minTensileStrength: 75000,
  minYieldStrength: 30000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 18700 },
    { temperatureF: 500, allowableStressPsi: 17500 },
    { temperatureF: 600, allowableStressPsi: 16600 },
    { temperatureF: 650, allowableStressPsi: 16200 },
    { temperatureF: 700, allowableStressPsi: 15800 },
    { temperatureF: 750, allowableStressPsi: 15500 },
    { temperatureF: 800, allowableStressPsi: 15200 },
    { temperatureF: 850, allowableStressPsi: 14900 },
    { temperatureF: 900, allowableStressPsi: 14600 },
    { temperatureF: 950, allowableStressPsi: 14200 },
    { temperatureF: 1000, allowableStressPsi: 13700 },
    { temperatureF: 1050, allowableStressPsi: 12900 },
    { temperatureF: 1100, allowableStressPsi: 11700 },
    { temperatureF: 1150, allowableStressPsi: 10100 },
    { temperatureF: 1200, allowableStressPsi: 8300 },
    { temperatureF: 1250, allowableStressPsi: 6500 },
    { temperatureF: 1300, allowableStressPsi: 4900 },
    { temperatureF: 1350, allowableStressPsi: 3600 },
    { temperatureF: 1400, allowableStressPsi: 2600 },
    { temperatureF: 1450, allowableStressPsi: 1900 },
    { temperatureF: 1500, allowableStressPsi: 1400 },
  ],
};

const SA_240_TYPE_304L: MaterialSpec = {
  code: 'SA-240 Type 304L',
  aliases: ['SA240-304L', 'SA-240-304L', 'SS-304L', 'Type 304L', '304L SS'],
  category: 'Stainless Steel Plate',
  description: 'Low-carbon chromium-nickel stainless steel plate',
  minTensileStrength: 70000,
  minYieldStrength: 25000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 16700 },
    { temperatureF: 100, allowableStressPsi: 16700 },
    { temperatureF: 200, allowableStressPsi: 16700 },
    { temperatureF: 300, allowableStressPsi: 16700 },
    { temperatureF: 400, allowableStressPsi: 15600 },
    { temperatureF: 500, allowableStressPsi: 14600 },
    { temperatureF: 600, allowableStressPsi: 13900 },
    { temperatureF: 650, allowableStressPsi: 13500 },
    { temperatureF: 700, allowableStressPsi: 13200 },
    { temperatureF: 750, allowableStressPsi: 12900 },
    { temperatureF: 800, allowableStressPsi: 12700 },
    { temperatureF: 850, allowableStressPsi: 12400 },
    { temperatureF: 900, allowableStressPsi: 12200 },
  ],
};

const SA_240_TYPE_316: MaterialSpec = {
  code: 'SA-240 Type 316',
  aliases: ['SA240-316', 'SA-240-316', 'SS-316', 'Type 316', '316 SS'],
  category: 'Stainless Steel Plate',
  description: 'Chromium-nickel-molybdenum stainless steel plate',
  minTensileStrength: 75000,
  minYieldStrength: 30000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 19400 },
    { temperatureF: 500, allowableStressPsi: 18500 },
    { temperatureF: 600, allowableStressPsi: 17800 },
    { temperatureF: 650, allowableStressPsi: 17500 },
    { temperatureF: 700, allowableStressPsi: 17200 },
    { temperatureF: 750, allowableStressPsi: 17000 },
    { temperatureF: 800, allowableStressPsi: 16800 },
    { temperatureF: 850, allowableStressPsi: 16500 },
    { temperatureF: 900, allowableStressPsi: 16200 },
    { temperatureF: 950, allowableStressPsi: 15700 },
    { temperatureF: 1000, allowableStressPsi: 15000 },
    { temperatureF: 1050, allowableStressPsi: 13800 },
    { temperatureF: 1100, allowableStressPsi: 12200 },
    { temperatureF: 1150, allowableStressPsi: 10300 },
    { temperatureF: 1200, allowableStressPsi: 8300 },
    { temperatureF: 1250, allowableStressPsi: 6400 },
    { temperatureF: 1300, allowableStressPsi: 4800 },
    { temperatureF: 1350, allowableStressPsi: 3500 },
    { temperatureF: 1400, allowableStressPsi: 2500 },
    { temperatureF: 1450, allowableStressPsi: 1800 },
    { temperatureF: 1500, allowableStressPsi: 1300 },
  ],
};

const SA_240_TYPE_316L: MaterialSpec = {
  code: 'SA-240 Type 316L',
  aliases: ['SA240-316L', 'SA-240-316L', 'SS-316L', 'Type 316L', '316L SS'],
  category: 'Stainless Steel Plate',
  description: 'Low-carbon chromium-nickel-molybdenum stainless steel plate',
  minTensileStrength: 70000,
  minYieldStrength: 25000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 16700 },
    { temperatureF: 100, allowableStressPsi: 16700 },
    { temperatureF: 200, allowableStressPsi: 16700 },
    { temperatureF: 300, allowableStressPsi: 16700 },
    { temperatureF: 400, allowableStressPsi: 16200 },
    { temperatureF: 500, allowableStressPsi: 15400 },
    { temperatureF: 600, allowableStressPsi: 14800 },
    { temperatureF: 650, allowableStressPsi: 14600 },
    { temperatureF: 700, allowableStressPsi: 14300 },
    { temperatureF: 750, allowableStressPsi: 14100 },
    { temperatureF: 800, allowableStressPsi: 14000 },
    { temperatureF: 850, allowableStressPsi: 13800 },
    { temperatureF: 900, allowableStressPsi: 13500 },
  ],
};

// ============================================================================
// PIPE MATERIALS
// ============================================================================

const SA_106_GR_B: MaterialSpec = {
  code: 'SA-106 Gr B',
  aliases: ['SA106-B', 'SA-106-B', 'A106-B', 'CS-A106-B', 'SA106 Grade B'],
  category: 'Carbon Steel Pipe',
  description: 'Seamless carbon steel pipe for high-temperature service',
  minTensileStrength: 60000,
  minYieldStrength: 35000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 17100 },
    { temperatureF: 100, allowableStressPsi: 17100 },
    { temperatureF: 200, allowableStressPsi: 17100 },
    { temperatureF: 300, allowableStressPsi: 17100 },
    { temperatureF: 400, allowableStressPsi: 17100 },
    { temperatureF: 500, allowableStressPsi: 17100 },
    { temperatureF: 600, allowableStressPsi: 15700 },
    { temperatureF: 650, allowableStressPsi: 14800 },
    { temperatureF: 700, allowableStressPsi: 13300 },
    { temperatureF: 750, allowableStressPsi: 11300 },
    { temperatureF: 800, allowableStressPsi: 9200 },
    { temperatureF: 850, allowableStressPsi: 7200 },
    { temperatureF: 900, allowableStressPsi: 5500 },
    { temperatureF: 950, allowableStressPsi: 4000 },
    { temperatureF: 1000, allowableStressPsi: 2900 },
  ],
};

const SA_53_GR_B: MaterialSpec = {
  code: 'SA-53 Gr B',
  aliases: ['SA53-B', 'SA-53-B', 'A53-B', 'CS-A53-B', 'SA53 Grade B'],
  category: 'Carbon Steel Pipe',
  description: 'Welded and seamless steel pipe',
  minTensileStrength: 60000,
  minYieldStrength: 35000,
  asmeTable: '1A',
  temperatureRange: [-20, 750],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 15000 },
    { temperatureF: 100, allowableStressPsi: 15000 },
    { temperatureF: 200, allowableStressPsi: 15000 },
    { temperatureF: 300, allowableStressPsi: 15000 },
    { temperatureF: 400, allowableStressPsi: 15000 },
    { temperatureF: 500, allowableStressPsi: 15000 },
    { temperatureF: 600, allowableStressPsi: 13800 },
    { temperatureF: 650, allowableStressPsi: 13000 },
    { temperatureF: 700, allowableStressPsi: 11700 },
    { temperatureF: 750, allowableStressPsi: 9900 },
  ],
};

const SA_312_TYPE_304: MaterialSpec = {
  code: 'SA-312 Type 304',
  aliases: ['SA312-304', 'SA-312-304', 'SS-A312-304', 'A312 304'],
  category: 'Stainless Steel Pipe',
  description: 'Seamless and welded austenitic stainless steel pipe',
  minTensileStrength: 75000,
  minYieldStrength: 30000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 18700 },
    { temperatureF: 500, allowableStressPsi: 17500 },
    { temperatureF: 600, allowableStressPsi: 16600 },
    { temperatureF: 700, allowableStressPsi: 15800 },
    { temperatureF: 800, allowableStressPsi: 15200 },
  ],
};

// ============================================================================
// FORGING MATERIALS
// ============================================================================

const SA_105: MaterialSpec = {
  code: 'SA-105',
  aliases: ['SA105', 'A105', 'CS-A105', 'SA-105-N'],
  category: 'Carbon Steel Forging',
  description: 'Carbon steel forgings for piping applications',
  minTensileStrength: 70000,
  minYieldStrength: 36000,
  asmeTable: '1A',
  temperatureRange: [-20, 1000],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 20000 },
    { temperatureF: 500, allowableStressPsi: 20000 },
    { temperatureF: 600, allowableStressPsi: 18400 },
    { temperatureF: 650, allowableStressPsi: 17300 },
    { temperatureF: 700, allowableStressPsi: 15500 },
    { temperatureF: 750, allowableStressPsi: 13200 },
    { temperatureF: 800, allowableStressPsi: 10800 },
  ],
};

const SA_182_F304: MaterialSpec = {
  code: 'SA-182 F304',
  aliases: ['SA182-F304', 'SA-182-F304', 'F304', 'SS-F304'],
  category: 'Stainless Steel Forging',
  description: 'Forged or rolled alloy-steel pipe flanges and fittings',
  minTensileStrength: 75000,
  minYieldStrength: 30000,
  asmeTable: '1A',
  temperatureRange: [-425, 1500],
  stressValues: [
    { temperatureF: -20, allowableStressPsi: 20000 },
    { temperatureF: 100, allowableStressPsi: 20000 },
    { temperatureF: 200, allowableStressPsi: 20000 },
    { temperatureF: 300, allowableStressPsi: 20000 },
    { temperatureF: 400, allowableStressPsi: 18700 },
    { temperatureF: 500, allowableStressPsi: 17500 },
    { temperatureF: 600, allowableStressPsi: 16600 },
    { temperatureF: 700, allowableStressPsi: 15800 },
    { temperatureF: 800, allowableStressPsi: 15200 },
  ],
};

// ============================================================================
// COMPLETE DATABASE
// ============================================================================

export const MATERIALS_DATABASE: MaterialSpec[] = [
  // Carbon Steel Plate
  SA_516_GR_70,
  SA_516_GR_65,
  SA_516_GR_60,
  SA_515_GR_70,
  SA_515_GR_60,
  SA_285_GR_C,
  SA_612,
  // Stainless Steel Plate
  SA_240_TYPE_304,
  SA_240_TYPE_304L,
  SA_240_TYPE_316,
  SA_240_TYPE_316L,
  // Pipe Materials
  SA_106_GR_B,
  SA_53_GR_B,
  SA_312_TYPE_304,
  // Forgings
  SA_105,
  SA_182_F304,
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Normalize material code for matching
 */
function normalizeMaterialCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/GR(ADE)?/g, '')
    .replace(/TYPE/g, '');
}

/**
 * Find material specification by code or alias
 */
export function findMaterial(materialCode: string): MaterialSpec | null {
  const normalized = normalizeMaterialCode(materialCode);
  
  for (const material of MATERIALS_DATABASE) {
    // Check main code
    if (normalizeMaterialCode(material.code) === normalized) {
      return material;
    }
    
    // Check aliases
    for (const alias of material.aliases) {
      if (normalizeMaterialCode(alias) === normalized) {
        return material;
      }
    }
  }
  
  return null;
}

/**
 * Linear interpolation between two values
 */
function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Get allowable stress at a specific temperature with interpolation
 */
export function getAllowableStress(materialCode: string, temperatureF: number): number | null {
  const material = findMaterial(materialCode);
  if (!material) {
    return null;
  }
  
  const stressValues = material.stressValues;
  
  // Check if temperature is in range
  if (temperatureF < material.temperatureRange[0] || temperatureF > material.temperatureRange[1]) {
    return null;
  }
  
  // Find bracketing temperatures
  let lower: MaterialStressEntry | null = null;
  let upper: MaterialStressEntry | null = null;
  
  for (let i = 0; i < stressValues.length; i++) {
    const entry = stressValues[i];
    
    if (entry.temperatureF === temperatureF) {
      return entry.allowableStressPsi;
    }
    
    if (entry.temperatureF < temperatureF) {
      lower = entry;
    } else if (entry.temperatureF > temperatureF && upper === null) {
      upper = entry;
      break;
    }
  }
  
  // Interpolate if we have both bounds
  if (lower && upper) {
    return interpolate(
      temperatureF,
      lower.temperatureF,
      lower.allowableStressPsi,
      upper.temperatureF,
      upper.allowableStressPsi
    );
  }
  
  // Use nearest value if at edge
  if (lower) return lower.allowableStressPsi;
  if (upper) return upper.allowableStressPsi;
  
  return null;
}

/**
 * Get all stress values for a material (for display in tables)
 */
export function getMaterialStressTable(materialCode: string): MaterialStressEntry[] | null {
  const material = findMaterial(materialCode);
  return material?.stressValues ?? null;
}

/**
 * Get material category
 */
export function getMaterialCategory(materialCode: string): string | null {
  const material = findMaterial(materialCode);
  return material?.category ?? null;
}

/**
 * List all available materials
 */
export function listAllMaterials(): Array<{ code: string; category: string; description: string }> {
  return MATERIALS_DATABASE.map(m => ({
    code: m.code,
    category: m.category,
    description: m.description,
  }));
}

/**
 * Search materials by partial code or description
 */
export function searchMaterials(query: string): MaterialSpec[] {
  const normalized = query.toUpperCase();
  
  return MATERIALS_DATABASE.filter(m => 
    m.code.toUpperCase().includes(normalized) ||
    m.description.toUpperCase().includes(normalized) ||
    m.aliases.some(a => a.toUpperCase().includes(normalized))
  );
}
