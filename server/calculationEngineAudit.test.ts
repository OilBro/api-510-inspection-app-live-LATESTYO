/**
 * COMPREHENSIVE CALCULATION ENGINE AUDIT TEST SUITE
 * 
 * Purpose: Verify all calculation engines in the API 510 Inspection App
 * against hand-calculated reference values per ASME Section VIII Division 1
 * and API 510 Pressure Vessel Inspection Code.
 * 
 * Each test case includes:
 * - Hand-calculated expected value with formula shown
 * - ASME/API code paragraph reference
 * - Tolerance specification (±0.5% for thickness, ±1% for MAWP)
 * 
 * Reference Standards:
 * - ASME BPVC Section VIII Division 1 (2023 Edition)
 * - API 510 Pressure Vessel Inspection Code
 * - ASME Section II Part D (Material Properties)
 * - ASME B36.10M (Pipe Dimensions)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateShellThickness,
  calculateHemisphericalHead,
  calculateEllipsoidalHead,
  calculateTorisphericalHead,
  calculateFlatHead,
  calculateConicalSection,
  calculateNozzleThickness,
  calculateInspectionIntervals,
  calculateVesselSummary,
  type CalculationInputs,
} from './asmeCalculations';

import {
  calculateTRequiredShell,
  calculateTRequiredEllipsoidalHead,
  calculateTRequiredTorisphericalHead,
  calculateTRequiredHemisphericalHead,
  calculateMAWPShell,
  calculateMAWPEllipsoidalHead,
  calculateMAWPTorisphericalHead,
  calculateMAWPHemisphericalHead,
  calculateCorrosionRateLongTerm,
  calculateCorrosionRateShortTerm,
  calculateRemainingLife,
  calculateNextInspectionInterval,
  calculateMAPAtNextInspection,
  performFullCalculation,
  type CalculationInput,
} from './lockedCalculationEngine';

import {
  calculateReinforcementArea,
  calculateNozzleMinimumThickness,
  calculateCompleteNozzleEvaluation,
} from './nozzleCalculations';

import {
  getAllowableStress,
  getAllowableStressNormalized,
  normalizeMaterialSpec,
  getMaterialProperties,
  listAvailableMaterials,
} from './asmeMaterialDatabase';

import {
  getPipeSchedule,
} from './pipeScheduleDatabase';

// ============================================================================
// TOLERANCE CONSTANTS
// ============================================================================
const THICKNESS_TOL = 0.005;  // ±0.5% relative tolerance for thickness
const MAWP_TOL = 0.01;       // ±1% relative tolerance for MAWP
const RATE_TOL = 0.01;       // ±1% relative tolerance for corrosion rates
const LIFE_TOL = 0.02;       // ±2% relative tolerance for remaining life
const ABS_TOL = 0.001;       // Absolute tolerance for very small values

/**
 * Helper: Check value within relative tolerance
 */
function expectCloseTo(actual: number, expected: number, relTol: number, label: string) {
  if (Math.abs(expected) < ABS_TOL) {
    // For near-zero expected values, use absolute tolerance
    expect(Math.abs(actual - expected)).toBeLessThan(ABS_TOL * 10);
  } else {
    const relError = Math.abs((actual - expected) / expected);
    expect(relError).toBeLessThan(relTol);
  }
}

