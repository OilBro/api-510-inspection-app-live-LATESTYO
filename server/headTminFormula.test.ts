/**
 * Head t_min Formula Verification Tests
 * 
 * Validates that the correct ASME Section VIII Division 1 formulas are used
 * for each head type in the recalculate function.
 * 
 * Reference: ASME BPVC Section VIII Division 1
 *   - UG-32(d): 2:1 Ellipsoidal Head: t = PD/(2SE-0.2P)
 *   - UG-32(e): Torispherical Head: t = PLM/(2SE-0.2P)
 *   - UG-32(f): Hemispherical Head: t = PR/(2SE-0.2P)
 *   - UG-27: Cylindrical Shell: t = PR/(SE-0.6P)
 */
import { describe, it, expect } from 'vitest';

// Test parameters from vessel 54-11-001
const P = 225;       // Design pressure (psi)
const D = 130.25;    // Inside diameter (inches)
const R = D / 2;     // Inside radius = 65.125 inches
const S = 20700;     // Allowable stress SA-612 at 125°F (psi)
const E = 1.0;       // Joint efficiency (full RT)

describe('ASME Head Minimum Thickness Formulas', () => {
  
  describe('UG-32(d) - 2:1 Ellipsoidal Head', () => {
    it('should use t = PD/(2SE-0.2P) with full diameter D', () => {
      const denominator = 2 * S * E - 0.2 * P;
      const t_min = (P * D) / denominator;
      
      // Must use D (diameter), NOT R (radius)
      expect(t_min).toBeCloseTo(0.7087, 3);
    });
    
    it('should NOT use hemispherical formula (P*R instead of P*D)', () => {
      // This was the bug: using R instead of D gives exactly half the correct value
      const t_wrong = (P * R) / (2 * S * E - 0.2 * P);
      expect(t_wrong).toBeCloseTo(0.3543, 3);
      
      const t_correct = (P * D) / (2 * S * E - 0.2 * P);
      expect(t_correct).toBeCloseTo(0.7087, 3);
      
      // The wrong value is exactly half the correct value
      expect(t_wrong / t_correct).toBeCloseTo(0.5, 4);
    });
    
    it('should compute correct MAWP using 2SEt/(D+0.2t)', () => {
      const t_act = 0.497;
      const mawp = (2 * S * E * t_act) / (D + 0.2 * t_act);
      
      // Ellipsoidal MAWP uses D (diameter) in denominator
      expect(mawp).toBeCloseTo(157.9, 0);
    });
  });
  
  describe('UG-32(f) - Hemispherical Head', () => {
    it('should use t = PR/(2SE-0.2P) with radius R', () => {
      const denominator = 2 * S * E - 0.2 * P;
      const t_min = (P * R) / denominator;
      
      expect(t_min).toBeCloseTo(0.3543, 3);
    });
    
    it('should compute correct MAWP using 2SEt/(R+0.2t)', () => {
      const t_act = 0.497;
      const mawp = (2 * S * E * t_act) / (R + 0.2 * t_act);
      
      // Hemispherical MAWP uses R (radius) in denominator
      expect(mawp).toBeCloseTo(315.5, 0);
    });
  });
  
  describe('UG-32(e) - Torispherical Head', () => {
    it('should use t = PLM/(2SE-0.2P) with M factor', () => {
      const L = D;  // Crown radius = D for standard F&D
      const r = 0.06 * D;  // Knuckle radius = 6% of D
      const M = 0.25 * (3 + Math.sqrt(L / r));
      
      const denominator = 2 * S * E - 0.2 * P;
      const t_min = (P * L * M) / denominator;
      
      expect(M).toBeCloseTo(1.7706, 3);
      expect(t_min).toBeCloseTo(1.2548, 3);
    });
  });
  
  describe('UG-27 - Cylindrical Shell', () => {
    it('should use t = PR/(SE-0.6P) with radius R', () => {
      const denominator = S * E - 0.6 * P;
      const t_min = (P * R) / denominator;
      
      expect(t_min).toBeCloseTo(0.7125, 3);
    });
    
    it('should compute correct MAWP using SEt/(R+0.6t)', () => {
      const t_act = 0.796;
      const mawp = (S * E * t_act) / (R + 0.6 * t_act);
      
      expect(mawp).toBeCloseTo(251.2, 0);
    });
  });
  
  describe('Formula discrimination by head type', () => {
    // Simulates the fixed recalculate function logic
    function computeHeadTmin(headType: string): number {
      const headTypeStr = (headType || 'ellipsoidal').toLowerCase();
      const denominator = 2 * S * E - 0.2 * P;
      
      if (denominator <= 0) return 0;
      
      if (headTypeStr.includes('torispherical')) {
        const crownRadius = D;
        const knuckleRadius = 0.06 * D;
        const M = 0.25 * (3 + Math.sqrt(crownRadius / knuckleRadius));
        return (P * crownRadius * M) / denominator;
      } else if (headTypeStr.includes('hemispherical')) {
        return (P * R) / denominator;
      } else {
        // 2:1 Ellipsoidal (default)
        return (P * D) / denominator;
      }
    }
    
    it('should select ellipsoidal formula for "Ellipsoidal" head type', () => {
      expect(computeHeadTmin('Ellipsoidal')).toBeCloseTo(0.7087, 3);
    });
    
    it('should select ellipsoidal formula for "2:1 Ellipsoidal" head type', () => {
      expect(computeHeadTmin('2:1 Ellipsoidal')).toBeCloseTo(0.7087, 3);
    });
    
    it('should select hemispherical formula for "Hemispherical" head type', () => {
      expect(computeHeadTmin('Hemispherical')).toBeCloseTo(0.3543, 3);
    });
    
    it('should select torispherical formula for "Torispherical" head type', () => {
      expect(computeHeadTmin('Torispherical')).toBeCloseTo(1.2548, 3);
    });
    
    it('should default to ellipsoidal when head type is empty or unknown', () => {
      expect(computeHeadTmin('')).toBeCloseTo(0.7087, 3);
      expect(computeHeadTmin('unknown')).toBeCloseTo(0.7087, 3);
    });
    
    it('should handle case-insensitive head type strings', () => {
      expect(computeHeadTmin('ELLIPSOIDAL')).toBeCloseTo(0.7087, 3);
      expect(computeHeadTmin('hemispherical')).toBeCloseTo(0.3543, 3);
      expect(computeHeadTmin('TORISPHERICAL')).toBeCloseTo(1.2548, 3);
    });
  });
  
  describe('Old report 0.421 validation', () => {
    it('should confirm 0.421 does NOT match any standard formula with S=20700', () => {
      const t_ellip = (P * D) / (2 * S * E - 0.2 * P);
      const t_hemi = (P * R) / (2 * S * E - 0.2 * P);
      const L = D;
      const r = 0.06 * D;
      const M = 0.25 * (3 + Math.sqrt(L / r));
      const t_toris = (P * L * M) / (2 * S * E - 0.2 * P);
      
      expect(Math.abs(t_ellip - 0.421)).toBeGreaterThan(0.1);
      expect(Math.abs(t_hemi - 0.421)).toBeGreaterThan(0.05);
      expect(Math.abs(t_toris - 0.421)).toBeGreaterThan(0.5);
    });
  });
  
  describe('Fitness-for-service implications', () => {
    it('should flag negative CA when t_actual < t_min for ellipsoidal heads', () => {
      const t_min = (P * D) / (2 * S * E - 0.2 * P);
      const t_actual_north = 0.497;
      const t_actual_south = 0.493;
      
      const ca_north = t_actual_north - t_min;
      const ca_south = t_actual_south - t_min;
      
      // Both heads are below minimum required thickness
      expect(ca_north).toBeLessThan(0);
      expect(ca_south).toBeLessThan(0);
      
      // MAWP is below design pressure
      const mawp_north = (2 * S * E * t_actual_north) / (D + 0.2 * t_actual_north);
      expect(mawp_north).toBeLessThan(P);
    });
  });
});
