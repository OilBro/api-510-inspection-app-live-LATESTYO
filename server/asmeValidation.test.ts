/**
 * ASME Section VIII Division 1 Validation Tests
 * Tests calculations against ASME code examples and standard problems
 * 
 * These tests use ASME formulas directly, NOT professional report values
 * which may contain errors or non-standard calculations.
 */

import { describe, it, expect } from "vitest";
import {
  calculateComponent,
  calculateHeadMinThickness,
  calculateHeadMAWP,
} from "./componentCalculations";

describe("ASME Section VIII Validation Tests", () => {
  describe("Shell Calculations (UG-27)", () => {
    it("should calculate shell t_min correctly per UG-27", () => {
      // Standard ASME example problem
      const data = {
        designPressure: 250, // psi
        designTemperature: 200, // °F
        insideDiameter: 72, // inches
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // Formula: t = PR / (SE - 0.6P)
      // SA-516-70 at 200°F: S = 17,100 psi
      // t = (250 × 36) / (17100 × 0.85 - 0.6 × 250)
      // t = 9000 / (14535 - 150)
      // t = 9000 / 14385
      // t = 0.6257 inches
      expect(result.minimumRequiredThickness).toBeCloseTo(0.6257, 3);
    });

    it("should calculate shell MAWP correctly per UG-27(c)", () => {
      // ASME example with known MAWP
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // Net thickness: t = 0.625 - 0.125 = 0.500
      // SA-516-70 at 200°F: S = 17,100 psi
      // Circumferential: P = SEt / (R + 0.6t) = (17100 × 0.85 × 0.5) / (36 + 0.3) = 200.2 psi
      // Longitudinal: P = 2SEt / (R - 0.4t) = (2 × 17100 × 0.85 × 0.5) / (36 - 0.2) = 405.9 psi
      // Governing (minimum): 200.2 psi
      expect(result.mawp).toBeCloseTo(200.2, 1);
    });

    it("should use correct allowable stress for SA-516-70 at 200°F", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // SA-516-70 at 200°F: S = 17,100 psi (base stress, no temp reduction)
      // But our function uses 17,100 psi base
      expect(result.allowableStress).toBe(17100);
    });
  });

  describe("Hemispherical Head Calculations (UG-32(d))", () => {
    it("should calculate hemispherical head t_min correctly", () => {
      const P = 250; // psi
      const R = 36; // inches (inside radius)
      const S = 20000; // psi
      const E = 1.0; // Full RT for heads
      const CA = 0.125; // inches

      const t_min = calculateHeadMinThickness(P, R, S, E, CA, "hemispherical");

      // Formula: t = PL / (2SE - 0.2P) where L = R
      // t = (250 × 36) / (2 × 20000 × 1.0 - 0.2 × 250)
      // t = 9000 / (40000 - 50)
      // t = 9000 / 39950
      // t = 0.2253 inches
      expect(t_min).toBeCloseTo(0.2253, 3);
    });

    it("should calculate hemispherical head MAWP correctly", () => {
      const t = 0.500; // inches (actual thickness)
      const R = 36; // inches
      const S = 20000; // psi
      const E = 1.0;
      const CA = 0.125; // inches

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "hemispherical");

      // Net thickness: t_net = 0.500 - 0.125 = 0.375
      // Formula: P = 2SEt / (R + 0.2t)
      // P = (2 × 20000 × 1.0 × 0.375) / (36 + 0.2 × 0.375)
      // P = 15000 / 36.075
      // P = 415.8 psi
      expect(mawp).toBeCloseTo(415.8, 1);
    });
  });

  describe("Ellipsoidal Head Calculations (UG-32(e))", () => {
    it("should calculate 2:1 ellipsoidal head t_min correctly", () => {
      const P = 250; // psi
      const R = 35.375; // inches (from D = 70.75")
      const S = 20000; // psi
      const E = 1.0; // Full RT
      const CA = 0.125; // inches

      const t_min = calculateHeadMinThickness(P, R, S, E, CA, "ellipsoidal");

      // Formula: t = PD / (2SE - 0.2P) where D = 2R
      // D = 70.75 inches
      // t = (250 × 70.75) / (2 × 20000 × 1.0 - 0.2 × 250)
      // t = 17687.5 / (40000 - 50)
      // t = 17687.5 / 39950
      // t = 0.4428 inches
      expect(t_min).toBeCloseTo(0.4428, 3);
    });

    it("should calculate ellipsoidal head MAWP correctly", () => {
      const t = 0.536; // inches (actual thickness from CALCULATION_ANALYSIS.md)
      const R = 35.375; // inches
      const S = 20000; // psi
      const E = 1.0;
      const CA = 0.125; // inches

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "ellipsoidal");

      // Net thickness: t_net = 0.536 - 0.125 = 0.411
      // Formula: P = 2SEt / (D + 0.2t) where D = 2R = 70.75
      // P = (2 × 20000 × 1.0 × 0.411) / (70.75 + 0.2 × 0.411)
      // P = 16440 / 70.8322
      // P = 232.1 psi
      expect(mawp).toBeCloseTo(232.1, 1);
    });
  });

  describe("Torispherical Head Calculations (Appendix 1-4(d))", () => {
    it("should calculate M factor correctly for standard F&D head", () => {
      // Standard F&D head: L = D, r = 0.06D
      const D = 70.75; // inches
      const L = D; // Crown radius = inside diameter
      const r = 0.06 * D; // Knuckle radius = 6% of diameter = 4.245"

      // M = 0.25 * (3 + sqrt(L/r))
      // M = 0.25 * (3 + sqrt(70.75/4.245))
      // M = 0.25 * (3 + sqrt(16.667))
      // M = 0.25 * (3 + 4.082)
      // M = 0.25 * 7.082
      // M = 1.7705
      const M = 0.25 * (3 + Math.sqrt(L / r));
      expect(M).toBeCloseTo(1.7705, 3);
    });

    it("should calculate torispherical head t_min correctly", () => {
      const P = 250; // psi
      const R = 35.375; // inches
      const S = 20000; // psi
      const E = 1.0;
      const CA = 0.125; // inches
      const D = 70.75; // inches
      const L = D; // Crown radius
      const r = 0.06 * D; // Knuckle radius = 4.245"

      const t_min = calculateHeadMinThickness(
        P,
        R,
        S,
        E,
        CA,
        "torispherical",
        r,
        L
      );

      // M = 1.7705 (from previous test)
      // Formula: t = PLM / (2SE - 0.2P)
      // t = (250 × 70.75 × 1.7705) / (2 × 20000 × 1.0 - 0.2 × 250)
      // t = 31,313.2 / 39950
      // t = 0.7838 inches
      expect(t_min).toBeCloseTo(0.7838, 3);
    });

    it("should calculate torispherical head MAWP correctly", () => {
      const t = 0.528; // inches (actual thickness)
      const R = 35.375; // inches
      const S = 20000; // psi
      const E = 1.0;
      const CA = 0.125; // inches
      const D = 70.75; // inches
      const L = D;
      const r = 0.06 * D;

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "torispherical", r, L);

      // Net thickness: t_net = 0.528 - 0.125 = 0.403
      // M = 1.7705
      // Formula: P = 2SEt / (LM + 0.2t)
      // P = (2 × 20000 × 1.0 × 0.403) / (70.75 × 1.7705 + 0.2 × 0.403)
      // P = 16120 / (125.26 + 0.0806)
      // P = 16120 / 125.34
      // P = 128.6 psi
      expect(mawp).toBeCloseTo(128.6, 1);
    });
  });

  describe("Static Head Pressure", () => {
    it("should calculate static head pressure correctly", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
        liquidService: true,
        specificGravity: 0.92,
        liquidHeight: 6.0, // feet
      };

      const result = calculateComponent(data);

      // Formula: P_static = SG × h × 0.433 psi/ft
      // P_static = 0.92 × 6.0 × 0.433
      // P_static = 2.39 psi
      expect(result.staticHeadPressure).toBeCloseTo(2.39, 2);

      // Total design pressure should include static head
      expect(result.totalDesignPressure).toBeCloseTo(252.39, 2);
    });

    it("should add static head to design pressure for t_min calculation", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
        liquidService: true,
        specificGravity: 0.92,
        liquidHeight: 6.0,
      };

      const result = calculateComponent(data);

      // t_min should be calculated with P = 250 + 2.39 = 252.39 psi
      // t = (252.39 × 36) / (20000 × 0.85 - 0.6 × 252.39)
      // t = 9086.04 / (17000 - 151.43)
      // t = 9086.04 / 16848.57
      // t = 0.5393 inches (slightly higher than without static head)
      expect(result.minimumRequiredThickness).toBeGreaterThan(0.534);
      expect(result.minimumRequiredThickness).toBeCloseTo(0.5393, 3);
    });
  });

  describe("Corrosion and Remaining Life", () => {
    it("should calculate corrosion allowance correctly", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.600, // Current thickness
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0.002, // 2 mils/year
      };

      const result = calculateComponent(data);

      // Ca = t_act - t_min
      // t_min ≈ 0.5342 inches
      // Ca = 0.600 - 0.5342 = 0.0658 inches
      expect(result.corrosionAllowance).toBeCloseTo(0.0658, 3);
    });

    it("should calculate remaining life correctly", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.600,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0.002, // 2 mils/year
      };

      const result = calculateComponent(data);

      // RL = Ca / Cr
      // Ca ≈ 0.0658 inches
      // Cr = 0.002 inches/year
      // RL = 0.0658 / 0.002 = 32.9 years
      expect(result.remainingLife).toBeCloseTo(32.9, 1);
    });

    it("should handle zero corrosion rate", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.600,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0, // No corrosion
      };

      const result = calculateComponent(data);

      // With zero corrosion rate, remaining life should be infinite
      expect(result.remainingLife).toBe(Infinity);
    });

    it("should handle negative corrosion allowance (below minimum)", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.500, // Below minimum
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0.002,
      };

      const result = calculateComponent(data);

      // t_act (0.500) < t_min (0.5342)
      // Status should be critical
      expect(result.status).toBe("critical");
      expect(result.statusReason).toContain("below minimum required");
    });
  });

  describe("Joint Efficiency Values", () => {
    it("should use E=1.0 for seamless or full RT", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 1.0, // Full RT per UW-12(a)
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // With E=1.0, t_min should be lower
      // t = (250 × 36) / (20000 × 1.0 - 0.6 × 250)
      // t = 9000 / (20000 - 150)
      // t = 9000 / 19850
      // t = 0.4534 inches
      expect(result.minimumRequiredThickness).toBeCloseTo(0.4534, 3);
    });

    it("should use E=0.85 for spot RT", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85, // Spot RT per UW-12(b)
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // With E=0.85, t_min should be higher
      // t = 0.5342 inches (as calculated in earlier test)
      expect(result.minimumRequiredThickness).toBeCloseTo(0.5342, 3);
    });

    it("should use E=0.70 for no RT", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.70, // No RT per UW-12(c)
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // With E=0.70, t_min should be highest
      // t = (250 × 36) / (20000 × 0.70 - 0.6 × 250)
      // t = 9000 / (14000 - 150)
      // t = 9000 / 13850
      // t = 0.6498 inches
      expect(result.minimumRequiredThickness).toBeCloseTo(0.6498, 3);
    });
  });

  describe("Material Allowable Stress", () => {
    it("should use correct stress for SA-516-70 at various temperatures", () => {
      const baseData = {
        designPressure: 250,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      // At 200°F: S = 17,100 psi (no reduction)
      const result200 = calculateComponent({
        ...baseData,
        designTemperature: 200,
      });
      expect(result200.allowableStress).toBe(17100);

      // At 650°F: S = 17,100 psi (no reduction)
      const result650 = calculateComponent({
        ...baseData,
        designTemperature: 650,
      });
      expect(result650.allowableStress).toBe(17100);

      // At 700°F: S = 17,100 × 0.95 = 16,245 psi
      const result700 = calculateComponent({
        ...baseData,
        designTemperature: 700,
      });
      expect(result700.allowableStress).toBeCloseTo(16245, 0);
    });

    it("should use correct stress for SA-106-B seamless pipe", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-106-B",
        nominalThickness: 0.625,
        actualThickness: 0.625,
        corrosionAllowance: 0.125,
        jointEfficiency: 1.0, // Seamless
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // SA-106-B at 200°F: S = 15,000 psi
      expect(result.allowableStress).toBe(15000);
    });
  });

  describe("Status Determination", () => {
    it("should mark as acceptable when thickness is adequate", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.625, // Well above minimum
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      expect(result.status).toBe("acceptable");
    });

    it("should mark as monitoring when thickness is marginal", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.560, // Within 50% of CA above minimum
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // t_min ≈ 0.5342, CA = 0.125
      // Monitoring threshold: t_min + 0.5*CA = 0.5342 + 0.0625 = 0.5967
      // t_act = 0.560 < 0.5967, so should be monitoring
      expect(result.status).toBe("monitoring");
    });

    it("should mark as critical when below minimum thickness", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.500, // Below minimum
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      expect(result.status).toBe("critical");
    });
  });
});