// ============================================================================
// 1. ASME MATERIAL DATABASE VERIFICATION
// ============================================================================
describe('ASME Material Database (Section II Part D)', () => {
  
  describe('SA-516 Gr 70 Allowable Stress Values', () => {
    // Per ASME Section II Part D, Table 1A, 2023 Edition
    // SA-516 Gr 70: Carbon Steel Plate
    
    it('should return 20,000 psi at 100°F (exact table value)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });
    
    it('should return 20,000 psi at 500°F (exact table value)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });
    
    it('should return 20,000 psi at 700°F (exact table value)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 700);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });
    
    it('should return 19,400 psi at 750°F (exact table value)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 750);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(19400);
    });
    
    it('should return 17,500 psi at 800°F (exact table value)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17500);
    });
    
    it('should interpolate correctly at 725°F', () => {
      // Between 700°F (20,000) and 750°F (19,400)
      // Linear: 20000 + (19400-20000) * (725-700)/(750-700) = 20000 + (-600)*0.5 = 19700
      const result = getAllowableStress('SA-516 Gr 70', 725);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(19700);
    });
    
    it('should interpolate correctly at 775°F', () => {
      // Between 750°F (19,400) and 800°F (17,500)
      // Linear: 19400 + (17500-19400) * (775-750)/(800-750) = 19400 + (-1900)*0.5 = 18450
      const result = getAllowableStress('SA-516 Gr 70', 775);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(18450);
    });
    
    it('should return error for temperature above max (900°F)', () => {
      const result = getAllowableStress('SA-516 Gr 70', 950);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });
  });
  
  describe('SA-240 Type 304 Stainless Steel', () => {
    it('should return 20,000 psi at 100°F', () => {
      const result = getAllowableStress('SA-240 Type 304', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });
    
    it('should return 17,500 psi at 500°F', () => {
      const result = getAllowableStress('SA-240 Type 304', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17500);
    });
  });
  
  describe('Material Specification Normalization', () => {
    it('should normalize "SA-516 Grade 70" to "SA-516 Gr 70"', () => {
      const result = normalizeMaterialSpec('SA-516 Grade 70');
      expect(result).toBe('SA-516 Gr 70');
    });
    
    it('should normalize "sa-516 gr 70" (lowercase) to "SA-516 Gr 70"', () => {
      const result = normalizeMaterialSpec('sa-516 gr 70');
      expect(result).toBe('SA-516 Gr 70');
    });
    
    it('should return null for unknown material', () => {
      const result = normalizeMaterialSpec('SA-999 Gr 99');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// 2. SHELL CALCULATIONS - UG-27 (asmeCalculations.ts)
// ============================================================================
describe('Shell Calculations - ASME UG-27 (asmeCalculations.ts)', () => {
  
  describe('Case 1: Typical Carbon Steel Vessel', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi (SA-516 Gr 70 @ 500°F), E = 0.85
    //   R = D/2 = 24"
    //
    // UG-27(c)(1) Circumferential: t = PR/(SE-0.6P) = 150×24/(20000×0.85-0.6×150)
    //   = 3600/(17000-90) = 3600/16910 = 0.21290 inches
    //
    // UG-27(c)(2) Longitudinal: t = PR/(2SE+0.4P) = 150×24/(2×20000×0.85+0.4×150)
    //   = 3600/(34000+60) = 3600/34060 = 0.10570 inches
    //
    // Governing: t_min = 0.21290" (circumferential governs)
    
    const inputs: CalculationInputs = {
      P: 150, S: 20000, E: 0.85, D: 48
    };
    
    it('should calculate t_min correctly per UG-27(c)(1)', () => {
      const result = calculateShellThickness(inputs);
      const expected_t_min = (150 * 24) / (20000 * 0.85 - 0.6 * 150);
      expectCloseTo(result.t_min, expected_t_min, THICKNESS_TOL, 't_min');
      expect(result.t_min_circ).toBeDefined();
      expectCloseTo(result.t_min_circ!, expected_t_min, THICKNESS_TOL, 't_min_circ');
    });
    
    it('should calculate t_min_long correctly per UG-27(c)(2)', () => {
      const result = calculateShellThickness(inputs);
      const expected_long = (150 * 24) / (2 * 20000 * 0.85 + 0.4 * 150);
      expect(result.t_min_long).toBeDefined();
      expectCloseTo(result.t_min_long!, expected_long, THICKNESS_TOL, 't_min_long');
    });
    
    it('should identify circumferential stress as governing', () => {
      const result = calculateShellThickness(inputs);
      expect(result.governingCondition).toBe('Circumferential Stress');
    });
  });
  
  describe('Case 2: Shell MAWP at Actual Thickness', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85, t_act = 0.375"
    //   R = 24"
    //
    // MAWP_circ = SEt/(R+0.6t) = 20000×0.85×0.375/(24+0.6×0.375)
    //   = 6375/(24+0.225) = 6375/24.225 = 263.16 psi
    //
    // MAWP_long = 2SEt/(R-0.4t) = 2×20000×0.85×0.375/(24-0.4×0.375)
    //   = 12750/(24-0.15) = 12750/23.85 = 534.59 psi
    //
    // Governing MAWP = MIN(263.16, 534.59) = 263.16 psi
    
    const inputs: CalculationInputs = {
      P: 150, S: 20000, E: 0.85, D: 48, t_act: 0.375
    };
    
    it('should calculate MAWP correctly', () => {
      const result = calculateShellThickness(inputs);
      const expected_mawp_circ = (20000 * 0.85 * 0.375) / (24 + 0.6 * 0.375);
      expectCloseTo(result.MAWP, expected_mawp_circ, MAWP_TOL, 'MAWP');
    });
    
    it('should calculate MAWP_circ correctly', () => {
      const result = calculateShellThickness(inputs);
      const expected = (20000 * 0.85 * 0.375) / (24 + 0.6 * 0.375);
      expect(result.MAWP_circ).toBeDefined();
      expectCloseTo(result.MAWP_circ!, expected, MAWP_TOL, 'MAWP_circ');
    });
    
    it('should calculate MAWP_long correctly', () => {
      const result = calculateShellThickness(inputs);
      const expected = (2 * 20000 * 0.85 * 0.375) / (24 - 0.4 * 0.375);
      expect(result.MAWP_long).toBeDefined();
      expectCloseTo(result.MAWP_long!, expected, MAWP_TOL, 'MAWP_long');
    });
    
    it('should be compliant (t_act > t_min)', () => {
      const result = calculateShellThickness(inputs);
      expect(result.isCompliant).toBe(true);
    });
  });
  
  describe('Case 3: Shell with Corrosion Rate and Remaining Life', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85
    //   t_act = 0.375", t_prev = 0.400", Y = 5 years
    //
    // t_min = 0.21290" (from Case 1)
    // Ca = t_act - t_min = 0.375 - 0.21290 = 0.16210"
    // Cr_short = (t_prev - t_act) / Y = (0.400 - 0.375) / 5 = 0.005 in/yr
    // RL = Ca / Cr = 0.16210 / 0.005 = 32.42 years
    
    const inputs: CalculationInputs = {
      P: 150, S: 20000, E: 0.85, D: 48,
      t_act: 0.375, t_prev: 0.400, Y: 5
    };
    
    it('should calculate short-term corrosion rate correctly', () => {
      const result = calculateShellThickness(inputs);
      const expected_cr = (0.400 - 0.375) / 5;
      expect(result.Cr_short).toBeDefined();
      expectCloseTo(result.Cr_short!, expected_cr, RATE_TOL, 'Cr_short');
    });
    
    it('should calculate remaining life correctly', () => {
      const result = calculateShellThickness(inputs);
      const t_min = (150 * 24) / (20000 * 0.85 - 0.6 * 150);
      const Ca = 0.375 - t_min;
      const Cr = 0.005;
      const expected_RL = Ca / Cr;
      expect(result.RL).toBeDefined();
      expectCloseTo(result.RL!, expected_RL, LIFE_TOL, 'RL');
    });
  });
  
  describe('Case 4: High Pressure Vessel', () => {
    // Given:
    //   P = 500 psi, D = 36", S = 20,000 psi, E = 1.0 (full RT)
    //   R = 18"
    //
    // UG-27(c)(1): t = 500×18/(20000×1.0-0.6×500) = 9000/(20000-300) = 9000/19700 = 0.45685"
    // UG-27(c)(2): t = 500×18/(2×20000×1.0+0.4×500) = 9000/(40000+200) = 9000/40200 = 0.22388"
    
    const inputs: CalculationInputs = {
      P: 500, S: 20000, E: 1.0, D: 36
    };
    
    it('should calculate t_min for high pressure correctly', () => {
      const result = calculateShellThickness(inputs);
      const expected = (500 * 18) / (20000 * 1.0 - 0.6 * 500);
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 't_min');
    });
  });
});

// ============================================================================
// 3. SHELL CALCULATIONS - UG-27 (lockedCalculationEngine.ts)
// ============================================================================
describe('Shell Calculations - ASME UG-27 (lockedCalculationEngine.ts)', () => {
  
  describe('Case 1: t_required for Shell', () => {
    // Given:
    //   P = 150 psi, D = 48" (R = 24"), S = 20,000 psi, E = 0.85
    //
    // t = PR/(SE-0.6P) = 150×24/(20000×0.85-0.6×150) = 3600/16910 = 0.21290"
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
    };
    
    it('should calculate t_required correctly', () => {
      const result = calculateTRequiredShell(input);
      expect(result.success).toBe(true);
      const expected = (150 * 24) / (20000 * 0.85 - 0.6 * 150);
      expectCloseTo(result.resultValue!, expected, THICKNESS_TOL, 't_required');
    });
  });
  
  describe('Case 2: MAWP for Shell', () => {
    // Given:
    //   t = 0.375", D = 48" (R = 24"), S = 20,000 psi, E = 0.85
    //
    // MAWP = SEt/(R+0.6t) = 20000×0.85×0.375/(24+0.6×0.375)
    //   = 6375/24.225 = 263.16 psi
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
    };
    
    it('should calculate MAWP correctly', () => {
      const result = calculateMAWPShell(input);
      expect(result.success).toBe(true);
      const expected = (20000 * 0.85 * 0.375) / (24 + 0.6 * 0.375);
      expectCloseTo(result.resultValue!, expected, MAWP_TOL, 'MAWP');
    });
  });
  
  describe('Case 3: Shell with Static Head (Horizontal Vessel)', () => {
    // Given:
    //   P = 150 psi, D = 48" (R = 24"), S = 20,000 psi, E = 0.85
    //   Horizontal vessel, SG = 0.85
    //
    // Static head = SG × 62.4 × D / 144 = 0.85 × 62.4 × 48 / 144 = 17.68 psi
    // Total P = 150 + 17.68 = 167.68 psi
    // t = 167.68×24/(20000×0.85-0.6×167.68) = 4024.32/(17000-100.608) = 4024.32/16899.39 = 0.23814"
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      vesselOrientation: 'horizontal',
      specificGravity: 0.85,
    };
    
    it('should include static head in t_required calculation', () => {
      const result = calculateTRequiredShell(input);
      expect(result.success).toBe(true);
      const staticHead = (0.85 * 62.4 * 48) / 144;
      const totalP = 150 + staticHead;
      const expected = (totalP * 24) / (20000 * 0.85 - 0.6 * totalP);
      expectCloseTo(result.resultValue!, expected, THICKNESS_TOL, 't_required with static head');
    });
  });
});

// ============================================================================
// 4. HEAD CALCULATIONS - UG-32 (asmeCalculations.ts)
// ============================================================================
describe('Head Calculations - ASME UG-32 (asmeCalculations.ts)', () => {
  
  describe('Hemispherical Head - UG-32(f)', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85
    //   L = R = D/2 = 24"
    //
    // t = PL/(2SE-0.2P) = 150×24/(2×20000×0.85-0.2×150)
    //   = 3600/(34000-30) = 3600/33970 = 0.10598"
    //
    // MAWP (at t_act = 0.375"):
    //   P = 2SEt/(L+0.2t) = 2×20000×0.85×0.375/(24+0.2×0.375)
    //   = 12750/(24+0.075) = 12750/24.075 = 529.59 psi
    
    it('should calculate t_min correctly', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const result = calculateHemisphericalHead(inputs);
      const L = 24;
      const expected = (150 * L) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'hemi t_min');
    });
    
    it('should calculate MAWP correctly at actual thickness', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, t_act: 0.375 };
      const result = calculateHemisphericalHead(inputs);
      const L = 24;
      const expected = (2 * 20000 * 0.85 * 0.375) / (L + 0.2 * 0.375);
      expectCloseTo(result.MAWP, expected, MAWP_TOL, 'hemi MAWP');
    });
  });
  
  describe('2:1 Ellipsoidal Head - UG-32(d)', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85
    //   K = 1.0 for standard 2:1 ellipsoidal
    //
    // t = PD/(2SE-0.2P) = 150×48/(2×20000×0.85-0.2×150)
    //   = 7200/(34000-30) = 7200/33970 = 0.21196"
    //
    // MAWP (at t_act = 0.375"):
    //   P = 2SEt/(D+0.2t) = 2×20000×0.85×0.375/(48+0.2×0.375)
    //   = 12750/(48+0.075) = 12750/48.075 = 265.23 psi
    
    it('should calculate t_min correctly', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const result = calculateEllipsoidalHead(inputs);
      const expected = (150 * 48) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'ellip t_min');
    });
    
    it('should calculate MAWP correctly at actual thickness', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, t_act: 0.375 };
      const result = calculateEllipsoidalHead(inputs);
      const expected = (2 * 20000 * 0.85 * 0.375) / (48 + 0.2 * 0.375);
      expectCloseTo(result.MAWP, expected, MAWP_TOL, 'ellip MAWP');
    });
    
    it('should be compliant when t_act > t_min', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, t_act: 0.375 };
      const result = calculateEllipsoidalHead(inputs);
      expect(result.isCompliant).toBe(true);
    });
  });
  
  describe('Torispherical Head - UG-32(e)', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85
    //   Using standard F&D: L ≈ Do ≈ 48.5" (D + 0.5"), r ≈ 0.06 × 48.5 = 2.91"
    //
    // M = 0.25 × (3 + sqrt(L/r)) = 0.25 × (3 + sqrt(48.5/2.91))
    //   = 0.25 × (3 + sqrt(16.667)) = 0.25 × (3 + 4.0825) = 0.25 × 7.0825 = 1.7706
    //
    // t = PLM/(2SE-0.2P) = 150×48.5×1.7706/(34000-30) = 12878.61/33970 = 0.37913"
    //
    // MAWP (at t_act = 0.500"):
    //   P = 2SEt/(LM+0.2t) = 2×20000×0.85×0.500/(48.5×1.7706+0.2×0.500)
    //   = 17000/(85.874+0.1) = 17000/85.974 = 197.73 psi
    
    it('should calculate t_min correctly with standard F&D defaults', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const result = calculateTorisphericalHead(inputs);
      
      // The engine uses Do_approx = D + 0.5 = 48.5
      const L = 48.5;
      const r = 0.06 * 48.5;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      const expected = (150 * L * M) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'toris t_min');
    });
    
    it('should calculate M factor correctly', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const result = calculateTorisphericalHead(inputs);
      const L = 48.5;
      const r = 0.06 * 48.5;
      const expected_M = 0.25 * (3 + Math.sqrt(L / r));
      expect(result.M).toBeDefined();
      expectCloseTo(result.M!, expected_M, THICKNESS_TOL, 'M factor');
    });
    
    it('should calculate t_min correctly with user-provided L and r', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, L: 48, r: 2.88 };
      const result = calculateTorisphericalHead(inputs);
      const M = 0.25 * (3 + Math.sqrt(48 / 2.88));
      const expected = (150 * 48 * M) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'toris t_min with user L,r');
    });
    
    it('should calculate MAWP correctly at actual thickness', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, L: 48, r: 2.88, t_act: 0.500 };
      const result = calculateTorisphericalHead(inputs);
      const M = 0.25 * (3 + Math.sqrt(48 / 2.88));
      const expected = (2 * 20000 * 0.85 * 0.500) / (48 * M + 0.2 * 0.500);
      expectCloseTo(result.MAWP, expected, MAWP_TOL, 'toris MAWP');
    });
  });
  
  describe('Flat Head - UG-34', () => {
    // Given:
    //   P = 15 psi, D = 24", S = 20,000 psi, E = 0.85, C = 0.33
    //
    // t = d × sqrt(CP/SE) = 24 × sqrt(0.33×15/(20000×0.85))
    //   = 24 × sqrt(4.95/17000) = 24 × sqrt(0.00029118) = 24 × 0.01706 = 0.40941"
    
    it('should calculate t_min correctly', () => {
      const inputs: CalculationInputs = { P: 15, S: 20000, E: 0.85, D: 24, d: 24, C: 0.33 };
      const result = calculateFlatHead(inputs);
      const expected = 24 * Math.sqrt((0.33 * 15) / (20000 * 0.85));
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'flat t_min');
    });
  });
  
  describe('Conical Section - UG-32(g)', () => {
    // Given:
    //   P = 150 psi, D = 48", S = 20,000 psi, E = 0.85, α = 15°
    //
    // cos(15°) = 0.96593
    // t = PD/(2cos(α)(SE-0.6P)) = 150×48/(2×0.96593×(20000×0.85-0.6×150))
    //   = 7200/(2×0.96593×16910) = 7200/(32667.35) = 0.22044"
    //
    // MAWP (at t_act = 0.375"):
    //   P = 2SEt×cos(α)/(D+1.2t×cos(α)) = 2×20000×0.85×0.375×0.96593/(48+1.2×0.375×0.96593)
    //   = 12337.44/(48+0.43467) = 12337.44/48.43467 = 254.73 psi
    
    it('should calculate t_min correctly', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, alpha: 15 };
      const result = calculateConicalSection(inputs);
      const cosAlpha = Math.cos(15 * Math.PI / 180);
      const expected = (150 * 48) / (2 * cosAlpha * (20000 * 0.85 - 0.6 * 150));
      expectCloseTo(result.t_min, expected, THICKNESS_TOL, 'cone t_min');
    });
    
    it('should calculate MAWP correctly at actual thickness', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, alpha: 15, t_act: 0.375 };
      const result = calculateConicalSection(inputs);
      const cosAlpha = Math.cos(15 * Math.PI / 180);
      const expected = (2 * 20000 * 0.85 * 0.375 * cosAlpha) / (48 + 1.2 * 0.375 * cosAlpha);
      expectCloseTo(result.MAWP, expected, MAWP_TOL, 'cone MAWP');
    });
    
    it('should warn when α > 30°', () => {
      const inputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, alpha: 35 };
      const result = calculateConicalSection(inputs);
      const criticalWarnings = result.warnings.filter(w => w.severity === 'critical');
      expect(criticalWarnings.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 5. HEAD CALCULATIONS - UG-32 (lockedCalculationEngine.ts)
// ============================================================================
describe('Head Calculations - ASME UG-32 (lockedCalculationEngine.ts)', () => {
  
  describe('2:1 Ellipsoidal Head t_required', () => {
    // t = PD/(2SE-0.2P) = 150×48/(2×20000×0.85-0.2×150)
    //   = 7200/33970 = 0.21196"
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      headType: '2:1 Ellipsoidal',
    };
    
    it('should calculate t_required correctly', () => {
      const result = calculateTRequiredEllipsoidalHead(input);
      expect(result.success).toBe(true);
      const expected = (150 * 48) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.resultValue!, expected, THICKNESS_TOL, 'ellip t_required');
    });
  });
  
  describe('2:1 Ellipsoidal Head MAWP', () => {
    // P = 2SEt/(D+0.2t) = 2×20000×0.85×0.375/(48+0.2×0.375)
    //   = 12750/48.075 = 265.23 psi
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      headType: '2:1 Ellipsoidal',
    };
    
    it('should calculate MAWP correctly', () => {
      const result = calculateMAWPEllipsoidalHead(input);
      expect(result.success).toBe(true);
      const expected = (2 * 20000 * 0.85 * 0.375) / (48 + 0.2 * 0.375);
      expectCloseTo(result.resultValue!, expected, MAWP_TOL, 'ellip MAWP');
    });
  });
  
  describe('Torispherical Head t_required', () => {
    // Given: P=150, D=48", S=20000, E=0.85, L=48", r=2.88"
    // M = 0.25×(3+sqrt(48/2.88)) = 0.25×(3+4.0825) = 1.7706
    // t = PLM/(2SE-0.2P) = 150×48×1.7706/33970 = 12748.32/33970 = 0.37530"
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.500,
      headType: 'Torispherical',
      crownRadius: 48,
      knuckleRadius: 2.88,
    };
    
    it('should calculate t_required correctly', () => {
      const result = calculateTRequiredTorisphericalHead(input);
      expect(result.success).toBe(true);
      const M = 0.25 * (3 + Math.sqrt(48 / 2.88));
      const expected = (150 * 48 * M) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.resultValue!, expected, THICKNESS_TOL, 'toris t_required');
    });
  });
  
  describe('Hemispherical Head t_required', () => {
    // t = PR/(2SE-0.2P) = 150×24/(2×20000×0.85-0.2×150)
    //   = 3600/33970 = 0.10598"
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      headType: 'Hemispherical',
    };
    
    it('should calculate t_required correctly', () => {
      const result = calculateTRequiredHemisphericalHead(input);
      expect(result.success).toBe(true);
      const expected = (150 * 24) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.resultValue!, expected, THICKNESS_TOL, 'hemi t_required');
    });
  });
  
  describe('Hemispherical Head MAWP', () => {
    // P = 2SEt/(R+0.2t) = 2×20000×0.85×0.375/(24+0.2×0.375)
    //   = 12750/24.075 = 529.59 psi
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      headType: 'Hemispherical',
    };
    
    it('should calculate MAWP correctly', () => {
      const result = calculateMAWPHemisphericalHead(input);
      expect(result.success).toBe(true);
      const expected = (2 * 20000 * 0.85 * 0.375) / (24 + 0.2 * 0.375);
      expectCloseTo(result.resultValue!, expected, MAWP_TOL, 'hemi MAWP');
    });
  });
  
  describe('Torispherical Head MAWP', () => {
    // Given: t=0.500", D=48", S=20000, E=0.85, L=48", r=2.88"
    // M = 0.25×(3+sqrt(48/2.88)) = 1.7706
    // P = 2SEt/(LM+0.2t) = 2×20000×0.85×0.500/(48×1.7706+0.2×0.500)
    //   = 17000/(84.989+0.1) = 17000/85.089 = 199.79 psi
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.625,
      currentThickness: 0.500,
      headType: 'Torispherical',
      crownRadius: 48,
      knuckleRadius: 2.88,
    };
    
    it('should calculate MAWP correctly', () => {
      const result = calculateMAWPTorisphericalHead(input);
      expect(result.success).toBe(true);
      const M = 0.25 * (3 + Math.sqrt(48 / 2.88));
      const expected = (2 * 20000 * 0.85 * 0.500) / (48 * M + 0.2 * 0.500);
      expectCloseTo(result.resultValue!, expected, MAWP_TOL, 'toris MAWP');
    });
  });
});

