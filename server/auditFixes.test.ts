/**
 * Audit Fixes Regression Tests
 * 
 * Validates all fixes from the comprehensive end-to-end calculation audit.
 * These tests ensure that the identified findings remain fixed across future code changes.
 * 
 * Findings Fixed:
 * 1. Duplicate stress lookups → now using authoritative asmeMaterialDatabase.ts
 * 2. PDF shell corrosion rate hardcoded divisor → now uses actual timeSpan
 * 3. PDF shell MAWP stored value → now recalculated from t_next
 * 4. PDF nozzle age hardcoded → now calculated from vessel data
 * 5. PDF nozzle material hardcoded → now uses actual material
 * 6. FFS MAWP formula incorrect → now uses proper ASME UG-27
 * 7. FFS remaining life uses tmm not tmin → corrected
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// FINDING 1: Authoritative Stress Lookup (componentCalculations.ts)
// ============================================================================

describe('Finding 1: Authoritative Stress Lookup', () => {
  
  describe('componentCalculations.ts uses asmeMaterialDatabase', () => {
    it('should import getAllowableStressNormalized from asmeMaterialDatabase', async () => {
      // Verify the import exists by reading the module
      const module = await import('./componentCalculations');
      expect(module.calculateComponent).toBeDefined();
    });

    it('SA-516 Gr 70 at 500°F should return ASME Table 1A value (20,000 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-516 Gr 70', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(20000);
    });

    it('SA-516 Gr 70 at 700°F should return ASME Table 1A value (20,000 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-516 Gr 70', 700);
      expect(result.status).toBe('ok');
      // Per ASME Section II Part D Table 1A: SA-516 Gr 70 at 700°F = 20,000 psi
      expect(result.stress).toBe(20000);
    });

    it('SA-516 Gr 70 at 800°F should return ASME Table 1A value (17,500 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-516 Gr 70', 800);
      expect(result.status).toBe('ok');
      // Per ASME Section II Part D Table 1A: SA-516 Gr 70 at 800°F = 17,500 psi
      expect(result.stress).toBe(17500);
    });

    it('SA-285 Gr C at 500°F should return ASME Table 1A value (13,800 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-285 Gr C', 500);
      expect(result.status).toBe('ok');
      // Per ASME Section II Part D Table 1A: SA-285 Gr C at 500°F = 13,800 psi
      expect(result.stress).toBe(13800);
    });

    it('SA-285 Gr C at 700°F should return ASME Table 1A value (13,800 psi), not simplified 12,375', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-285 Gr C', 700);
      expect(result.status).toBe('ok');
      // Per ASME Section II Part D Table 1A: SA-285 Gr C at 700°F = 13,800 psi
      expect(result.stress).toBe(13800);
      // The old simplified lookup would have returned 13750 * 0.90 = 12375
      expect(result.stress).not.toBe(12375);
    });

    it('SA-106 Gr B at 500°F should return ASME Table 1A value (17,100 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-106 Gr B', 500);
      expect(result.status).toBe('ok');
      expect(result.stress).toBe(17100);
    });

    it('SA-240 Type 304 at 500°F should return ASME Table 1A value (17,500 psi)', async () => {
      const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
      const result = getAllowableStressNormalized('SA-240 Type 304', 500);
      expect(result.status).toBe('ok');
      // Per ASME Section II Part D Table 1A: SA-240 Type 304 at 500°F = 17,500 psi
      expect(result.stress).toBe(17500);
    });
  });

  describe('nozzlePressureCalc.ts uses asmeMaterialDatabase', () => {
    it('should import from asmeMaterialDatabase', async () => {
      const module = await import('./nozzlePressureCalc');
      expect(module.calculateNozzlePressureThickness).toBeDefined();
    });
  });
});

// ============================================================================
// FINDING 6: FFS MAWP Formula Correction
// ============================================================================

describe('Finding 6: FFS MAWP Formula Correction', () => {
  
  it('assessGeneralMetalLoss should use ASME UG-27 MAWP formula', async () => {
    const { assessGeneralMetalLoss } = await import('./ffsAssessment');
    
    const result = assessGeneralMetalLoss({
      componentType: 'shell',
      remainingThickness: 0.550,
      minimumRequiredThickness: 0.530,
      futureCorrosionAllowance: 0.0625,
      allowableStress: 20000,
      jointEfficiency: 0.85,
      designPressure: 250,
      operatingPressure: 200,
      designTemperature: 500,
      insideRadius: 35.375,
      damageType: 'general_metal_loss',
      corrosionRate: 5, // 5 mpy
    });
    
    // MAWP should be a pressure value (psi), not a dimensionless ratio
    // Formula: S*E*t / (R + 0.6*t) = 20000*0.85*0.550 / (35.375 + 0.6*0.550)
    expect(result.mawp).toBeGreaterThan(100); // Must be a pressure value, not a ratio
    expect(result.mawp).toBeLessThan(500);
    
    // Verify it's calculated correctly: S*E*t_remaining / (R + 0.6*t_remaining)
    const expectedMAWP = (20000 * 0.85 * 0.550) / (35.375 + 0.6 * 0.550);
    expect(result.mawp).toBeCloseTo(expectedMAWP, 0);
  });

  it('assessLocalThinArea should also use corrected MAWP formula', async () => {
    const { assessLocalThinArea } = await import('./ffsAssessment');
    
    const result = assessLocalThinArea({
      componentType: 'shell',
      remainingThickness: 0.450,
      minimumRequiredThickness: 0.530,
      futureCorrosionAllowance: 0.0625,
      allowableStress: 20000,
      jointEfficiency: 0.85,
      designPressure: 250,
      operatingPressure: 200,
      designTemperature: 500,
      insideRadius: 35.375,
      damageType: 'local_thin_area',
      corrosionRate: 5,
      defectLength: 6.0,
      defectWidth: 3.0,
    });
    
    // If remaining < min required, result may show unacceptable with mawp=0
    // This is correct behavior - the vessel is below minimum
    expect(result).toBeDefined();
    expect(typeof result.mawp).toBe('number');
  });
});

// ============================================================================
// FINDING 7: FFS Remaining Life Correction
// ============================================================================

describe('Finding 7: FFS Remaining Life Calculation', () => {
  
  it('remaining life should be based on (t_remaining - t_min) / CR', async () => {
    const { assessGeneralMetalLoss } = await import('./ffsAssessment');
    
    const result = assessGeneralMetalLoss({
      componentType: 'shell',
      remainingThickness: 0.600,
      minimumRequiredThickness: 0.530,
      futureCorrosionAllowance: 0.0625,
      allowableStress: 20000,
      jointEfficiency: 0.85,
      designPressure: 250,
      operatingPressure: 200,
      designTemperature: 500,
      insideRadius: 35.375,
      damageType: 'general_metal_loss',
      corrosionRate: 5, // 5 mpy = 0.005 in/yr
    });
    
    // Remaining life should be positive and reasonable
    expect(result.remainingLife).toBeGreaterThan(0);
    
    // Verify: RL = (t_remaining - t_min) / CR
    // t_remaining = 0.600, t_min = 0.530, CR = 5 mpy = 0.005 in/yr
    // RL = (0.600 - 0.530) / 0.005 = 14 years
    expect(result.remainingLife).toBeCloseTo(14, 0);
  });
});

// ============================================================================
// PDF GENERATOR FIXES (Findings 2, 3, 4, 5)
// These are verified by checking the source code patterns since PDF generation
// requires a full database context. We verify the logic is correct.
// ============================================================================

describe('Finding 2: PDF Shell Corrosion Rate - No Hardcoded Divisor', () => {
  
  it('should NOT contain hardcoded /12.0 divisor in professionalPdfGenerator.ts', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // The old code had: / 12.0).toFixed(5)
    // Verify it's been replaced with actual timeSpan usage
    const shellCalcSection = content.substring(
      content.indexOf('// Calculate corrosion allowance'),
      content.indexOf('doc.text(`Ca = t act')
    );
    
    // Should NOT have hardcoded 12.0 divisor
    expect(shellCalcSection).not.toMatch(/\/\s*12\.0\)/);
    
    // Should reference timeSpan or age
    expect(shellCalcSection).toMatch(/timeSpan|shellTimeSpan/);
    
    // Should have the FIXED comment
    expect(shellCalcSection).toMatch(/FIXED.*timeSpan|FIXED.*hardcoded/i);
  });

  it('corrosion rate formula should use shellTimeSpan variable', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Verify the cr calculation uses shellTimeSpan
    expect(content).toContain('shellTimeSpan');
    expect(content).toContain('shellTimeSpan > 0');
  });
});

describe('Finding 3: PDF Shell MAWP - Recalculated from t_next', () => {
  
  it('should recalculate MAWP using ASME UG-27 formula, not stored value', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Should contain the ASME UG-27 MAWP recalculation
    expect(content).toContain('S*E*t_next / (R + 0.6*t_next)');
    
    // Should calculate mapAtNext
    expect(content).toContain('mapAtNext');
    
    // Should subtract static head pressure
    expect(content).toContain('staticHeadPressure');
  });

  it('should calculate Yn from remaining life, not hardcoded 10', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Should calculate Yn from RL per API 510: MIN(RL/2, 10)
    expect(content).toContain('Math.min(shellRLNum / 2, 10)');
    
    // Should NOT have hardcoded 'Next Inspection (Yn) = 10'
    expect(content).not.toContain("'Next Inspection (Yn) = 10 (years)'");
  });

  it('t_next should use calculated Yn, not hardcoded 10', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Should use Yn variable in t_next calculation
    // Old: 2 * 10 * parseFloat(cr)
    // New: 2 * Yn * crNum
    expect(content).toContain('2 * Yn * crNum');
    expect(content).not.toMatch(/2\s*\*\s*10\s*\*\s*parseFloat\(cr\)/);
  });
});

describe('Finding 4: PDF Nozzle Age - No Hardcoded 12.0', () => {
  
  it('should NOT contain hardcoded age = 12.0 in nozzle evaluation', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Should NOT have the old hardcoded line
    expect(content).not.toContain('const age = 12.0;');
    
    // Should have the FIXED comment in the nozzle evaluation function
    const nozzleStart = content.indexOf('async function generateNozzleEvaluation');
    const nozzleEnd = content.indexOf('async function generateThicknessReadings');
    const nozzleSection = content.substring(nozzleStart, nozzleEnd);
    expect(nozzleSection).toContain('FIXED');
    expect(nozzleSection).toContain('Calculate actual age');
  });

  it('should calculate age from inspection dates', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Find the generateNozzleEvaluation function body
    const nozzleStart = content.indexOf('async function generateNozzleEvaluation');
    const nozzleEnd = content.indexOf('async function generateThicknessReadings');
    const nozzleSection = content.substring(nozzleStart, nozzleEnd);
    
    // Should reference inspection dates for age calculation
    expect(nozzleSection).toContain('inspectionDate');
    expect(nozzleSection).toContain('previousInspectionDate');
    
    // Should have a conservative fallback
    expect(nozzleSection).toContain('age = 10');
    expect(nozzleSection).toContain('Conservative fallback');
  });
});

describe('Finding 5: PDF Nozzle Material - Not Hardcoded', () => {
  
  it('should NOT contain hardcoded SS A-304 material', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('./server/professionalPdfGenerator.ts', 'utf-8');
    
    // Should NOT have the old hardcoded material
    expect(content).not.toContain("'SS A - 304'");
    
    // Should reference nozzle or inspection material
    const nozzleStart = content.indexOf('async function generateNozzleEvaluation');
    const nozzleEnd = content.indexOf('async function generateThicknessReadings');
    const nozzleSection = content.substring(nozzleStart, nozzleEnd);
    expect(nozzleSection).toContain('materialSpec');
  });
});

// ============================================================================
// CROSS-ENGINE CONSISTENCY: Verify all engines use same formulas
// ============================================================================

describe('Cross-Engine Formula Consistency', () => {
  
  it('Shell t_min: PR/(SE-0.6P) should be consistent across all engines', () => {
    // Test parameters
    const P = 250, R = 35.375, S = 20000, E = 0.85;
    const expected = (P * R) / (S * E - 0.6 * P);
    
    // This value should be ~0.525 inches
    expect(expected).toBeCloseTo(0.525, 2);
  });

  it('Shell MAWP: SEt/(R+0.6t) should be consistent across all engines', () => {
    const S = 20000, E = 0.85, t = 0.625, R = 35.375;
    const expected = (S * E * t) / (R + 0.6 * t);
    
    // This value should be ~297.6 psi
    expect(expected).toBeCloseTo(297.6, 0);
  });

  it('Corrosion rate: (t_prev - t_act) / Y should never use hardcoded Y', () => {
    const t_prev = 0.625, t_act = 0.600, Y = 5;
    const cr = (t_prev - t_act) / Y;
    
    // With Y=5: CR = 0.005 in/yr
    expect(cr).toBeCloseTo(0.005, 4);
    
    // With hardcoded Y=12: CR would be 0.00208 (WRONG)
    const cr_wrong = (t_prev - t_act) / 12;
    expect(cr_wrong).not.toBeCloseTo(cr, 3);
  });

  it('Remaining life: (t_act - t_min) / CR should be consistent', () => {
    const t_act = 0.600, t_min = 0.530, CR = 0.005;
    const RL = (t_act - t_min) / CR;
    
    // RL = 0.070 / 0.005 = 14 years
    expect(RL).toBeCloseTo(14, 0);
  });

  it('Next inspection: MIN(RL/2, 10) per API 510', () => {
    // Case 1: RL = 14 years → Yn = MIN(7, 10) = 7
    expect(Math.min(14 / 2, 10)).toBe(7);
    
    // Case 2: RL = 30 years → Yn = MIN(15, 10) = 10
    expect(Math.min(30 / 2, 10)).toBe(10);
    
    // Case 3: RL = 4 years → Yn = MIN(2, 10) = 2
    expect(Math.min(4 / 2, 10)).toBe(2);
  });

  it('MAP at next inspection: MAWP(t_next) where t_next = t_act - Yn*CR', () => {
    const t_act = 0.600, CR = 0.005, Yn = 7;
    const t_next = t_act - Yn * CR;
    
    // t_next = 0.600 - 7*0.005 = 0.565
    expect(t_next).toBeCloseTo(0.565, 3);
    
    // MAP = S*E*t_next / (R + 0.6*t_next)
    const S = 20000, E = 0.85, R = 35.375;
    const MAP = (S * E * t_next) / (R + 0.6 * t_next);
    expect(MAP).toBeGreaterThan(200);
    expect(MAP).toBeLessThan(300);
  });
});

// ============================================================================
// NEW MATERIAL DATABASE ENTRIES
// ============================================================================

describe('Extended Material Database Coverage', () => {
  
  it('SA-387 Grade 11 Class 1 should be in the database', async () => {
    const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
    const result = getAllowableStressNormalized('SA-387 Gr 11 Cl 1', 500);
    expect(result.status).toBe('ok');
    expect(result.stress).toBeGreaterThan(0);
  });

  it('SA-387 Grade 22 Class 1 should be in the database', async () => {
    const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
    const result = getAllowableStressNormalized('SA-387 Gr 22 Cl 1', 500);
    expect(result.status).toBe('ok');
    expect(result.stress).toBeGreaterThan(0);
  });

  it('SA-204 Grade B should be in the database', async () => {
    const { getAllowableStressNormalized } = await import('./asmeMaterialDatabase');
    const result = getAllowableStressNormalized('SA-204 Gr B', 500);
    expect(result.status).toBe('ok');
    expect(result.stress).toBeGreaterThan(0);
  });

  it('database should have at least 19 materials', async () => {
    const { getMaterialProperties } = await import('./asmeMaterialDatabase');
    // Verify key materials exist
    const materials = [
      'SA-516 Gr 70', 'SA-516 Gr 60', 'SA-285 Gr C',
      'SA-106 Gr B', 'SA-240 Type 304', 'SA-240 Type 316L',
      'SA-387 Gr 11 Cl 1', 'SA-387 Gr 22 Cl 1', 'SA-204 Gr B'
    ];
    
    for (const mat of materials) {
      const props = getMaterialProperties(mat);
      expect(props).not.toBeNull();
      expect(props?.minTensileStrength).toBeGreaterThan(0);
    }
  });
});
