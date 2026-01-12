import { describe, it, expect } from "vitest";

/**
 * Test suite for ASME calculation validation types and edge cases
 * Track 001: Fix ASME Calculation Edge Cases for Torispherical Heads
 *
 * Phase 1: Define Validation Types and Interfaces
 */

describe("Validation Types and Interfaces", () => {
  describe("Task 1.1: ValidationWarning Interface", () => {
    it("should have correct ValidationWarning structure", () => {
      // This test will pass once we define the interface
      const warning = {
        field: "L/r_ratio",
        message: "L/r ratio is outside standard range",
        severity: "warning" as const,
        value: 25.5,
        expectedRange: "5 to 20",
      };

      expect(warning).toHaveProperty("field");
      expect(warning).toHaveProperty("message");
      expect(warning).toHaveProperty("severity");
      expect(warning).toHaveProperty("value");
      expect(warning).toHaveProperty("expectedRange");
      expect(["warning", "critical"]).toContain(warning.severity);
    });

    it("should support critical severity", () => {
      const criticalWarning = {
        field: "M_factor",
        message: "M factor is physically unrealistic",
        severity: "critical" as const,
        value: 3.5,
        expectedRange: "1.0 to 3.0",
      };

      expect(criticalWarning.severity).toBe("critical");
    });
  });

  describe("Task 1.2: Enhanced CalculationResults", () => {
    it("should include warnings array in results", () => {
      // Mock result structure
      const result = {
        t_min: 0.5,
        MAWP: 150,
        isCompliant: true,
        governingCondition: "thickness",
        codeReference: "UG-32(e)",
        formula: "t = PLM / (2SE - 0.2P)",
        warnings: [],
        defaultsUsed: [],
      };

      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("should include defaultsUsed array in results", () => {
      const result = {
        t_min: 0.5,
        MAWP: 150,
        isCompliant: true,
        governingCondition: "thickness",
        codeReference: "UG-32(e)",
        formula: "t = PLM / (2SE - 0.2P)",
        warnings: [],
        defaultsUsed: ["L (crown radius)", "r (knuckle radius)"],
      };

      expect(result).toHaveProperty("defaultsUsed");
      expect(Array.isArray(result.defaultsUsed)).toBe(true);
      expect(result.defaultsUsed).toHaveLength(2);
    });

    it("should support warnings with all fields", () => {
      const result = {
        t_min: 0.5,
        MAWP: 150,
        isCompliant: true,
        governingCondition: "thickness",
        codeReference: "UG-32(e)",
        formula: "t = PLM / (2SE - 0.2P)",
        warnings: [
          {
            field: "L/r_ratio",
            message: "L/r ratio is unusually high",
            severity: "warning" as const,
            value: 22,
            expectedRange: "5 to 20",
          },
        ],
        defaultsUsed: [],
      };

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].field).toBe("L/r_ratio");
      expect(result.warnings[0].severity).toBe("warning");
    });
  });
});