// ============================================================================
// 6. CORROSION RATE CALCULATIONS - API 510
// ============================================================================
describe('Corrosion Rate Calculations - API 510 (lockedCalculationEngine.ts)', () => {
  
  describe('Long-Term Corrosion Rate', () => {
    // CR_LT = (t_nominal - t_current) / Years_in_Service
    // = (0.500 - 0.375) / 25 = 0.125 / 25 = 0.005 in/yr
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      yearBuilt: 2001,
      currentYear: 2026,
    };
    
    it('should calculate LT corrosion rate correctly', () => {
      const result = calculateCorrosionRateLongTerm(input);
      expect(result.success).toBe(true);
      const expected = (0.500 - 0.375) / 25;
      expectCloseTo(result.resultValue!, expected, RATE_TOL, 'CR_LT');
    });
  });
  
  describe('Short-Term Corrosion Rate', () => {
    // CR_ST = (t_previous - t_current) / Years_between_inspections
    // = (0.400 - 0.375) / 5 = 0.025 / 5 = 0.005 in/yr
    
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      previousThickness: 0.400,
      previousInspectionDate: new Date('2021-01-15'),
      currentInspectionDate: new Date('2026-01-15'),
    };
    
    it('should calculate ST corrosion rate correctly', () => {
      const result = calculateCorrosionRateShortTerm(input);
      expect(result.success).toBe(true);
      // 5 years between dates (approximately, using 365.25 days/yr)
      const daysBetween = Math.abs(
        (new Date('2026-01-15').getTime() - new Date('2021-01-15').getTime()) / (1000 * 60 * 60 * 24)
      );
      const yearsBetween = daysBetween / 365.25;
      const expected = (0.400 - 0.375) / yearsBetween;
      expectCloseTo(result.resultValue!, expected, RATE_TOL, 'CR_ST');
    });
  });
  
  describe('Apparent Thickness Growth', () => {
    it('should return 0 for LT rate when thickness increased', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 0.85,
        nominalThickness: 0.375,
        currentThickness: 0.400, // Greater than nominal (repaired or measurement error)
        yearBuilt: 2001,
        currentYear: 2026,
      };
      const result = calculateCorrosionRateLongTerm(input);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0);
    });
  });
});

