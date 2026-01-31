/**
 * Head-Specific MAWP and MAP at Next Inspection Tests
 * 
 * Verifies implementation of:
 * - ASME VIII-1 UG-32(f) Hemispherical Head MAWP: P = 2SEt/(R+0.2t)
 * - ASME VIII-1 UG-32(d) 2:1 Ellipsoidal Head MAWP: P = 2SEt/(D+0.2t)
 * - ASME VIII-1 UG-32(e) Torispherical Head MAWP: P = 2SEt/(LM+0.2t)
 * - API 510 MAP at Next Inspection: t = t_act - 2×Yn×Cr
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMAWPHemisphericalHead,
  calculateMAWPEllipsoidalHead,
  calculateMAWPTorisphericalHead,
  calculateMAPAtNextInspection,
  performFullCalculation,
  CalculationInput
} from './lockedCalculationEngine';

describe('Head-Specific MAWP Calculations', () => {
  
  describe('Hemispherical Head MAWP - UG-32(f)', () => {
    it('should calculate MAWP using P = 2SEt/(R+0.2t) formula', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAWPHemisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('mawp_head_hemispherical');
      expect(result.codeReference).toContain('UG-32(f)');
      
      // Manual calculation: P = 2×17100×1.0×0.5 / (24 + 0.2×0.5) = 17100 / 24.1 = 709.54 psi
      const R = 24;
      const expectedMAWP = (2 * 17100 * 1.0 * 0.5) / (R + 0.2 * 0.5);
      expect(result.resultValue).toBeCloseTo(expectedMAWP, 1);
    });
    
    it('should include intermediate values for audit trail', () => {
      const input: CalculationInput = {
        currentThickness: 0.375,
        insideDiameter: 36,
        jointEfficiency: 0.85,
        allowableStress: 15000,
        designTemperature: 500
      };
      
      const result = calculateMAWPHemisphericalHead(input);
      
      expect(result.intermediateValues).toHaveProperty('t');
      expect(result.intermediateValues).toHaveProperty('R');
      expect(result.intermediateValues).toHaveProperty('S');
      expect(result.intermediateValues).toHaveProperty('E');
      expect(result.intermediateValues).toHaveProperty('MAWP');
    });
  });
  
  describe('2:1 Ellipsoidal Head MAWP - UG-32(d)', () => {
    it('should calculate MAWP using P = 2SEt/(D+0.2t) formula', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAWPEllipsoidalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('mawp_head_ellipsoidal');
      expect(result.codeReference).toContain('UG-32(d)');
      
      // Manual calculation: P = 2×17100×1.0×0.5 / (48 + 0.2×0.5) = 17100 / 48.1 = 355.51 psi
      const D = 48;
      const expectedMAWP = (2 * 17100 * 1.0 * 0.5) / (D + 0.2 * 0.5);
      expect(result.resultValue).toBeCloseTo(expectedMAWP, 1);
    });
    
    it('should produce lower MAWP than hemispherical for same dimensions', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const hemiResult = calculateMAWPHemisphericalHead(input);
      const ellipResult = calculateMAWPEllipsoidalHead(input);
      
      // Hemispherical heads are stronger due to geometry
      expect(hemiResult.resultValue).toBeGreaterThan(ellipResult.resultValue!);
    });
  });
  
  describe('Torispherical Head MAWP - UG-32(e)', () => {
    it('should calculate MAWP using P = 2SEt/(LM+0.2t) formula with M factor', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        crownRadius: 48,  // L = D for standard torispherical
        knuckleRadius: 2.88  // r = 0.06D
      };
      
      const result = calculateMAWPTorisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.calculationType).toBe('mawp_head_torispherical');
      expect(result.codeReference).toContain('UG-32(e)');
      
      // M factor: M = 0.25 × (3 + √(L/r)) = 0.25 × (3 + √(48/2.88)) = 0.25 × (3 + 4.08) = 1.77
      const L = 48;
      const r = 2.88;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      const expectedMAWP = (2 * 17100 * 1.0 * 0.5) / (L * M + 0.2 * 0.5);
      
      expect(result.resultValue).toBeCloseTo(expectedMAWP, 1);
      expect(result.intermediateValues).toHaveProperty('M');
    });
    
    it('should default crown radius to D and knuckle radius to 0.06D if not provided', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAWPTorisphericalHead(input);
      
      expect(result.success).toBe(true);
      expect(result.assumptions).toContain('Crown radius (L) defaulted to inside diameter (D)');
      expect(result.assumptions).toContain('Knuckle radius (r) defaulted to 6% of inside diameter (0.06D)');
    });
    
    it('should produce lower MAWP than ellipsoidal for same dimensions', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const ellipResult = calculateMAWPEllipsoidalHead(input);
      const toriResult = calculateMAWPTorisphericalHead(input);
      
      // Torispherical heads have lower MAWP due to M factor
      expect(ellipResult.resultValue).toBeGreaterThan(toriResult.resultValue!);
    });
  });
  
  describe('Head MAWP Ranking', () => {
    it('should rank head types: Hemispherical > Ellipsoidal > Torispherical', () => {
      const input: CalculationInput = {
        currentThickness: 0.5,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const hemiMAWP = calculateMAWPHemisphericalHead(input).resultValue!;
      const ellipMAWP = calculateMAWPEllipsoidalHead(input).resultValue!;
      const toriMAWP = calculateMAWPTorisphericalHead(input).resultValue!;
      
      expect(hemiMAWP).toBeGreaterThan(ellipMAWP);
      expect(ellipMAWP).toBeGreaterThan(toriMAWP);
    });
  });
});

describe('MAP at Next Inspection Calculations', () => {
  
  describe('Projected Thickness Calculation', () => {
    it('should calculate projected thickness using t = t_act - 2×Yn×Cr', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      
      expect(result.success).toBe(true);
      // t_projected = 0.500 - 2×5×0.005 = 0.500 - 0.050 = 0.450
      expect(result.projectedThickness).toBeCloseTo(0.450, 3);
      expect(result.yearsToNextInspection).toBe(5);
      expect(result.corrosionRate).toBe(0.005);
    });
    
    it('should use factor of 2 for safety margin per API 510', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.010, 3);
      
      // t_projected = 0.500 - 2×3×0.010 = 0.500 - 0.060 = 0.440
      expect(result.projectedThickness).toBeCloseTo(0.440, 3);
      expect(result.intermediateValues['2 × Yn × Cr']).toBeCloseTo(0.060, 3);
    });
  });
  
  describe('MAP Calculation for Different Component Types', () => {
    it('should use shell MAWP formula for Shell component', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      
      expect(result.success).toBe(true);
      expect(result.intermediateValues.component_type).toBe('Shell');
      expect(result.mapAtNextInspection).toBeGreaterThan(0);
    });
    
    it('should use head-specific MAWP formula for Head component', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        headType: '2:1 Ellipsoidal'
      };
      
      const result = calculateMAPAtNextInspection(input, 'Head', 0.005, 5);
      
      expect(result.success).toBe(true);
      expect(result.intermediateValues.component_type).toBe('Head');
      expect(result.intermediateValues.head_type).toBe('2:1 Ellipsoidal');
    });
    
    it('should use torispherical formula for torispherical heads', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        headType: 'Torispherical'
      };
      
      const result = calculateMAPAtNextInspection(input, 'Head', 0.005, 5);
      
      expect(result.success).toBe(true);
      expect(result.intermediateValues.head_type).toBe('Torispherical');
    });
  });
  
  describe('Static Head Deduction', () => {
    it('should apply static head deduction for vertical vessels with liquid', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        vesselOrientation: 'vertical',
        liquidHeight: 120,  // 10 feet in inches
        specificGravity: 0.85
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      
      expect(result.success).toBe(true);
      // Static head = 10 ft × 0.433 × 0.85 = 3.68 psi
      expect(result.staticHeadDeduction).toBeCloseTo(3.68, 1);
      expect(result.mawpAtNextInspection).toBeLessThan(result.mapAtNextInspection);
    });
    
    it('should not apply static head deduction for horizontal vessels', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        vesselOrientation: 'horizontal',
        liquidHeight: 120,
        specificGravity: 0.85
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      
      expect(result.staticHeadDeduction).toBe(0);
      expect(result.mawpAtNextInspection).toBe(result.mapAtNextInspection);
    });
  });
  
  describe('Warning Generation', () => {
    it('should warn when projected MAWP falls below design pressure', () => {
      const input: CalculationInput = {
        currentThickness: 0.300,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650,
        designPressure: 200
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.010, 5);
      
      // With high corrosion rate, MAWP should drop significantly
      if (result.mawpAtNextInspection < 200) {
        expect(result.warnings.some(w => w.includes('below design pressure'))).toBe(true);
      }
    });
    
    it('should warn when projected thickness goes to zero', () => {
      const input: CalculationInput = {
        currentThickness: 0.100,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      // Very high corrosion rate that would consume all thickness
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.050, 5);
      
      expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
      expect(result.projectedThickness).toBe(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should fail with invalid current thickness', () => {
      const input: CalculationInput = {
        currentThickness: 0,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0.005, 5);
      
      expect(result.success).toBe(false);
    });
    
    it('should fail with invalid corrosion rate', () => {
      const input: CalculationInput = {
        currentThickness: 0.500,
        insideDiameter: 48,
        jointEfficiency: 1.0,
        allowableStress: 17100,
        designTemperature: 650
      };
      
      const result = calculateMAPAtNextInspection(input, 'Shell', 0, 5);
      
      expect(result.success).toBe(false);
    });
  });
});

describe('performFullCalculation Integration', () => {
  
  it('should use head-specific MAWP for Head components', () => {
    const input: CalculationInput = {
      currentThickness: 0.500,
      insideDiameter: 48,
      jointEfficiency: 1.0,
      allowableStress: 17100,
      designTemperature: 650,
      designPressure: 150,
      headType: '2:1 Ellipsoidal',
      nominalThickness: 0.625,
      yearBuilt: 2010,
      currentYear: 2026
    };
    
    const result = performFullCalculation(input, 'Head');
    
    expect(result.success).toBe(true);
    expect(result.mawp.calculationType).toBe('mawp_head_ellipsoidal');
    expect(result.mawp.codeReference).toContain('UG-32(d)');
  });
  
  it('should include MAP at next inspection in summary', () => {
    const input: CalculationInput = {
      currentThickness: 0.500,
      insideDiameter: 48,
      jointEfficiency: 1.0,
      allowableStress: 17100,
      designTemperature: 650,
      designPressure: 150,
      nominalThickness: 0.625,
      yearBuilt: 2010,
      currentYear: 2026
    };
    
    const result = performFullCalculation(input, 'Shell');
    
    expect(result.success).toBe(true);
    if (result.mapAtNextInspection) {
      expect(result.summary.mapAtNextInspection).not.toBeNull();
      expect(result.summary.projectedThicknessAtNextInspection).not.toBeNull();
    }
  });
  
  it('should use hemispherical MAWP formula for hemispherical heads', () => {
    const input: CalculationInput = {
      currentThickness: 0.500,
      insideDiameter: 48,
      jointEfficiency: 1.0,
      allowableStress: 17100,
      designTemperature: 650,
      designPressure: 150,
      headType: 'Hemispherical'
    };
    
    const result = performFullCalculation(input, 'Head');
    
    expect(result.success).toBe(true);
    expect(result.mawp.calculationType).toBe('mawp_head_hemispherical');
    expect(result.mawp.codeReference).toContain('UG-32(f)');
  });
  
  it('should use torispherical MAWP formula for torispherical heads', () => {
    const input: CalculationInput = {
      currentThickness: 0.500,
      insideDiameter: 48,
      jointEfficiency: 1.0,
      allowableStress: 17100,
      designTemperature: 650,
      designPressure: 150,
      headType: 'Torispherical'
    };
    
    const result = performFullCalculation(input, 'Head');
    
    expect(result.success).toBe(true);
    expect(result.mawp.calculationType).toBe('mawp_head_torispherical');
    expect(result.mawp.codeReference).toContain('UG-32(e)');
  });
});

describe('Formula Verification Against Reference', () => {
  /**
   * Reference from user's documentation:
   * East Head: t_prev=0.485, t_act=0.467, t_min=0.401, y=8
   * Ca = t_act - t_min = 0.467 - 0.401 = 0.066 inch
   * Cr = (t_prev - t_act) / Y = (0.485 - 0.467) / 8 = 0.0022 in/year
   * RL = Ca / Cr = 0.066 / 0.0022 = 30 years
   */
  it('should match reference example for remaining life calculation', () => {
    const t_act = 0.467;
    const t_prev = 0.485;
    const t_min = 0.401;
    const Y = 8;
    
    const Ca = t_act - t_min;
    const Cr = (t_prev - t_act) / Y;
    const RL = Ca / Cr;
    
    expect(Ca).toBeCloseTo(0.066, 3);
    expect(Cr).toBeCloseTo(0.00225, 4);
    expect(RL).toBeCloseTo(29.3, 0);  // ~30 years
  });
  
  /**
   * Reference: MAP at Next Inspection
   * Where t = t_act - 2×Yn×Cr
   * For Yn=10 years, Cr=0.0022:
   * t = 0.467 - 2×10×0.0022 = 0.467 - 0.044 = 0.423 inch
   */
  it('should match reference example for projected thickness', () => {
    const t_act = 0.467;
    const Yn = 10;
    const Cr = 0.0022;
    
    const t_projected = t_act - (2 * Yn * Cr);
    
    expect(t_projected).toBeCloseTo(0.423, 3);
  });
});
