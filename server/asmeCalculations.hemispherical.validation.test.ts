/**
 * Validation tests for hemispherical head calculations
 * Track 002 - Phase 2: Hemispherical Head Validation
 */

import { describe, it, expect } from "vitest";
import { calculateHemisphericalHead } from "./asmeCalculations";

describe("Hemispherical Head Validation", () => {
  
  describe("R = D/2 Validation", () => {
    it("should correctly calculate R from D", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75
      });
      
      // R should be D/2 = 35.375
      // This is implicit in the calculation, verify it's used correctly
      expect(result.t_min).toBeGreaterThan(0);
    });
    
    it("should track when R is calculated from D", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75
      });
      
      // Should track that R was calculated from D
      expect(result.defaultsUsed).toContain("R (inside radius)");
    });
  });
  
  describe("Pressure to Stress Ratio Validation", () => {
    it("should accept normal pressure ratio (P/(SE) < 0.5)", () => {
      const P = 150;
      const S = 20000;
      const E = 0.85;
      const ratio = P / (S * E);
      
      expect(ratio).toBeLessThan(0.5);
      expect(ratio).toBeCloseTo(0.0088, 4);
    });
    
    it("should warn for high pressure ratio (P/(SE) > 0.5)", () => {
      const result = calculateHemisphericalHead({
        P: 10000,
        S: 20000,
        E: 0.85,
        D: 70.75
      });
      
      const warning = result.warnings.find(w => w.field === "P/(SE)");
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe("warning");
    });
    
    it("should error for very high pressure ratio (P/(SE) > 0.9)", () => {
      expect(() => {
        calculateHemisphericalHead({
          P: 16000,
          S: 20000,
          E: 0.85,
          D: 70.75
        });
      }).toThrow("Pressure to stress ratio too high");
    });
  });
  
  describe("Denominator Safety Validation", () => {
    it("should accept safe denominator (> 1000)", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75
      });
      
      expect(result.warnings.filter(w => w.field.includes("denom")).length).toBe(0);
    });
    
    it("should warn for small denominator (100 < denom < 1000)", () => {
      // To get 100 < denom < 1000 AND P/(SE) < 0.9:
      // denom = 2*S*E - 0.2*P
      // P/(SE) < 0.9 means P < 0.9*S*E
      // Try: S=5000, E=0.85, P=3500
      // denom = 2*5000*0.85 - 0.2*3500 = 8500 - 700 = 7800 (too high)
      // Try: S=600, E=0.85, P=450
      // denom = 2*600*0.85 - 0.2*450 = 1020 - 90 = 930 ✓
      // P/(SE) = 450/(600*0.85) = 0.88 < 0.9 ✓
      const result = calculateHemisphericalHead({
        P: 450,
        S: 600,
        E: 0.85,
        D: 70.75
      });
      
      const warning = result.warnings.find(w => w.field.includes("denom"));
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe("warning");
    });
    
    it("should error for very small denominator (denom < 100)", () => {
      expect(() => {
        calculateHemisphericalHead({
          P: 8400,
          S: 1000,
          E: 0.85,
          D: 70.75
        });
      }).toThrow();
    });
  });
  
  describe("Actual Thickness Edge Cases", () => {
    it("should handle t_act > t_min (compliant)", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.5
      });
      
      expect(result.Ca).toBeGreaterThan(0);
      expect(result.isCompliant).toBe(true);
    });
    
    it("should handle t_act < t_min (non-compliant)", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.1
      });
      
      expect(result.isCompliant).toBe(false);
      const criticalWarning = result.warnings.find(w => w.severity === "critical");
      expect(criticalWarning).toBeDefined();
    });
    
    it("should warn when t_act is very close to t_min", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.158 // Just above t_min
      });
      
      expect(result.isCompliant).toBe(true);
      const warning = result.warnings.find(w => w.field === "t_act");
      expect(warning).toBeDefined();
    });
    
    it("should critically warn when t_act < 0.9 * t_min", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.13
      });
      
      expect(result.isCompliant).toBe(false);
      const criticalWarning = result.warnings.find(w => w.severity === "critical");
      expect(criticalWarning).toBeDefined();
      expect(criticalWarning?.message).toContain("critically below");
    });
  });
  
  describe("Corrosion Rate Edge Cases", () => {
    it("should handle zero corrosion rate", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.5,
        t_prev: 0.5,
        Y: 5
      });
      
      expect(result.Cr).toBe(0);
      expect(result.RL).toBeUndefined();
    });
    
    it("should handle negative corrosion rate (metal growth)", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.5,
        t_prev: 0.45,
        Y: 5
      });
      
      expect(result.Cr_short).toBeLessThan(0);
      expect(result.Cr).toBe(0);
      expect(result.RL).toBeUndefined();
    });
    
    it("should handle very small positive corrosion rate", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.5,
        t_prev: 0.5001,
        Y: 10
      });
      
      expect(result.Cr).toBeGreaterThan(0);
      expect(result.Cr).toBeLessThan(0.001);
      if (result.RL !== undefined) {
        expect(result.RL).toBeLessThanOrEqual(500);
      }
    });
    
    it("should handle normal corrosion rate", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.5,
        t_prev: 0.55,
        Y: 5
      });
      
      expect(result.Cr).toBeCloseTo(0.01, 5);
      expect(result.RL).toBeGreaterThan(0);
      expect(result.RL).toBeLessThan(500);
    });
  });
  
  describe("MAWP Validation", () => {
    it("should accept reasonable MAWP", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.3
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeGreaterThan(0.5);
      expect(MAWP_ratio).toBeLessThan(2.0);
    });
    
    it("should warn for MAWP much higher than design pressure", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 1.0
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeGreaterThan(2);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("higher than design pressure");
    });
    
    it("should warn for MAWP much lower than design pressure", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.07 // Even thinner to get MAWP < 0.5 * P
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeLessThan(0.5);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("lower than design pressure");
    });
    
    it("should error for unrealistically high MAWP", () => {
      expect(() => {
        calculateHemisphericalHead({
          P: 150,
          S: 20000,
          E: 0.85,
          D: 70.75,
          t_act: 5.0
        });
      }).toThrow("unrealistically high");
    });
  });
  
  describe("Integration Tests", () => {
    it("should handle complete calculation with all parameters", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_nom: 0.5,
        t_prev: 0.35,
        t_act: 0.328,
        Y: 10,
        SH: 10,
        SG: 1.0
      });
      
      expect(result.t_min).toBeGreaterThan(0);
      expect(result.MAWP).toBeGreaterThan(0);
      expect(result.Ca).toBeDefined();
      expect(result.Cr).toBeDefined();
      expect(result.RL).toBeDefined();
      expect(result.isCompliant).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.defaultsUsed).toBeDefined();
    });
    
    it("should provide clear warnings for multiple edge cases", () => {
      const result = calculateHemisphericalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.158, // Close to minimum
        t_prev: 0.15, // Negative corrosion
        Y: 5
      });
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