// ============================================================================
// 7. REMAINING LIFE CALCULATION - API 510 §7.1.1
// ============================================================================
describe('Remaining Life Calculation - API 510 §7.1.1', () => {
  
  describe('Standard Remaining Life', () => {
    // RL = (t_actual - t_required) / CR = (0.375 - 0.2129) / 0.005 = 0.1621 / 0.005 = 32.42 years
    
    it('should calculate remaining life correctly', () => {
      const t_actual = 0.375;
      const t_required = 0.2129;
      const cr = 0.005;
      const result = calculateRemainingLife(t_actual, t_required, cr, 'LT');
      expect(result.success).toBe(true);
      const expected = (t_actual - t_required) / cr;
      expectCloseTo(result.resultValue!, expected, LIFE_TOL, 'RL');
    });
  });
  
  describe('Critical Remaining Life (< 2 years)', () => {
    it('should flag critical when RL < 2 years', () => {
      const result = calculateRemainingLife(0.220, 0.213, 0.005, 'LT');
      expect(result.success).toBe(true);
      expect(result.resultValue!).toBeLessThan(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
  
  describe('Zero Remaining Life', () => {
    it('should return 0 when current thickness equals t_required', () => {
      const result = calculateRemainingLife(0.213, 0.213, 0.005, 'LT');
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0);
    });
  });
});

// ============================================================================
// 8. INSPECTION INTERVAL CALCULATIONS - API 510
// ============================================================================
describe('Inspection Interval Calculations - API 510', () => {
  
  describe('lockedCalculationEngine - calculateNextInspectionInterval', () => {
    
    it('should return RL/2 for standard case (RL > 4 years)', () => {
      const result = calculateNextInspectionInterval(20);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(10); // MIN(20/2, 10) = 10
    });
    
    it('should cap at 10 years maximum', () => {
      const result = calculateNextInspectionInterval(30);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(10);
    });
    
    it('should return 2 years when 2 ≤ RL ≤ 4', () => {
      const result = calculateNextInspectionInterval(3);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(2);
    });
    
    it('should return RL when RL < 2 years', () => {
      const result = calculateNextInspectionInterval(1.5);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(1.5);
    });
    
    it('should return 0 for exhausted remaining life', () => {
      const result = calculateNextInspectionInterval(0);
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0);
    });
  });
  
  describe('asmeCalculations - calculateInspectionIntervals', () => {
    
    it('should calculate internal interval = RL/2, max 10 years', () => {
      const result = calculateInspectionIntervals(20);
      expect(result.internalInterval).toBe(10);
    });
    
    it('should calculate external interval = RL/4, max 5 years', () => {
      const result = calculateInspectionIntervals(20);
      expect(result.externalInterval).toBe(5);
    });
    
    it('should calculate UT interval = RL/4, max 5 years', () => {
      const result = calculateInspectionIntervals(20);
      expect(result.utInterval).toBe(5);
    });
    
    it('should handle short remaining life correctly', () => {
      const result = calculateInspectionIntervals(6);
      expect(result.internalInterval).toBe(3); // 6/2 = 3
      expect(result.externalInterval).toBe(1.5); // 6/4 = 1.5
    });
  });
});

// ============================================================================
// 9. NOZZLE CALCULATIONS - UG-37 & UG-45
// ============================================================================
describe('Nozzle Calculations - ASME UG-37 & UG-45', () => {
  
  describe('UG-45 Nozzle Minimum Thickness', () => {
    // Given:
    //   2" NPS, Schedule 80 (STD)
    //   OD = 2.375", Wall = 0.218"
    //   Shell required thickness = 0.213"
    //   Manufacturing tolerance = 12.5%
    //
    // Pipe minus tolerance = 0.218 × 0.875 = 0.19075"
    // Governing = MAX(0.19075, 0.213) = 0.213" (shell/head governs)
    
    it('should calculate pipe minus tolerance correctly', () => {
      const result = calculateNozzleMinimumThickness({
        nozzleNumber: 'N1',
        nominalSize: '2',
        schedule: '80',
        pipeNominalThickness: 0.218,
        pipeOutsideDiameter: 2.375,
        shellHeadRequiredThickness: 0.213,
      });
      
      const expectedPipeMinus = 0.218 * 0.875;
      expectCloseTo(result.pipeMinusManufacturingTolerance, expectedPipeMinus, THICKNESS_TOL, 'pipe minus tolerance');
    });
    
    it('should identify correct governing criterion', () => {
      const result = calculateNozzleMinimumThickness({
        nozzleNumber: 'N1',
        nominalSize: '2',
        schedule: '80',
        pipeNominalThickness: 0.218,
        pipeOutsideDiameter: 2.375,
        shellHeadRequiredThickness: 0.213,
      });
      
      // 0.218 × 0.875 = 0.19075 < 0.213, so shell/head governs
      expect(result.governingCriterion).toBe('shell_head_required');
      expectCloseTo(result.minimumRequired, 0.213, THICKNESS_TOL, 'minimum required');
    });
    
    it('should identify pipe schedule as governing when it exceeds shell required', () => {
      const result = calculateNozzleMinimumThickness({
        nozzleNumber: 'N2',
        nominalSize: '6',
        schedule: '80',
        pipeNominalThickness: 0.432,
        pipeOutsideDiameter: 6.625,
        shellHeadRequiredThickness: 0.213,
      });
      
      // 0.432 × 0.875 = 0.378 > 0.213, so pipe schedule governs
      expect(result.governingCriterion).toBe('pipe_schedule');
      const expectedMin = 0.432 * 0.875;
      expectCloseTo(result.minimumRequired, expectedMin, THICKNESS_TOL, 'minimum required');
    });
    
    it('should assess actual thickness correctly', () => {
      const result = calculateNozzleMinimumThickness({
        nozzleNumber: 'N1',
        nominalSize: '2',
        schedule: '80',
        pipeNominalThickness: 0.218,
        pipeOutsideDiameter: 2.375,
        shellHeadRequiredThickness: 0.213,
        actualThickness: 0.200,
      });
      
      // t_act = 0.200 < t_min = 0.213 → NOT acceptable
      expect(result.acceptable).toBe(false);
    });
  });
  
  describe('UG-37 Reinforcement Area Calculation', () => {
    // Given:
    //   d = 4.026" (4" NPS STD pipe ID)
    //   t = 0.500" (shell nominal)
    //   tr = 0.213" (shell required)
    //   E1 = 0.85 (joint efficiency)
    //   tn = 0.237" (4" NPS STD wall)
    //   trn = 0.050" (nozzle required)
    //   No pad, no inward projection
    //
    // Required area: A = d × tr = 4.026 × 0.213 = 0.85754 sq in
    
    it('should calculate required reinforcement area correctly', () => {
      const result = calculateReinforcementArea({
        nozzleNumber: 'N1',
        d: 4.026,
        t: 0.500,
        tr: 0.213,
        E1: 0.85,
        tn: 0.237,
        trn: 0.050,
      });
      
      // A = d × tr × F = 4.026 × 0.213 × 1.0 = 0.85754 (when fr1 = 1.0)
      const expected_A = 4.026 * 0.213;
      expectCloseTo(result.A, expected_A, THICKNESS_TOL, 'Required area A');
    });
    
    it('should determine adequate reinforcement for thick shell', () => {
      const result = calculateReinforcementArea({
        nozzleNumber: 'N1',
        d: 4.026,
        t: 0.500,
        tr: 0.213,
        E1: 0.85,
        tn: 0.237,
        trn: 0.050,
      });
      
      // With a thick shell (0.500" vs 0.213" required), there should be ample reinforcement
      expect(result.adequate).toBe(true);
      expect(result.Aavail).toBeGreaterThan(result.A);
    });
  });
});

// ============================================================================
// 10. MAP AT NEXT INSPECTION
// ============================================================================
describe('MAP at Next Inspection - API 510', () => {
  
  describe('Shell MAP at Next Inspection', () => {
    // Given:
    //   t_actual = 0.375", CR = 0.005 in/yr, Yn = 5 years
    //   D = 48" (R = 24"), S = 20,000 psi, E = 0.85
    //
    // Projected thickness = t_actual - 2 × Yn × CR = 0.375 - 2×5×0.005 = 0.375 - 0.05 = 0.325"
    // MAP = SEt/(R+0.6t) = 20000×0.85×0.325/(24+0.6×0.325) = 5525/24.195 = 228.35 psi
    
    it('should calculate projected thickness correctly', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        allowableStress: 20000,
        jointEfficiency: 0.85,
        nominalThickness: 0.500,
        currentThickness: 0.375,
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      expect(result.success).toBe(true);
      
      const expectedProjected = 0.375 - 2 * 5 * 0.005;
      expectCloseTo(result.projectedThickness, expectedProjected, THICKNESS_TOL, 'projected thickness');
    });
    
    it('should calculate MAP at projected thickness correctly', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        allowableStress: 20000,
        jointEfficiency: 0.85,
        nominalThickness: 0.500,
        currentThickness: 0.375,
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      expect(result.success).toBe(true);
      
      const projectedT = 0.375 - 2 * 5 * 0.005;
      const expectedMAP = (20000 * 0.85 * projectedT) / (24 + 0.6 * projectedT);
      expectCloseTo(result.mapAtNextInspection, expectedMAP, MAWP_TOL, 'MAP at next inspection');
    });
  });
});

// ============================================================================
// 11. FULL CALCULATION SUITE (lockedCalculationEngine.ts)
// ============================================================================
describe('Full Calculation Suite - performFullCalculation', () => {
  
  describe('Shell Full Calculation', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      yearBuilt: 2001,
      currentYear: 2026,
      previousThickness: 0.400,
      previousInspectionDate: new Date('2021-01-15'),
      currentInspectionDate: new Date('2026-01-15'),
    };
    
    it('should produce successful results', () => {
      const result = performFullCalculation(input, 'Shell');
      expect(result.success).toBe(true);
    });
    
    it('should calculate t_required correctly', () => {
      const result = performFullCalculation(input, 'Shell');
      const expected = (150 * 24) / (20000 * 0.85 - 0.6 * 150);
      expectCloseTo(result.tRequired.resultValue!, expected, THICKNESS_TOL, 'full calc t_required');
    });
    
    it('should calculate MAWP correctly', () => {
      const result = performFullCalculation(input, 'Shell');
      const expected = (20000 * 0.85 * 0.375) / (24 + 0.6 * 0.375);
      expectCloseTo(result.mawp.resultValue!, expected, MAWP_TOL, 'full calc MAWP');
    });
    
    it('should calculate both corrosion rates', () => {
      const result = performFullCalculation(input, 'Shell');
      expect(result.corrosionRateLT).toBeDefined();
      expect(result.corrosionRateLT!.success).toBe(true);
      expect(result.corrosionRateST).toBeDefined();
      expect(result.corrosionRateST!.success).toBe(true);
    });
    
    it('should calculate remaining life', () => {
      const result = performFullCalculation(input, 'Shell');
      expect(result.remainingLife).toBeDefined();
      expect(result.remainingLife!.success).toBe(true);
      expect(result.remainingLife!.resultValue).toBeGreaterThan(0);
    });
    
    it('should use governing (maximum) corrosion rate', () => {
      const result = performFullCalculation(input, 'Shell');
      const ltRate = result.corrosionRateLT?.resultValue || 0;
      const stRate = result.corrosionRateST?.resultValue || 0;
      const governingRate = Math.max(ltRate, stRate);
      expect(result.summary.corrosionRate).toBe(governingRate);
    });
    
    it('should determine acceptable status', () => {
      const result = performFullCalculation(input, 'Shell');
      expect(result.summary.status).toBe('acceptable');
    });
  });
  
  describe('Head Full Calculation', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 500,
      materialSpec: 'SA-516 Gr 70',
      allowableStress: 20000,
      jointEfficiency: 0.85,
      nominalThickness: 0.500,
      currentThickness: 0.375,
      yearBuilt: 2001,
      currentYear: 2026,
      headType: '2:1 Ellipsoidal',
    };
    
    it('should produce successful results for ellipsoidal head', () => {
      const result = performFullCalculation(input, 'Head');
      expect(result.success).toBe(true);
      expect(result.componentType).toBe('Head');
    });
    
    it('should calculate t_required for ellipsoidal head correctly', () => {
      const result = performFullCalculation(input, 'Head');
      const expected = (150 * 48) / (2 * 20000 * 0.85 - 0.2 * 150);
      expectCloseTo(result.tRequired.resultValue!, expected, THICKNESS_TOL, 'head t_required');
    });
  });
});