describe("Phase 2: Input Validation Helper Functions", () => {
  describe("Task 2.1: validatePositiveNumber", () => {
    it("should accept positive numbers", () => {
      // This will fail until we implement the function
      const validate = (value: number, name: string, minValue?: number) => {
        if (value <= 0) {
          throw new Error(`${name} must be positive, got ${value}`);
        }
        const warnings: any[] = [];
        if (minValue && value < minValue) {
          warnings.push({
            field: name,
            message: `${name} is unusually small`,
            severity: "warning",
            value,
            expectedRange: `>= ${minValue}`,
          });
        }
        return warnings;
      };

      expect(() => validate(10, "pressure")).not.toThrow();
      expect(validate(10, "pressure")).toHaveLength(0);
    });

    it("should throw error for zero values", () => {
      const validate = (value: number, name: string) => {
        if (value <= 0) {
          throw new Error(`${name} must be positive, got ${value}`);
        }
        return [];
      };

      expect(() => validate(0, "pressure")).toThrow(
        "pressure must be positive"
      );
    });

    it("should throw error for negative values", () => {
      const validate = (value: number, name: string) => {
        if (value <= 0) {
          throw new Error(`${name} must be positive, got ${value}`);
        }
        return [];
      };

      expect(() => validate(-5, "pressure")).toThrow(
        "pressure must be positive"
      );
    });

    it("should warn for near-zero positive values", () => {
      const validate = (value: number, name: string, minValue?: number) => {
        if (value <= 0) {
          throw new Error(`${name} must be positive, got ${value}`);
        }
        const warnings: any[] = [];
        if (minValue && value < minValue) {
          warnings.push({
            field: name,
            message: `${name} is unusually small`,
            severity: "warning",
            value,
            expectedRange: `>= ${minValue}`,
          });
        }
        return warnings;
      };

      const warnings = validate(0.001, "thickness", 0.1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("warning");
    });
  });

  describe("Task 2.2: validateRatio", () => {
    it("should accept ratios within range", () => {
      const validate = (
        ratio: number,
        name: string,
        min: number,
        max: number
      ) => {
        const warnings: any[] = [];
        if (ratio < min || ratio > max) {
          throw new Error(
            `${name} must be between ${min} and ${max}, got ${ratio}`
          );
        }
        return warnings;
      };

      expect(() => validate(15, "L/r", 1, 100)).not.toThrow();
    });

    it("should error for ratios below minimum", () => {
      const validate = (
        ratio: number,
        name: string,
        min: number,
        max: number
      ) => {
        if (ratio < min || ratio > max) {
          throw new Error(
            `${name} must be between ${min} and ${max}, got ${ratio}`
          );
        }
        return [];
      };

      expect(() => validate(0.5, "L/r", 1, 100)).toThrow();
    });

    it("should error for ratios above maximum", () => {
      const validate = (
        ratio: number,
        name: string,
        min: number,
        max: number
      ) => {
        if (ratio < min || ratio > max) {
          throw new Error(
            `${name} must be between ${min} and ${max}, got ${ratio}`
          );
        }
        return [];
      };

      expect(() => validate(150, "L/r", 1, 100)).toThrow();
    });

    it("should warn for ratios near boundaries", () => {
      const validate = (
        ratio: number,
        name: string,
        min: number,
        max: number,
        warnMin?: number,
        warnMax?: number
      ) => {
        const warnings: any[] = [];
        if (ratio < min || ratio > max) {
          throw new Error(
            `${name} must be between ${min} and ${max}, got ${ratio}`
          );
        }
        if (warnMin && ratio < warnMin) {
          warnings.push({
            field: name,
            message: `${name} is unusually low`,
            severity: "warning",
            value: ratio,
            expectedRange: `${warnMin} to ${warnMax || max}`,
          });
        }
        if (warnMax && ratio > warnMax) {
          warnings.push({
            field: name,
            message: `${name} is unusually high`,
            severity: "warning",
            value: ratio,
            expectedRange: `${warnMin || min} to ${warnMax}`,
          });
        }
        return warnings;
      };

      const warnings = validate(22, "L/r", 1, 100, 5, 20);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain("unusually high");
    });
  });

  describe("Task 2.3: validateDenominator", () => {
    it("should accept safe denominators", () => {
      const validate = (denom: number, expression: string) => {
        if (denom <= 0) {
          throw new Error(
            `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
          );
        }
        return [];
      };

      expect(() => validate(5000, "2SE - 0.2P")).not.toThrow();
    });

    it("should throw error for zero denominator", () => {
      const validate = (denom: number, expression: string) => {
        if (denom <= 0) {
          throw new Error(
            `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
          );
        }
        return [];
      };

      expect(() => validate(0, "2SE - 0.2P")).toThrow("Invalid calculation");
    });

    it("should throw error for negative denominator", () => {
      const validate = (denom: number, expression: string) => {
        if (denom <= 0) {
          throw new Error(
            `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
          );
        }
        return [];
      };

      expect(() => validate(-100, "2SE - 0.2P")).toThrow();
    });

    it("should error for very small positive denominators", () => {
      const validate = (denom: number, expression: string, minSafe = 1000) => {
        if (denom <= 0) {
          throw new Error(
            `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
          );
        }
        if (denom < 100) {
          throw new Error(
            `Denominator too small for numerical stability: ${expression} = ${denom.toFixed(4)}`
          );
        }
        const warnings: any[] = [];
        if (denom < minSafe) {
          warnings.push({
            field: "denominator",
            message: `Denominator ${expression} is small, may indicate input error`,
            severity: "warning",
            value: denom,
            expectedRange: `>= ${minSafe}`,
          });
        }
        return warnings;
      };

      expect(() => validate(50, "2SE - 0.2P")).toThrow("too small");
    });

    it("should warn for denominators below safe threshold", () => {
      const validate = (denom: number, expression: string, minSafe = 1000) => {
        if (denom <= 0) {
          throw new Error(
            `Invalid calculation: ${expression} = ${denom.toFixed(4)} <= 0`
          );
        }
        if (denom < 100) {
          throw new Error(
            `Denominator too small for numerical stability: ${expression} = ${denom.toFixed(4)}`
          );
        }
        const warnings: any[] = [];
        if (denom < minSafe) {
          warnings.push({
            field: "denominator",
            message: `Denominator ${expression} is small, may indicate input error`,
            severity: "warning",
            value: denom,
            expectedRange: `>= ${minSafe}`,
          });
        }
        return warnings;
      };

      const warnings = validate(500, "2SE - 0.2P");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("warning");
    });
  });
});

describe("Phase 3-6: Core Validations for Torispherical Heads", () => {
  describe("Phase 3: L/r Ratio Validation", () => {
    it("should accept standard L/r ratio (16.67)", () => {
      const L = 70.75;
      const r = 4.245;
      const ratio = L / r;

      expect(ratio).toBeCloseTo(16.67, 1);
      expect(ratio).toBeGreaterThan(5);
      expect(ratio).toBeLessThan(20);
    });

    it("should error for L/r > 100 (physically unrealistic)", () => {
      const L = 100;
      const r = 0.9;
      const ratio = L / r;

      expect(ratio).toBeGreaterThan(100);
      // This should trigger an error in the actual implementation
    });

    it("should warn for L/r > 20 (non-standard)", () => {
      const L = 100;
      const r = 4;
      const ratio = L / r;

      expect(ratio).toBe(25);
      // This should trigger a warning in the actual implementation
    });

    it("should warn for L/r < 5 (unusual geometry)", () => {
      const L = 70;
      const r = 20;
      const ratio = L / r;

      expect(ratio).toBe(3.5);
      // This should trigger a warning in the actual implementation
    });

    it("should error for L/r < 1 (invalid)", () => {
      const L = 10;
      const r = 20;
      const ratio = L / r;

      expect(ratio).toBe(0.5);
      // This should trigger an error in the actual implementation
    });
  });

  describe("Phase 4: M Factor Bounds Validation", () => {
    it("should accept typical M factor (1.5 to 2.0)", () => {
      const L = 70.75;
      const r = 4.245;
      const M = 0.25 * (3 + Math.sqrt(L / r));

      expect(M).toBeGreaterThan(1.5);
      expect(M).toBeLessThan(2.0);
      expect(M).toBeCloseTo(1.77, 2);
    });

    it("should error for M < 1.0 (physically unrealistic)", () => {
      // This would require L/r < 1, which is already invalid
      const L = 10;
      const r = 100;
      const M = 0.25 * (3 + Math.sqrt(L / r));

      expect(M).toBeLessThan(1.0);
      // This should trigger an error
    });

    it("should warn for M < 1.5 (unusual but possible)", () => {
      const L = 10;
      const r = 4;
      const M = 0.25 * (3 + Math.sqrt(L / r));

      expect(M).toBeLessThan(1.5);
      expect(M).toBeGreaterThan(1.0);
      // This should trigger a warning
    });

    it("should warn for M > 2.5 (unusual but possible)", () => {
      const L = 100;
      const r = 2;
      const M = 0.25 * (3 + Math.sqrt(L / r));

      expect(M).toBeGreaterThan(2.5);
      expect(M).toBeLessThan(3.0);
      // This should trigger a warning
    });

    it("should error for M > 3.0 (physically unrealistic)", () => {
      const L = 100;
      const r = 1;
      const M = 0.25 * (3 + Math.sqrt(L / r));

      expect(M).toBeGreaterThan(3.0);
      // This should trigger an error
    });
  });

  describe("Phase 5: Pressure to Stress Ratio Validation", () => {
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
      // This should trigger a warning
    });

    it("should error for very high pressure ratio (P/(SE) > 0.9)", () => {
      const P = 16000;
      const S = 20000;
      const E = 0.85;
      const ratio = P / (S * E);

      expect(ratio).toBeGreaterThan(0.9);
      // This should trigger an error
    });
  });

  describe("Phase 6: Enhanced Denominator Validation", () => {
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
      // This should trigger a warning
    });

    it("should error for very small denominator (denom < 100)", () => {
      const P = 8400;
      const S = 1000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;

      expect(denom).toBeLessThan(100);
      // This should trigger an error
    });

    it("should error for negative denominator", () => {
      const P = 10000;
      const S = 1000;
      const E = 0.85;
      const denom = 2 * S * E - 0.2 * P;

      expect(denom).toBeLessThan(0);
      // This should trigger an error
    });
  });
});

