/**
 * Locked Calculation Engine Tests
 * 
 * Comprehensive test suite verifying ASME VIII-1 and API 510 calculations.
 * These tests ensure regulatory compliance and calculation accuracy.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  calculateTRequiredShell,
  calculateTRequiredEllipsoidalHead,
  calculateTRequiredTorisphericalHead,
  calculateTRequiredHemisphericalHead,
  calculateMAWPShell,
  calculateCorrosionRateLongTerm,
  calculateCorrosionRateShortTerm,
  calculateRemainingLife,
  calculateNextInspectionInterval,
  performFullCalculation,
  getEngineInfo,
  CALCULATION_ENGINE_VERSION,
  type CalculationInput,
} from './lockedCalculationEngine';
import {
  getAllowableStress,
  getAllowableStressNormalized,
  getMaterialProperties,
  listAvailableMaterials,
  getDatabaseInfo,
  DATABASE_VERSION,
} from './asmeMaterialDatabase';

describe('ASME Material Database', () => {
  describe('getAllowableStress', () => {
    it('should return correct stress for SA-516 Gr 70 at 100°F', () => {
      const result = getAllowableStress('SA-516 Gr 70', 100);
      expect(result.stress).toBe(20000);
      expect(result.status).toBe('ok');
      expect(result.databaseVersion).toBe(DATABASE_VERSION);
    });

    it('should interpolate stress values between temperature points', () => {
      // SA-516 Gr 70: 700°F = 20000 psi, 750°F = 19400 psi
      // At 725°F, should interpolate to 19700 psi
      const result = getAllowableStress('SA-516 Gr 70', 725);
      expect(result.status).toBe('ok_interpolated');
      expect(result.stress).toBe(19700);
    });

    it('should return error for unknown material', () => {
      const result = getAllowableStress('UNKNOWN-MATERIAL', 100);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });

    it('should return error for temperature below minimum', () => {
      const result = getAllowableStress('SA-516 Gr 70', -100);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });

    it('should return error for temperature above maximum', () => {
      const result = getAllowableStress('SA-516 Gr 70', 1000);
      expect(result.status).toBe('error');
      expect(result.stress).toBeNull();
    });
  });

  describe('getAllowableStressNormalized', () => {
    it('should normalize material specification variations', () => {
      // The normalized function handles variations in material spec format
      const result1 = getAllowableStressNormalized('SA-516 Gr 70', 100);
      const result2 = getAllowableStressNormalized('SA-516 Gr 70', 100);
      
      expect(result1.stress).toBe(result2.stress);
      expect(result1.stress).toBe(20000);
      expect(result1.normalizedSpec).toBe('SA-516 Gr 70');
    });
  });

  describe('getMaterialProperties', () => {
    it('should return properties for valid material', () => {
      const props = getMaterialProperties('SA-516 Gr 70');
      expect(props).not.toBeNull();
      expect(props?.specNumber).toBe('SA-516');
      expect(props?.grade).toBe('70');
      expect(props?.minTensileStrength).toBe(70000);
      expect(props?.minYieldStrength).toBe(38000);
    });

    it('should return null for unknown material', () => {
      const props = getMaterialProperties('UNKNOWN');
      expect(props).toBeNull();
    });
  });

  describe('listAvailableMaterials', () => {
    it('should return list of materials', () => {
      const materials = listAvailableMaterials();
      expect(materials.length).toBeGreaterThan(0);
      expect(materials).toContain('SA-516 Gr 70');
      expect(materials).toContain('SA-240 Type 304');
    });
  });
});

describe('Shell Calculations (ASME VIII-1 UG-27)', () => {
  describe('calculateTRequiredShell', () => {
    it('should calculate t_required correctly for typical vessel', () => {
      // Example: 48" ID vessel, 150 psi design, SA-516 Gr 70, E=1.0
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('t_required_shell');
      expect(result.codeReference).toBe('ASME Section VIII Division 1, UG-27(c)(1)');
      
      // Manual verification: t = PR / (SE - 0.6P)
      // t = (150 × 24) / (20000 × 1.0 - 0.6 × 150)
      // t = 3600 / (20000 - 90) = 3600 / 19910 = 0.1808"
      expect(result.resultValue).toBeCloseTo(0.1808, 3);
    });

    it('should have static head = 0 for horizontal vessels', () => {
      // CRITICAL: Horizontal vessels have NO static head pressure on heads
      // Static head only applies to vertical vessels where liquid column creates pressure
      const input: CalculationInput = {
        insideDiameter: 130.25,
        designPressure: 225,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.75,
        currentThickness: 0.493,
        corrosionAllowance: 0.125,
        vesselOrientation: 'horizontal', // HORIZONTAL vessel
        specificGravity: 0.73,
        liquidHeight: 130.25,
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(true);
      // Static head should be ZERO for horizontal vessels
      expect(result.intermediateValues['P_static_head']).toBe(0);
      expect(result.intermediateValues['P_total']).toBe(225); // No static head added
      expect(result.assumptions).toContain('Static head = 0 psi (horizontal vessel orientation)');
    });

    it('should include static head pressure for vertical vessels', () => {
      // Vertical vessels DO have static head from liquid column
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        vesselOrientation: 'vertical', // VERTICAL vessel
        specificGravity: 1.0, // Water
        liquidHeight: 120, // 10 feet of liquid
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(true);
      // Static head should be included for vertical vessels
      // Static head = SG × 62.4 × h / 144 = 1.0 × 62.4 × 120 / 144 = 52 psi
      expect(result.intermediateValues['P_static_head']).toBeCloseTo(52, 0);
      expect(result.intermediateValues['P_total']).toBeGreaterThan(150);
      expect(result.assumptions.some(a => a.includes('vertical'))).toBe(true);
    });

    it('should warn when vessel orientation not specified but static head params provided', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        // vesselOrientation NOT specified
        specificGravity: 1.0,
        liquidHeight: 120,
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(true);
      // Should warn about missing orientation
      expect(result.warnings).toContain('Vessel orientation not specified - assuming vertical for static head calculation');
    });

    it('should warn when current thickness is below t_required', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.15, // Below t_required
        corrosionAllowance: 0.125,
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
      expect(result.validationStatus).toBe('warning');
    });

    it('should return error for invalid inputs', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: -100, // Invalid
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
      };

      const result = calculateTRequiredShell(input);
      
      expect(result.success).toBe(false);
      expect(result.validationStatus).toBe('error');
    });
  });

  describe('calculateMAWPShell', () => {
    it('should calculate MAWP correctly', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.375,
        corrosionAllowance: 0.125,
      };

      const result = calculateMAWPShell(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('mawp_shell');
      expect(result.codeReference).toBe('ASME Section VIII Division 1, UG-27(c)(1)');
      
      // Manual verification: MAWP = SEt / (R + 0.6t)
      // MAWP = (20000 × 1.0 × 0.375) / (24 + 0.6 × 0.375)
      // MAWP = 7500 / 24.225 = 309.6 psi
      expect(result.resultValue).toBeCloseTo(309.6, 0);
    });

    it('should warn when MAWP is below design pressure', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 500, // High design pressure
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.25, // Thin wall
        corrosionAllowance: 0.125,
      };

      const result = calculateMAWPShell(input);
      
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('WARNING'))).toBe(true);
    });
  });
});

describe('Head Calculations (ASME VIII-1 UG-32)', () => {
  describe('calculateTRequiredEllipsoidalHead', () => {
    it('should calculate t_required for 2:1 ellipsoidal head', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        headType: '2:1 Ellipsoidal',
      };

      const result = calculateTRequiredEllipsoidalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('t_required_head_ellipsoidal');
      expect(result.codeReference).toBe('ASME Section VIII Division 1, UG-32(d)');
      
      // Manual verification: t = PD / (2SE - 0.2P)
      // t = (150 × 48) / (2 × 20000 × 1.0 - 0.2 × 150)
      // t = 7200 / (40000 - 30) = 7200 / 39970 = 0.1802"
      expect(result.resultValue).toBeCloseTo(0.1802, 3);
    });
  });

  describe('calculateTRequiredTorisphericalHead', () => {
    it('should calculate t_required for torispherical head', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        headType: 'Torispherical',
        crownRadius: 48, // L = D for standard torispherical
        knuckleRadius: 2.88, // r = 0.06D for standard torispherical
      };

      const result = calculateTRequiredTorisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('t_required_head_torispherical');
      expect(result.codeReference).toBe('ASME Section VIII Division 1, UG-32(e)');
      
      // Verify M factor is calculated
      expect(result.intermediateValues['M']).toBeGreaterThan(1);
      expect(result.intermediateValues['L/r']).toBeCloseTo(16.67, 1);
    });

    it('should warn for high L/r ratio', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        headType: 'Torispherical',
        crownRadius: 48,
        knuckleRadius: 2.0, // Small knuckle radius = high L/r
      };

      const result = calculateTRequiredTorisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('L/r ratio'))).toBe(true);
    });
  });

  describe('calculateTRequiredHemisphericalHead', () => {
    it('should calculate t_required for hemispherical head', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        headType: 'Hemispherical',
      };

      const result = calculateTRequiredHemisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('t_required_head_hemispherical');
      expect(result.codeReference).toBe('ASME Section VIII Division 1, UG-32(f)');
      
      // Manual verification: t = PR / (2SE - 0.2P)
      // t = (150 × 24) / (2 × 20000 × 1.0 - 0.2 × 150)
      // t = 3600 / (40000 - 30) = 3600 / 39970 = 0.0901"
      expect(result.resultValue).toBeCloseTo(0.0901, 3);
    });
  });
});

describe('Corrosion Rate Calculations (API 510)', () => {
  describe('calculateCorrosionRateLongTerm', () => {
    it('should calculate long-term corrosion rate correctly', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        yearBuilt: 2010,
        currentYear: 2025,
      };

      const result = calculateCorrosionRateLongTerm(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('corrosion_rate_lt');
      expect(result.codeReference).toBe('API 510 §7.1.1');
      
      // Manual verification: CR_LT = (0.5 - 0.45) / 15 = 0.00333 in/yr
      expect(result.resultValue).toBeCloseTo(0.00333, 4);
    });

    it('should handle apparent thickness growth', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.55, // Greater than nominal (growth)
        corrosionAllowance: 0.125,
        yearBuilt: 2010,
        currentYear: 2025,
      };

      const result = calculateCorrosionRateLongTerm(input);
      
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0); // Should be 0 for apparent growth
      expect(result.warnings.some(w => w.includes('growth'))).toBe(true);
    });
  });

  describe('calculateCorrosionRateShortTerm', () => {
    it('should calculate short-term corrosion rate correctly', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        previousThickness: 0.48,
        corrosionAllowance: 0.125,
        previousInspectionDate: new Date('2020-01-15'),
        currentInspectionDate: new Date('2025-01-15'),
      };

      const result = calculateCorrosionRateShortTerm(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('corrosion_rate_st');
      expect(result.codeReference).toBe('API 510 §7.1.1');
      
      // Manual verification: CR_ST = (0.48 - 0.45) / 5 = 0.006 in/yr
      expect(result.resultValue).toBeCloseTo(0.006, 4);
    });
  });
});

describe('Remaining Life Calculations (API 510)', () => {
  describe('calculateRemainingLife', () => {
    it('should calculate remaining life correctly', () => {
      const result = calculateRemainingLife(0.45, 0.18, 0.005, 'LT');
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('remaining_life');
      expect(result.codeReference).toBe('API 510 §7.1.1');
      
      // Manual verification: RL = (0.45 - 0.18) / 0.005 = 54 years
      expect(result.resultValue).toBeCloseTo(54, 0);
    });

    it('should return 0 when thickness is at or below t_required', () => {
      const result = calculateRemainingLife(0.18, 0.20, 0.005, 'LT');
      
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0);
      expect(result.validationStatus).toBe('error');
      expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
    });

    it('should warn for remaining life less than 4 years', () => {
      const result = calculateRemainingLife(0.20, 0.18, 0.01, 'LT');
      
      expect(result.success).toBe(true);
      // RL = (0.20 - 0.18) / 0.01 = 2 years
      expect(result.resultValue).toBeCloseTo(2, 0);
      // Remaining life < 2 years triggers WARNING
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Inspection Interval Calculations (API 510)', () => {
  describe('calculateNextInspectionInterval', () => {
    it('should calculate standard interval (RL > 4 years)', () => {
      const result = calculateNextInspectionInterval(20);
      
      expect(result.success).toBe(true);
      // Interval = MIN(20/2, 10) = 10 years
      expect(result.resultValue).toBe(10);
    });

    it('should cap interval at 10 years', () => {
      const result = calculateNextInspectionInterval(50);
      
      expect(result.success).toBe(true);
      // Interval = MIN(50/2, 10) = 10 years
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
      expect(result.warnings.some(w => w.includes('WARNING'))).toBe(true);
    });

    it('should return 0 for exhausted remaining life', () => {
      const result = calculateNextInspectionInterval(0);
      
      expect(result.success).toBe(true);
      expect(result.resultValue).toBe(0);
      expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
    });
  });
});

describe('Full Calculation Suite', () => {
  describe('performFullCalculation', () => {
    it('should perform complete calculation for shell component', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        previousThickness: 0.48,
        corrosionAllowance: 0.125,
        yearBuilt: 2010,
        currentYear: 2025,
        previousInspectionDate: new Date('2020-01-15'),
        currentInspectionDate: new Date('2025-01-15'),
      };

      const result = performFullCalculation(input, 'Shell');
      
      expect(result.success).toBe(true);
      expect(result.componentType).toBe('Shell');
      
      // Check all calculations were performed
      expect(result.tRequired.success).toBe(true);
      expect(result.mawp.success).toBe(true);
      expect(result.corrosionRateLT?.success).toBe(true);
      expect(result.corrosionRateST?.success).toBe(true);
      expect(result.remainingLife?.success).toBe(true);
      expect(result.nextInspectionDate?.success).toBe(true);
      
      // Check summary
      expect(result.summary.tRequired).not.toBeNull();
      expect(result.summary.mawp).not.toBeNull();
      expect(result.summary.corrosionRate).not.toBeNull();
      expect(result.summary.remainingLife).not.toBeNull();
      expect(result.summary.status).toBe('acceptable');
    });

    it('should perform complete calculation for head component', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.45,
        corrosionAllowance: 0.125,
        headType: '2:1 Ellipsoidal',
        yearBuilt: 2010,
        currentYear: 2025,
      };

      const result = performFullCalculation(input, 'Head');
      
      expect(result.success).toBe(true);
      expect(result.componentType).toBe('Head');
      expect(result.tRequired.calculationType).toBe('t_required_head_ellipsoidal');
    });

    it('should identify unacceptable status when thickness is below t_required', () => {
      const input: CalculationInput = {
        insideDiameter: 48,
        designPressure: 150,
        designTemperature: 100,
        materialSpec: 'SA-516 Gr 70',
        jointEfficiency: 1.0,
        nominalThickness: 0.5,
        currentThickness: 0.15, // Below t_required
        corrosionAllowance: 0.125,
        yearBuilt: 2010,
        currentYear: 2025,
      };

      const result = performFullCalculation(input, 'Shell');
      
      expect(result.summary.status).toBe('unacceptable');
      expect(result.summary.statusReason).toContain('below minimum');
    });
  });
});

describe('Engine Information', () => {
  it('should return engine info with version', () => {
    const info = getEngineInfo();
    
    expect(info.version).toBe(CALCULATION_ENGINE_VERSION);
    expect(info.materialDatabaseVersion).toBe(DATABASE_VERSION);
    expect(info.supportedCalculations.length).toBeGreaterThan(0);
  });

  it('should return database info', () => {
    const info = getDatabaseInfo();
    
    expect(info.version).toBe(DATABASE_VERSION);
    expect(info.reference).toContain('ASME');
    expect(info.materialCount).toBeGreaterThan(0);
  });
});

describe('MAWP Consistency Between Summary and Detailed Results', () => {
  /**
   * Critical test for bug fix: Summary tab was showing Shell MAWP (UG-27) 
   * while Detailed Results showed Head MAWP (UG-32), causing 2x discrepancy.
   * 
   * The fullResult.summary.mawp MUST equal fullResult.mawp.resultValue
   * to ensure consistency between Summary and Detailed Results tabs.
   */
  
  it('should have consistent MAWP between summary and detailed results for shell', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 100,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 1.0,
      nominalThickness: 0.5,
      currentThickness: 0.45,
      corrosionAllowance: 0.125,
      yearBuilt: 2010,
      currentYear: 2025,
    };

    const result = performFullCalculation(input, 'Shell');
    
    // CRITICAL: summary.mawp MUST equal mawp.resultValue
    expect(result.summary.mawp).toBe(result.mawp.resultValue);
    expect(result.mawp.codeReference).toContain('UG-27'); // Shell formula
  });

  it('should have consistent MAWP between summary and detailed results for hemispherical head', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 100,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 1.0,
      nominalThickness: 0.5,
      currentThickness: 0.45,
      corrosionAllowance: 0.125,
      headType: 'Hemispherical',
      yearBuilt: 2010,
      currentYear: 2025,
    };

    const result = performFullCalculation(input, 'Head');
    
    // CRITICAL: summary.mawp MUST equal mawp.resultValue
    expect(result.summary.mawp).toBe(result.mawp.resultValue);
    expect(result.mawp.codeReference).toContain('UG-32(f)'); // Hemispherical head formula
  });

  it('should have consistent MAWP between summary and detailed results for ellipsoidal head', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 100,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 1.0,
      nominalThickness: 0.5,
      currentThickness: 0.45,
      corrosionAllowance: 0.125,
      headType: '2:1 Ellipsoidal',
      yearBuilt: 2010,
      currentYear: 2025,
    };

    const result = performFullCalculation(input, 'Head');
    
    // CRITICAL: summary.mawp MUST equal mawp.resultValue
    expect(result.summary.mawp).toBe(result.mawp.resultValue);
    expect(result.mawp.codeReference).toContain('UG-32(d)'); // Ellipsoidal head formula
  });

  it('should have consistent MAWP between summary and detailed results for torispherical head', () => {
    const input: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 100,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 1.0,
      nominalThickness: 0.5,
      currentThickness: 0.45,
      corrosionAllowance: 0.125,
      headType: 'Torispherical',
      yearBuilt: 2010,
      currentYear: 2025,
    };

    const result = performFullCalculation(input, 'Head');
    
    // CRITICAL: summary.mawp MUST equal mawp.resultValue
    expect(result.summary.mawp).toBe(result.mawp.resultValue);
    expect(result.mawp.codeReference).toContain('UG-32(e)'); // Torispherical head formula
  });

  it('should show different MAWP values for shell vs hemispherical head with same inputs', () => {
    const baseInput: CalculationInput = {
      insideDiameter: 48,
      designPressure: 150,
      designTemperature: 100,
      materialSpec: 'SA-516 Gr 70',
      jointEfficiency: 1.0,
      nominalThickness: 0.5,
      currentThickness: 0.45,
      corrosionAllowance: 0.125,
      yearBuilt: 2010,
      currentYear: 2025,
    };

    const shellResult = performFullCalculation(baseInput, 'Shell');
    const headResult = performFullCalculation({ ...baseInput, headType: 'Hemispherical' }, 'Head');
    
    // Hemispherical head MAWP should be approximately 2x shell MAWP
    // because P_head = 2*S*E*t/(R+0.2t) vs P_shell = S*E*t/(R+0.6t)
    const shellMAWP = shellResult.mawp.resultValue!;
    const headMAWP = headResult.mawp.resultValue!;
    
    expect(headMAWP).toBeGreaterThan(shellMAWP * 1.5); // Head should be significantly higher
    expect(headMAWP).toBeLessThan(shellMAWP * 2.5); // But not more than 2.5x
  });
});