// ============================================================================
// 12. PIPE SCHEDULE DATABASE VERIFICATION
// ============================================================================
describe('Pipe Schedule Database - ASME B36.10M', () => {
  
  it('should return correct dimensions for 2" NPS Schedule 80', () => {
    const result = getPipeSchedule('2', '80');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.outsideDiameter).toBe(2.375);
      expect(result.wallThickness).toBe(0.218);
    }
  });
  
  it('should return correct dimensions for 6" NPS Schedule STD', () => {
    const result = getPipeSchedule('6', 'STD');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.outsideDiameter).toBe(6.625);
      expect(result.wallThickness).toBe(0.280);
    }
  });
  
  it('should return correct dimensions for 12" NPS Schedule 40', () => {
    const result = getPipeSchedule('12', '40');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.outsideDiameter).toBe(12.750);
      expect(result.wallThickness).toBe(0.406);
    }
  });
  
  it('should return correct dimensions for 24" NPS Schedule STD', () => {
    const result = getPipeSchedule('24', 'STD');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.outsideDiameter).toBe(24.000);
      expect(result.wallThickness).toBe(0.375);
    }
  });
  
  it('should return null for invalid pipe size', () => {
    const result = getPipeSchedule('99', 'STD');
    expect(result).toBeNull();
  });
});