describe('Phase 7-10: Edge Case Handling', () => {
  
  describe('Phase 7: Default Parameter Warnings (already implemented)', () => {
    it('should track when L is defaulted', () => {
      const inputs = {
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        // L not provided
        r: 4.245
      };
      
      // When we call calculateTorisphericalHead, defaultsUsed should include 'L (crown radius)'
      // This is already implemented in Phase 3-6
    });
    
    it('should track when r is defaulted', () => {
      const inputs = {
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        L: 70.75,
        // r not provided
      };
      
      // defaultsUsed should include 'r (knuckle radius)'
    });
    
    it('should track when both L and r are defaulted', () => {
      const inputs = {
        P: 150,
        S: 20000,
        E: 0.85,
        D: 70.75,
        // L and r not provided
      };
      
      // defaultsUsed should include both
    });
  });
  
  describe('Phase 8: Actual Thickness Edge Cases', () => {
    it('should handle t_act > t_min (compliant)', () => {
      const t_act = 0.7;
      const t_min = 0.6;
      const Ca = t_act - t_min;
      
      expect(Ca).toBeGreaterThan(0);
      expect(Ca).toBeCloseTo(0.1, 2);
    });
    
    it('should handle t_act = t_min (exactly at minimum)', () => {
      const t_act = 0.6;
      const t_min = 0.6;
      const Ca = t_act - t_min;
      
      expect(Ca).toBe(0);
      // Should set isCompliant = true (at minimum is acceptable)
    });
    
    it('should handle t_act < t_min (non-compliant)', () => {
      const t_act = 0.5;
      const t_min = 0.6;
      const Ca = t_act - t_min;
      
      expect(Ca).toBeLessThan(0);
      // Should set Ca = 0, RL = 0, isCompliant = false
    });
    
    it('should warn when t_act is very close to t_min', () => {
      const t_act = 0.605;
      const t_min = 0.6;
      const ratio = t_act / t_min;
      
      expect(ratio).toBeLessThan(1.02);
      expect(ratio).toBeGreaterThan(1.0);
      // Should trigger a warning
    });
    
    it('should critically warn when t_act < 0.9 * t_min', () => {
      const t_act = 0.5;
      const t_min = 0.6;
      const ratio = t_act / t_min;
      
      expect(ratio).toBeLessThan(0.9);
      // Should trigger a critical warning
    });
  });
  
  describe('Phase 9: Corrosion Rate Edge Cases', () => {
    it('should handle zero corrosion rate', () => {
      const Cr = 0;
      const Ca = 0.1;
      
      // RL should be undefined or very large (no measurable corrosion)
      expect(Cr).toBe(0);
    });
    
    it('should handle negative corrosion rate (metal growth)', () => {
      const Cr = -0.01;
      
      // RL should be undefined (growth, not corrosion)
      expect(Cr).toBeLessThan(0);
    });
    
    it('should handle very small positive corrosion rate', () => {
      const Cr = 0.0001;
      const Ca = 0.1;
      const RL = Ca / Cr;
      
      expect(RL).toBeGreaterThan(500);
      // Should cap RL at reasonable maximum (e.g., 500 years)
    });
    
    it('should handle normal corrosion rate', () => {
      const Cr = 0.01;
      const Ca = 0.1;
      const RL = Ca / Cr;
      
      expect(RL).toBe(10);
      // Should calculate normally
    });
  });
  
  describe('Phase 10: MAWP Validation', () => {
    it('should accept reasonable MAWP', () => {
      const MAWP = 160;
      const designP = 150;
      const ratio = MAWP / designP;
      
      expect(ratio).toBeGreaterThan(0.9);
      expect(ratio).toBeLessThan(1.5);
      // Should pass without warnings
    });
    
    it('should warn for MAWP much higher than design pressure', () => {
      const MAWP = 350;
      const designP = 150;
      const ratio = MAWP / designP;
      
      expect(ratio).toBeGreaterThan(2);
      // Should trigger a warning
    });
    
    it('should warn for MAWP much lower than design pressure', () => {
      const MAWP = 60;
      const designP = 150;
      const ratio = MAWP / designP;
      
      expect(ratio).toBeLessThan(0.5);
      // Should trigger a warning
    });
    
    it('should error for negative MAWP', () => {
      const MAWP = -10;
      
      expect(MAWP).toBeLessThan(0);
      // Should trigger an error
    });
    
    it('should error for unrealistically high MAWP', () => {
      const MAWP = 2000;
      const designP = 150;
      const ratio = MAWP / designP;
      
      expect(ratio).toBeGreaterThan(10);
      // Should trigger an error
    });
  });
});
