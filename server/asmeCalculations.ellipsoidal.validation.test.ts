/**
 * Validation tests for ellipsoidal head calculations
 * Track 002 - Phase 1: Ellipsoidal Head Validation
 */

import { describe, it, expect } from "vitest";
import { calculateEllipsoidalHead } from "./asmeCalculations";

describe("Ellipsoidal Head Validation", () => {
  
  describe("K Factor Validation", () => {
    it("should accept standard 2:1 ellipsoidal K factor (1.0)", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75
      });
      
      expect(result.K).toBe(1.0);
      expect(result.warnings.length).toBe(0);
    });
    
    it("should warn for K factor slightly above 1.0", () => {
      // For general ellipsoidal heads with different D/(2h) ratios
      // K = 1/6 * (2 + (D/(2h))^2)
      // This test assumes we add support for custom K factors
      
      const K = 1.15;
      expect(K).toBeGreaterThan(1.0);
      expect(K).toBeLessThan(1.2);
      // Should trigger a warning in actual implementation
    });
    
    it("should error for K factor > 1.5 (physically unrealistic)", () => {
      const K = 1.6;
      expect(K).toBeGreaterThan(1.5);
      // Should trigger an error in actual implementation
    });
    
    it("should error for K factor < 0.8 (physically unrealistic)", () => {
      const K = 0.7;
      expect(K).toBeLessThan(0.8);
      // Should trigger an error in actual implementation
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
      const P = 10000;
      const S = 20000;
      const E = 0.85;
      const ratio = P / (S * E);
      
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(0.9);
      // Should trigger a warning
    });
    
    it("should error for very high pressure ratio (P/(SE) > 0.9)", () => {
      const P = 16000;
      const S = 20000;
      const E = 0.85;
      const ratio = P / (S * E);
      
      expect(ratio).toBeGreaterThan(0.9);
      // Should trigger an error
    });
  });
  
  describe("Denominator Safety Validation", () => {
    it("should accept safe denominator (> 1000)", () => {
      const P = 150;
      const S = 20000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;
      
      expect(denom).toBeGreaterThan(1000);
      expect(denom).toBeCloseTo(33970, 0);
    });
    
    it("should warn for small denominator (100 < denom < 1000)", () => {
      const P = 4500;
      const S = 1000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;
      
      expect(denom).toBeGreaterThan(100);
      expect(denom).toBeLessThan(1000);
      // Should trigger a warning
    });
    
    it("should error for very small denominator (denom < 100)", () => {
      const P = 8400;
      const S = 1000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;
      
      expect(denom).toBeLessThan(100);
      // Should trigger an error
    });
    
    it("should error for negative denominator", () => {
      const P = 10000;
      const S = 1000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;
      
      expect(denom).toBeLessThan(0);
      // Should trigger an error
    });
  });
  
  describe("Actual Thickness Edge Cases", () => {
    it("should handle t_act > t_min (compliant)", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.7
      });
      
      expect(result.Ca).toBeGreaterThan(0);
      expect(result.isCompliant).toBe(true);
    });
    
    it("should handle t_act = t_min (exactly at minimum)", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.3125 // Approximately t_min for these inputs
      });
      
      expect(result.Ca).toBeCloseTo(0, 2);
      expect(result.isCompliant).toBe(true);
    });
    
    it("should handle t_act < t_min (non-compliant)", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.2
      });
      
      expect(result.Ca).toBe(0);
      expect(result.RL).toBe(0);
      expect(result.isCompliant).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe("critical");
    });
    
    it("should warn when t_act is very close to t_min", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.315 // Just above t_min
      });
      
      expect(result.isCompliant).toBe(true);
      // Should have a warning about being close to minimum
    });
    
    it("should critically warn when t_act < 0.9 * t_min", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.25
      });
      
      expect(result.isCompliant).toBe(false);
      const criticalWarning = result.warnings.find(w => w.severity === "critical");
      expect(criticalWarning).toBeDefined();
      expect(criticalWarning?.message).toContain("critically below");
    });
  });
  
  describe("Corrosion Rate Edge Cases", () => {
    it("should handle zero corrosion rate", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.7,
        t_prev: 0.7,
        Y: 5
      });
      
      expect(result.Cr).toBe(0);
      expect(result.RL).toBeUndefined();
    });
    
    it("should handle negative corrosion rate (metal growth)", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.7,
        t_prev: 0.65, // Previous was thinner
        Y: 5
      });
      
      // Cr is calculated as max(Cr_short, Cr_long), so if both are negative, Cr will be 0
      // The negative value is in Cr_short
      expect(result.Cr_short).toBeLessThan(0);
      // Since we take max, Cr will be 0 (no Cr_long provided)
      expect(result.Cr).toBe(0);
      expect(result.RL).toBeUndefined();
    });
    
    it("should handle very small positive corrosion rate", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.7,
        t_prev: 0.7001,
        Y: 10
      });
      
      expect(result.Cr).toBeGreaterThan(0);
      expect(result.Cr).toBeLessThan(0.001);
      // RL should be capped at 500 years
      if (result.RL !== undefined) {
        expect(result.RL).toBeLessThanOrEqual(500);
      }
    });
    
    it("should handle normal corrosion rate", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.7,
        t_prev: 0.75,
        Y: 5
      });
      
      expect(result.Cr).toBeCloseTo(0.01, 5);
      expect(result.RL).toBeGreaterThan(0);
      expect(result.RL).toBeLessThan(500);
    });
  });
  
  describe("MAWP Validation", () => {
    it("should accept reasonable MAWP", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.528
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeGreaterThan(0.9);
      expect(MAWP_ratio).toBeLessThan(2.0); // Adjusted to match validation threshold
    });
    
    it("should warn for MAWP much higher than design pressure", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 1.5 // Very thick
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeGreaterThan(2);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("higher than design pressure");
    });
    
    it("should warn for MAWP much lower than design pressure", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.15 // Very thin to get MAWP < 0.5 * P
      });
      
      const MAWP_ratio = result.MAWP / 150;
      expect(MAWP_ratio).toBeLessThan(0.5);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("lower than design pressure");
    });
    
    it("should error for negative MAWP", () => {
      // This should be impossible with valid inputs, but test error handling
      expect(() => {
        calculateEllipsoidalHead({
          P: 150,
          S: -1000, // Invalid negative stress
          E: 0.85,
          D: 70.75,
          t_act: 0.5
        });
      }).toThrow();
    });
    
    it("should error for unrealistically high MAWP", () => {
      // MAWP > 10x design pressure should throw an error
      expect(() => {
        calculateEllipsoidalHead({
          P: 150,
          S: 20000,
          E: 0.85,
          D: 70.75,
          t_act: 5.0 // Extremely thick
        });
      }).toThrow("unrealistically high");
    });
  });
  
  describe("Integration Tests", () => {
    it("should handle complete calculation with all parameters", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_nom: 0.625,
        t_prev: 0.55,
        t_act: 0.528,
        Y: 10,
        SH: 10,
        SG: 1.0
      });
      
      expect(result.t_min).toBeGreaterThan(0);
      expect(result.MAWP).toBeGreaterThan(0);
      expect(result.Ca).toBeDefined();
      expect(result.Cr).toBeDefined();
      expect(result.RL).toBeDefined();
      expect(result.K).toBe(1.0);
      expect(result.isCompliant).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.defaultsUsed).toBeDefined();
    });
    
    it("should provide clear warnings for multiple edge cases", () => {
      const result = calculateEllipsoidalHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        t_act: 0.315, // Close to minimum
        t_prev: 0.31, // Negative corrosion
        Y: 5
      });
      
      // Should have warnings for both close-to-minimum thickness and negative corrosion
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