// ============================================================================
// 13. CROSS-ENGINE CONSISTENCY CHECKS
// ============================================================================
describe('Cross-Engine Consistency', () => {
  
  describe('Shell t_required: asmeCalculations vs lockedCalculationEngine', () => {
    it('should produce identical t_min values for same inputs', () => {
      const asmeInputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const lockedInput: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        allowableStress: 20000,
        jointEfficiency: 0.85,
        nominalThickness: 0.500,
        currentThickness: 0.375,
      };
      
      const asmeResult = calculateShellThickness(asmeInputs);
      const lockedResult = calculateTRequiredShell(lockedInput);
      
      expect(lockedResult.success).toBe(true);
      expectCloseTo(asmeResult.t_min, lockedResult.resultValue!, 0.001, 'cross-engine t_min');
    });
  });
  
  describe('Shell MAWP: asmeCalculations vs lockedCalculationEngine', () => {
    it('should produce identical MAWP values for same inputs', () => {
      const asmeInputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48, t_act: 0.375 };
      const lockedInput: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        allowableStress: 20000,
        jointEfficiency: 0.85,
        nominalThickness: 0.500,
        currentThickness: 0.375,
      };
      
      const asmeResult = calculateShellThickness(asmeInputs);
      const lockedResult = calculateMAWPShell(lockedInput);
      
      expect(lockedResult.success).toBe(true);
      // asmeCalculations MAWP is MIN(circ, long), lockedEngine uses only circ formula
      // Both should match on the circumferential MAWP
      expectCloseTo(asmeResult.MAWP_circ!, lockedResult.resultValue!, 0.001, 'cross-engine MAWP_circ');
    });
  });
  
  describe('Ellipsoidal Head: asmeCalculations vs lockedCalculationEngine', () => {
    it('should produce identical t_min values', () => {
      const asmeInputs: CalculationInputs = { P: 150, S: 20000, E: 0.85, D: 48 };
      const lockedInput: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: 'SA-516 Gr 70',
        allowableStress: 20000,
        jointEfficiency: 0.85,
        nominalThickness: 0.500,
        currentThickness: 0.375,
        headType: '2:1 Ellipsoidal',
      };
      
      const asmeResult = calculateEllipsoidalHead(asmeInputs);
      const lockedResult = calculateTRequiredEllipsoidalHead(lockedInput);
      
      expect(lockedResult.success).toBe(true);
      expectCloseTo(asmeResult.t_min, lockedResult.resultValue!, 0.001, 'cross-engine ellip t_min');
    });
  });
});

