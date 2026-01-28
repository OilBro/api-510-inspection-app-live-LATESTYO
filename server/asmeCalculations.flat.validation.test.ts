/**
 * Validation tests for flat head calculations
 * Track 002 - Phase 3: Flat Head Validation
 */

import { describe, it, expect } from "vitest";
import { calculateFlatHead } from "./asmeCalculations";

describe("Flat Head Validation", () => {
  
  describe("C Factor Validation", () => {
    it("should accept valid C factor (0.10 to 0.33)", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.25
      });
      
      expect(result.t_min).toBeGreaterThan(0);
    });
    
    it("should track when C uses default value (0.33)", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        d: 24
        // C not provided, should use default
      });
      
      // Updated: Now includes UG-34 reference in default message
      expect(result.defaultsUsed).toContain("C (attachment factor) = 0.33 (conservative default per UG-34)");
      expect(result.formula).toContain("C = 0.33");
    });
    
    it("should warn for C factor outside typical range", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.05 // Below typical range
      });
      
      const warning = result.warnings.find(w => w.field === "C");
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe("warning");
    });
    
    it("should error for C factor > 0.5", () => {
      expect(() => {
        calculateFlatHead({
          P: 150,
          S: 20000,
          E: 0.85,
          d: 24,
          C: 0.6
        });
      }).toThrow("C factor");
    });
  });
  
  describe("d/D Ratio Validation", () => {
    it("should track when d is calculated from D", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 24
        // d not provided, should use D
      });
      
      expect(result.defaultsUsed).toContain("d (diameter)");
    });
    
    it("should accept reasonable d/D ratio", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 24,
        d: 20 // d < D is typical
      });
      
      expect(result.t_min).toBeGreaterThan(0);
    });
    
    it("should warn when d > D (unusual)", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        D: 24,
        d: 30 // d > D is unusual
      });
      
      const warning = result.warnings.find(w => w.field === "d/D");
      expect(warning).toBeDefined();
    });
  });
  
  describe("Pressure Validation for Flat Heads", () => {
    it("should accept low pressure (< 15 psi)", () => {
      const result = calculateFlatHead({
        P: 10,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33
      });
      
      expect(result.t_min).toBeGreaterThan(0);
    });
    
    it("should warn for moderate pressure (15-50 psi)", () => {
      const result = calculateFlatHead({
        P: 30,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33
      });
      
      const warning = result.warnings.find(w => w.field === "P");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("Flat heads are typically used for low pressure");
    });
    
    it("should critically warn for high pressure (> 50 psi)", () => {
      const result = calculateFlatHead({
        P: 75,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33
      });
      
      const warning = result.warnings.find(w => w.field === "P" && w.severity === "critical");
      expect(warning).toBeDefined();
    });
    
    it("should error for very high pressure (> 150 psi)", () => {
      expect(() => {
        calculateFlatHead({
          P: 200,
          S: 20000,
          E: 0.85,
          d: 24,
          C: 0.33
        });
      }).toThrow("Flat heads are not suitable");
    });
  });
  
  describe("Sqrt Argument Validation", () => {
    it("should accept positive sqrt argument", () => {
      const result = calculateFlatHead({
        P: 150,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33
      });
      
      expect(result.t_min).toBeGreaterThan(0);
      expect(result.t_min).not.toBeNaN();
    });
    
    it("should error for negative sqrt argument", () => {
      expect(() => {
        calculateFlatHead({
          P: -10,
          S: 20000,
          E: 0.85,
          d: 24,
          C: 0.33
        });
      }).toThrow();
    });
  });
  
  describe("Actual Thickness Edge Cases", () => {
    it("should handle t_act > t_min (compliant)", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.5
      });
      
      expect(result.Ca).toBeGreaterThan(0);
      expect(result.isCompliant).toBe(true);
    });
    
    it("should handle t_act < t_min (non-compliant)", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.1
      });
      
      expect(result.isCompliant).toBe(false);
      const criticalWarning = result.warnings.find(w => w.severity === "critical");
      expect(criticalWarning).toBeDefined();
    });
    
    it("should warn when t_act is very close to t_min", () => {
      // t_min = d * sqrt(CP/SE) = 24 * sqrt(0.33*15/(20000*0.85)) = 24 * sqrt(0.000291) = 24 * 0.01706 = 0.4094
      // For warning, need t_act < 1.02 * t_min = 0.4176
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.415 // Just above t_min but within 2%
      });
      
      expect(result.isCompliant).toBe(true);
      const warning = result.warnings.find(w => w.field === "t_act");
      expect(warning).toBeDefined();
    });
    
    it("should critically warn when t_act < 0.9 * t_min", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.14
      });
      
      expect(result.isCompliant).toBe(false);
      const criticalWarning = result.warnings.find(w => w.severity === "critical");
      expect(criticalWarning).toBeDefined();
      expect(criticalWarning?.message).toContain("critically below");
    });
  });
  
  describe("MAWP Validation", () => {
    it("should accept reasonable MAWP", () => {
      // MAWP = SE*(t/d)^2/C = 20000*0.85*(0.5/24)^2/0.33 = 17000*0.000434/0.33 = 22.4 psi
      // MAWP_ratio = 22.4/15 = 1.49 (within 0.5 to 2.0)
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.5 // Thicker to get MAWP > 0.5*P
      });
      
      const MAWP_ratio = result.MAWP / 15;
      expect(MAWP_ratio).toBeGreaterThan(0.5);
      expect(MAWP_ratio).toBeLessThan(2.0);
    });
    
    it("should warn for MAWP much higher than design pressure", () => {
      // Need MAWP > 2*P = 30 psi
      // MAWP = SE*(t/d)^2/C, so need t/d = sqrt(MAWP*C/(SE))
      // For MAWP = 30: t/d = sqrt(30*0.33/(17000)) = sqrt(0.000582) = 0.0241
      // t = 0.0241 * 24 = 0.578
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.7 // Thicker to get MAWP > 2*P
      });
      
      const MAWP_ratio = result.MAWP / 15;
      expect(MAWP_ratio).toBeGreaterThan(2);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("higher than design pressure");
    });
    
    it("should warn for MAWP much lower than design pressure", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.33,
        t_act: 0.12
      });
      
      const MAWP_ratio = result.MAWP / 15;
      expect(MAWP_ratio).toBeLessThan(0.5);
      const warning = result.warnings.find(w => w.field === "MAWP");
      expect(warning).toBeDefined();
      expect(warning?.message).toContain("lower than design pressure");
    });
    
    it("should error for unrealistically high MAWP", () => {
      expect(() => {
        calculateFlatHead({
          P: 15,
          S: 20000,
          E: 0.85,
          d: 24,
          C: 0.33,
          t_act: 2.0
        });
      }).toThrow("unrealistically high");
    });
  });
  
  describe("Integration Tests", () => {
    it("should handle complete calculation with all parameters", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        D: 24,
        d: 22,
        C: 0.25,
        t_act: 0.3
      });
      
      expect(result.t_min).toBeGreaterThan(0);
      expect(result.MAWP).toBeGreaterThan(0);
      expect(result.Ca).toBeDefined();
      expect(result.isCompliant).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.defaultsUsed).toBeDefined();
    });
    
    it("should provide clear warnings for multiple edge cases", () => {
      const result = calculateFlatHead({
        P: 40, // High for flat head
        S: 20000,
        E: 0.85,
        d: 24,
        C: 0.08, // Low C factor
        t_act: 0.17 // Close to minimum
      });
      
      expect(result.warnings.length).toBeGreaterThan(0);
      // Should have warnings for: high P, low C, close to t_min
      expect(result.warnings.some(w => w.field === "P")).toBe(true);
      expect(result.warnings.some(w => w.field === "C")).toBe(true);
    });
    
    it("should handle default values correctly", () => {
      const result = calculateFlatHead({
        P: 15,
        S: 20000,
        E: 0.85,
        D: 24
        // d and C not provided, should use defaults
      });
      
      expect(result.defaultsUsed.length).toBeGreaterThanOrEqual(2);
      expect(result.defaultsUsed).toContain("d (diameter)");
      // Updated: Now includes UG-34 reference in default message
      expect(result.defaultsUsed).toContain("C (attachment factor) = 0.33 (conservative default per UG-34)");
    });
  });
});