// ============================================================================
// 14. EDGE CASES AND BOUNDARY CONDITIONS
// ============================================================================
describe('Edge Cases and Boundary Conditions', () => {
  
  describe('Invalid Inputs', () => {
    it('should throw for zero pressure', () => {
      expect(() => calculateShellThickness({ P: 0, S: 20000, E: 0.85, D: 48 }))
        .toThrow();
    });
    
    it('should throw for zero stress', () => {
      expect(() => calculateShellThickness({ P: 150, S: 0, E: 0.85, D: 48 }))
        .toThrow();
    });
    
    it('should throw for joint efficiency > 1', () => {
      expect(() => calculateShellThickness({ P: 150, S: 20000, E: 1.5, D: 48 }))
        .toThrow();
    });
    
    it('should throw for zero diameter', () => {
      expect(() => calculateShellThickness({ P: 150, S: 20000, E: 0.85, D: 0 }))
        .toThrow();
    });
  });
  
  describe('Non-compliant Vessel', () => {
    it('should flag non-compliance when t_act < t_min', () => {
      const inputs: CalculationInputs = {
        P: 150, S: 20000, E: 0.85, D: 48,
        t_act: 0.100 // Below t_min of ~0.213"
      };
      const result = calculateShellThickness(inputs);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings.some(w => w.severity === 'critical')).toBe(true);
    });
  });
  
  describe('Remaining Life Error Cases (lockedCalculationEngine)', () => {
    it('should return error for zero corrosion rate', () => {
      const result = calculateRemainingLife(0.375, 0.213, 0, 'LT');
      expect(result.success).toBe(false);
    });
    
    it('should return error for negative corrosion rate', () => {
      const result = calculateRemainingLife(0.375, 0.213, -0.005, 'LT');
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// 15. FORMULA CONSISTENCY VERIFICATION
// ============================================================================
describe('Formula Consistency Verification', () => {
  
  describe('t_required and MAWP are inverse operations', () => {
    // If t = PR/(SE-0.6P), then P = SEt/(R+0.6t)
    // Plugging t_min back into MAWP formula should return original P
    
    it('Shell: MAWP at t_min should equal design pressure', () => {
      const P = 150, S = 20000, E = 0.85, D = 48;
      const R = D / 2;
      const t_min = (P * R) / (S * E - 0.6 * P);
      const MAWP = (S * E * t_min) / (R + 0.6 * t_min);
      expectCloseTo(MAWP, P, 0.001, 'Shell inverse check');
    });
    
    it('Hemispherical: MAWP at t_min should equal design pressure', () => {
      const P = 150, S = 20000, E = 0.85, D = 48;
      const L = D / 2;
      const t_min = (P * L) / (2 * S * E - 0.2 * P);
      const MAWP = (2 * S * E * t_min) / (L + 0.2 * t_min);
      expectCloseTo(MAWP, P, 0.001, 'Hemi inverse check');
    });
    
    it('Ellipsoidal: MAWP at t_min should equal design pressure', () => {
      const P = 150, S = 20000, E = 0.85, D = 48;
      const t_min = (P * D) / (2 * S * E - 0.2 * P);
      const MAWP = (2 * S * E * t_min) / (D + 0.2 * t_min);
      expectCloseTo(MAWP, P, 0.001, 'Ellip inverse check');
    });
    
    it('Torispherical: MAWP at t_min should equal design pressure', () => {
      const P = 150, S = 20000, E = 0.85;
      const L = 48, r = 2.88;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      const t_min = (P * L * M) / (2 * S * E - 0.2 * P);
      const MAWP = (2 * S * E * t_min) / (L * M + 0.2 * t_min);
      expectCloseTo(MAWP, P, 0.001, 'Toris inverse check');
    });
    
    it('Conical: MAWP at t_min should equal design pressure', () => {
      const P = 150, S = 20000, E = 0.85, D = 48;
      const alpha = 15 * Math.PI / 180;
      const cosA = Math.cos(alpha);
      const t_min = (P * D) / (2 * cosA * (S * E - 0.6 * P));
      const MAWP = (2 * S * E * t_min * cosA) / (D + 1.2 * t_min * cosA);
      expectCloseTo(MAWP, P, 0.001, 'Cone inverse check');
    });
  });
});

// ============================================================================
// EXTENDED MATERIAL DATABASE VERIFICATION - SA-387 (Cr-Mo) & SA-204 (C-½Mo)
// Per ASME Section II Part D, Table 1A, 2021 Edition
// ============================================================================
describe('Extended Material Database - SA-387 Cr-Mo Alloys', () => {

  describe('SA-387 Gr 11 Cl 1 (1¼Cr-½Mo-Si) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 24 (Plate, K11789, Class 1)
    // Min Tensile: 60 ksi, Min Yield: 35 ksi, Max Temp: 1200°F

    it('should return 17,100 psi at 100°F (exact table value)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17100);
    });

    it('should return 17,100 psi at 500°F (stress plateau)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17100);
    });

    it('should return 17,100 psi at 750°F (still in plateau)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 750);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17100);
    });

    it('should return 16,800 psi at 800°F (stress begins to decrease)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(16800);
    });

    it('should return 16,400 psi at 850°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(16400);
    });

    it('should return 13,700 psi at 900°F (creep range begins)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13700);
    });

    it('should return 9,300 psi at 950°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 950);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(9300);
    });

    it('should return 6,300 psi at 1000°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(6300);
    });

    it('should return 1,200 psi at 1200°F (max temperature)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 1200);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(1200);
    });

    it('should interpolate correctly at 825°F', () => {
      // Between 800°F (16,800) and 850°F (16,400)
      // Linear: 16800 + (16400-16800) * (825-800)/(850-800) = 16800 + (-400)*0.5 = 16600
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 825);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(16600);
    });

    it('should return error above 1200°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 1', 1250);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });
  });

  describe('SA-387 Gr 11 Cl 2 (1¼Cr-½Mo-Si, Higher Strength) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 30 (Plate, K11789, Class 2)
    // Min Tensile: 75 ksi, Min Yield: 45 ksi, Max Temp: 1200°F

    it('should return 21,400 psi at 100°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 2', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(21400);
    });

    it('should return 21,400 psi at 800°F (extended plateau vs Class 1)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 2', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(21400);
    });

    it('should return 20,200 psi at 850°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 2', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20200);
    });

    it('should return 13,700 psi at 900°F (converges with Class 1 in creep)', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 2', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13700);
    });

    it('should return 1,200 psi at 1200°F', () => {
      const result = getAllowableStress('SA-387 Gr 11 Cl 2', 1200);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(1200);
    });
  });

  describe('SA-387 Gr 22 Cl 1 (2¼Cr-1Mo) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 36 (Plate, K21590, Class 1)
    // Min Tensile: 60 ksi, Min Yield: 30 ksi, Max Temp: 1200°F

    it('should return 17,100 psi at 100°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17100);
    });

    it('should return 16,600 psi at 300°F (stress drops earlier than Gr 11)', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 300);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(16600);
    });

    it('should return 16,600 psi at 850°F (extended high-temp plateau)', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(16600);
    });

    it('should return 13,600 psi at 900°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13600);
    });

    it('should return 10,800 psi at 950°F (better creep resistance than Gr 11)', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 950);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(10800);
    });

    it('should return 8,000 psi at 1000°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(8000);
    });

    it('should return 1,400 psi at 1200°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 1200);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(1400);
    });

    it('should interpolate correctly at 925°F', () => {
      // Between 900°F (13,600) and 950°F (10,800)
      // Linear: 13600 + (10800-13600) * (925-900)/(950-900) = 13600 + (-2800)*0.5 = 12200
      const result = getAllowableStress('SA-387 Gr 22 Cl 1', 925);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(12200);
    });
  });

  describe('SA-387 Gr 22 Cl 2 (2¼Cr-1Mo, Higher Strength) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 12 (Plate, K21590, Class 2)
    // Min Tensile: 75 ksi, Min Yield: 45 ksi, Max Temp: 1200°F

    it('should return 21,400 psi at 100°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(21400);
    });

    it('should return 20,900 psi at 300°F (stress decreases earlier than Gr 11 Cl 2)', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 300);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20900);
    });

    it('should return 20,500 psi at 500°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20500);
    });

    it('should return 20,000 psi at 700°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 700);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });

    it('should return 19,300 psi at 800°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(19300);
    });

    it('should return 18,700 psi at 850°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(18700);
    });

    it('should return 15,800 psi at 900°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(15800);
    });

    it('should return 11,400 psi at 950°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 950);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(11400);
    });

    it('should return 7,800 psi at 1000°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(7800);
    });

    it('should return 1,200 psi at 1200°F', () => {
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 1200);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(1200);
    });

    it('should interpolate correctly at 975°F', () => {
      // Between 950°F (11,400) and 1000°F (7,800)
      // Linear: 11400 + (7800-11400) * (975-950)/(1000-950) = 11400 + (-3600)*0.5 = 9600
      const result = getAllowableStress('SA-387 Gr 22 Cl 2', 975);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(9600);
    });
  });
});

describe('Extended Material Database - SA-204 C-½Mo Alloys', () => {

  describe('SA-204 Gr A (C-½Mo) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 25 (Plate, K11820)
    // Min Tensile: 65 ksi, Min Yield: 37 ksi, Max Temp: 1000°F

    it('should return 18,600 psi at 100°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(18600);
    });

    it('should return 18,600 psi at 700°F (extended plateau)', () => {
      const result = getAllowableStress('SA-204 Gr A', 700);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(18600);
    });

    it('should return 18,400 psi at 800°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(18400);
    });

    it('should return 17,900 psi at 850°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17900);
    });

    it('should return 13,700 psi at 900°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13700);
    });

    it('should return 8,200 psi at 950°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 950);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(8200);
    });

    it('should return 4,800 psi at 1000°F (max temperature)', () => {
      const result = getAllowableStress('SA-204 Gr A', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(4800);
    });

    it('should return error above 1000°F', () => {
      const result = getAllowableStress('SA-204 Gr A', 1050);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });
  });

  describe('SA-204 Gr B (C-½Mo, Higher Strength) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 30 (Plate, K12020)
    // Min Tensile: 70 ksi, Min Yield: 40 ksi, Max Temp: 1000°F

    it('should return 20,000 psi at 100°F', () => {
      const result = getAllowableStress('SA-204 Gr B', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });

    it('should return 20,000 psi at 750°F (extended plateau)', () => {
      const result = getAllowableStress('SA-204 Gr B', 750);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });

    it('should return 19,900 psi at 800°F', () => {
      const result = getAllowableStress('SA-204 Gr B', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(19900);
    });

    it('should return 19,300 psi at 850°F', () => {
      const result = getAllowableStress('SA-204 Gr B', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(19300);
    });

    it('should return 13,700 psi at 900°F (converges with Gr A in creep)', () => {
      const result = getAllowableStress('SA-204 Gr B', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13700);
    });

    it('should return 4,800 psi at 1000°F', () => {
      const result = getAllowableStress('SA-204 Gr B', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(4800);
    });

    it('should interpolate correctly at 875°F', () => {
      // Between 850°F (19,300) and 900°F (13,700)
      // Linear: 19300 + (13700-19300) * (875-850)/(900-850) = 19300 + (-5600)*0.5 = 16500
      const result = getAllowableStress('SA-204 Gr B', 875);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(16500);
    });
  });

  describe('SA-204 Gr C (C-½Mo, Highest Strength) Allowable Stress Values', () => {
    // ASME Section II Part D, Table 1A, Line 35 (Plate, K12320)
    // Min Tensile: 75 ksi, Min Yield: 43 ksi, Max Temp: 1000°F

    it('should return 21,400 psi at 100°F', () => {
      const result = getAllowableStress('SA-204 Gr C', 100);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(21400);
    });

    it('should return 21,400 psi at 800°F (extended plateau)', () => {
      const result = getAllowableStress('SA-204 Gr C', 800);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(21400);
    });

    it('should return 20,700 psi at 850°F', () => {
      const result = getAllowableStress('SA-204 Gr C', 850);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20700);
    });

    it('should return 13,700 psi at 900°F (converges with Gr A & B in creep)', () => {
      const result = getAllowableStress('SA-204 Gr C', 900);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(13700);
    });

    it('should return 4,800 psi at 1000°F', () => {
      const result = getAllowableStress('SA-204 Gr C', 1000);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(4800);
    });
  });
});

describe('Extended Material Normalization - SA-387 & SA-204', () => {

  it('should normalize "SA-387 Grade 11 Class 1" to "SA-387 Gr 11 Cl 1"', () => {
    const result = normalizeMaterialSpec('SA-387 Grade 11 Class 1');
    expect(result).toBe('SA-387 Gr 11 Cl 1');
  });

  it('should normalize "sa-387 gr 22 cl 2" (lowercase) to "SA-387 Gr 22 Cl 2"', () => {
    const result = normalizeMaterialSpec('sa-387 gr 22 cl 2');
    expect(result).toBe('SA-387 Gr 22 Cl 2');
  });

  it('should normalize "SA-204 Grade B" to "SA-204 Gr B"', () => {
    const result = normalizeMaterialSpec('SA-204 Grade B');
    expect(result).toBe('SA-204 Gr B');
  });

  it('should normalize "SA-204 GRADE C" to "SA-204 Gr C"', () => {
    const result = normalizeMaterialSpec('SA-204 GRADE C');
    expect(result).toBe('SA-204 Gr C');
  });

  it('should handle getAllowableStressNormalized for SA-387 Grade 22 Class 1', () => {
    const result = getAllowableStressNormalized('SA-387 Grade 22 Class 1', 900);
    expect(result.status).toBe('ok');
    expect(result.stress).toBe(13600);
    expect(result.normalizedSpec).toBe('SA-387 Gr 22 Cl 1');
  });
});

describe('Material Properties - SA-387 & SA-204', () => {
  it('SA-387 Gr 11 Cl 1 properties should match ASME data', () => {
    const props = getMaterialProperties('SA-387 Gr 11 Cl 1');
    expect(props).not.toBeNull();
    expect(props!.specNumber).toBe('SA-387');
    expect(props!.grade).toBe('11 Class 1');
    expect(props!.productForm).toBe('Plate');
    expect(props!.minTensileStrength).toBe(60000);
    expect(props!.minYieldStrength).toBe(35000);
    expect(props!.maxTemperature).toBe(1200);
  });

  it('SA-387 Gr 22 Cl 2 properties should match ASME data', () => {
    const props = getMaterialProperties('SA-387 Gr 22 Cl 2');
    expect(props).not.toBeNull();
    expect(props!.specNumber).toBe('SA-387');
    expect(props!.grade).toBe('22 Class 2');
    expect(props!.productForm).toBe('Plate');
    expect(props!.minTensileStrength).toBe(75000);
    expect(props!.minYieldStrength).toBe(45000);
    expect(props!.maxTemperature).toBe(1200);
  });

  it('SA-204 Gr B properties should match ASME data', () => {
    const props = getMaterialProperties('SA-204 Gr B');
    expect(props).not.toBeNull();
    expect(props!.specNumber).toBe('SA-204');
    expect(props!.grade).toBe('B');
    expect(props!.productForm).toBe('Plate');
    expect(props!.minTensileStrength).toBe(70000);
    expect(props!.minYieldStrength).toBe(40000);
    expect(props!.maxTemperature).toBe(1000);
  });

  it('SA-204 Gr C properties should match ASME data', () => {
    const props = getMaterialProperties('SA-204 Gr C');
    expect(props).not.toBeNull();
    expect(props!.specNumber).toBe('SA-204');
    expect(props!.grade).toBe('C');
    expect(props!.productForm).toBe('Plate');
    expect(props!.minTensileStrength).toBe(75000);
    expect(props!.minYieldStrength).toBe(43000);
    expect(props!.maxTemperature).toBe(1000);
  });
});

describe('Cr-Mo Material Calculation Integration Tests', () => {
  // Verify that the new materials work correctly through the full calculation pipeline

  it('should calculate shell t_min for SA-387 Gr 22 Cl 1 at 650°F', () => {
    // P=200 psi, R=24 in (D=48), S=16600 psi, E=1.0
    // t_min = PR / (SE - 0.6P) = 200*24 / (16600*1.0 - 0.6*200) = 4800 / 16480 = 0.2913 in
    const R = 24;
    const t_expected = (200 * R) / (16600 * 1.0 - 0.6 * 200);
    const result = calculateShellThickness({
      P: 200,
      S: 16600,
      E: 1.0,
      D: 48,
    });
    expectCloseTo(result.t_min, t_expected, THICKNESS_TOL, 'SA-387 Gr 22 Cl 1 shell t_min');
  });

  it('should calculate shell t_min for SA-204 Gr B at 850°F', () => {
    // P=150 psi, R=30 in (D=60), S=19300 psi, E=0.85
    // t_min = PR / (SE - 0.6P) = 150*30 / (19300*0.85 - 0.6*150) = 4500 / 16315 = 0.2758 in
    const R = 30;
    const t_expected = (150 * R) / (19300 * 0.85 - 0.6 * 150);
    const result = calculateShellThickness({
      P: 150,
      S: 19300,
      E: 0.85,
      D: 60,
    });
    expectCloseTo(result.t_min, t_expected, THICKNESS_TOL, 'SA-204 Gr B shell t_min');
  });

  it('should calculate MAWP for SA-387 Gr 11 Cl 1 vessel at 900°F', () => {
    // t=0.5 in, R=18 in (D=36), S=13700 psi, E=1.0
    // MAWP = SEt / (R + 0.6t) = 13700*1.0*0.5 / (18 + 0.6*0.5) = 6850 / 18.3 = 374.3 psi
    const MAWP_expected = (13700 * 1.0 * 0.5) / (18 + 0.6 * 0.5);
    const result = calculateMAWPShell({
      insideDiameter: 36,
      designPressure: 200,
      designTemperature: 900,
      materialSpec: 'SA-387 Gr 11 Cl 1',
      allowableStress: 13700,
      jointEfficiency: 1.0,
      nominalThickness: 0.625,
      currentThickness: 0.5,
    });
    expect(result.success).toBe(true);
    expectCloseTo(result.resultValue!, MAWP_expected, MAWP_TOL, 'SA-387 Gr 11 Cl 1 MAWP at 900°F');
  });

  it('should verify Gr 22 has better high-temp creep resistance than Gr 11', () => {
    // At 1000°F: Gr 22 Cl 1 = 8000 psi vs Gr 11 Cl 1 = 6300 psi
    const gr22 = getAllowableStress('SA-387 Gr 22 Cl 1', 1000);
    const gr11 = getAllowableStress('SA-387 Gr 11 Cl 1', 1000);
    expect(gr22.stress).toBeGreaterThan(gr11.stress!);
    expect(gr22.stress).toBe(8000);
    expect(gr11.stress).toBe(6300);
  });

  it('should verify SA-204 grades converge at creep temperatures', () => {
    // At 900°F all SA-204 grades converge to 13,700 psi (creep-governed)
    const grA = getAllowableStress('SA-204 Gr A', 900);
    const grB = getAllowableStress('SA-204 Gr B', 900);
    const grC = getAllowableStress('SA-204 Gr C', 900);
    expect(grA.stress).toBe(13700);
    expect(grB.stress).toBe(13700);
    expect(grC.stress).toBe(13700);
  });

  it('should verify total material count is now 19', () => {
    const materials = listAvailableMaterials();
    expect(materials.length).toBe(19); // 12 original + 4 SA-387 + 3 SA-204
  });
});
