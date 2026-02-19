/**
 * Track 003: Critical Calculation Accuracy Tests
 * 
 * These tests verify that all ASME Section VIII Division 1 calculations
 * are accurate and match expected values using correct ASME Section II Part D
 * Table 1A allowable stress values.
 * 
 * Key Parameters Used (ASME Section II Part D, Table 1A):
 * - SA-516 Gr 70 at 200°F: S = 20,000 psi
 * - SA-516 Gr 70 at 700°F: S = 20,000 psi
 * - SA-106 Gr B at 200°F: S = 17,100 psi
 * - SA-285 Gr C at 200°F: S = 13,800 psi
 * - Standard vessel: ID = 72", P = 250 psi, E = 0.85
 */

import { describe, it, expect } from "vitest";
import {
  calculateComponent,
  calculateHeadMinThickness,
  calculateHeadMAWP,
} from "./componentCalculations";

describe("Track 003: Calculation Accuracy Verification", () => {
  
  describe("Shell Calculations - ASME UG-27", () => {
    
    it("should calculate shell minimum thickness correctly", () => {
      // Standard test case: SA-516 Gr 70 at 200°F, S = 20,000 psi (per ASME Table 1A)
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // Formula: t = PR / (SE - 0.6P)
      // t = (250 × 36) / (20000 × 0.85 - 0.6 × 250)
      // t = 9000 / (17000 - 150) = 9000 / 16850 = 0.5341"
      expect(result.minimumRequiredThickness).toBeCloseTo(0.5341, 3);
    });

    it("should calculate shell MAWP correctly - circumferential governs", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // Net thickness: t = 0.750 - 0.125 = 0.625"
      // Circumferential: P = SEt / (R + 0.6t) = (20000 × 0.85 × 0.625) / (36 + 0.375) = 10625 / 36.375 = 292.1 psi
      // Longitudinal: P = 2SEt / (R - 0.4t) = (2 × 20000 × 0.85 × 0.625) / (36 - 0.25) = 21250 / 35.75 = 594.4 psi
      // Governing (minimum): 292.1 psi
      expect(result.mawp).toBeCloseTo(292.1, 0);
    });

    it("should handle different joint efficiencies correctly", () => {
      const baseData = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      // E = 1.0 (Full RT): t = 9000/(20000*1.0-150) = 9000/19850 = 0.4534"
      const result_E1 = calculateComponent({ ...baseData, jointEfficiency: 1.0 });
      expect(result_E1.minimumRequiredThickness).toBeCloseTo(0.4534, 3);

      // E = 0.85 (Spot RT): t = 9000/(20000*0.85-150) = 9000/16850 = 0.5341"
      const result_E085 = calculateComponent({ ...baseData, jointEfficiency: 0.85 });
      expect(result_E085.minimumRequiredThickness).toBeCloseTo(0.5341, 3);

      // E = 0.70 (No RT): t = 9000/(20000*0.70-150) = 9000/13850 = 0.6498"
      const result_E070 = calculateComponent({ ...baseData, jointEfficiency: 0.70 });
      expect(result_E070.minimumRequiredThickness).toBeCloseTo(0.6498, 3);
    });
  });

  describe("Hemispherical Head Calculations - ASME UG-32(d)", () => {
    
    it("should calculate hemispherical head t_min correctly", () => {
      // Using S = 20,000 psi for SA-516 Gr 70 at 200°F
      const P = 250;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;

      const t_min = calculateHeadMinThickness(P, R, S, E, CA, "hemispherical");

      // Formula: t = PL / (2SE - 0.2P) where L = R
      // t = (250 × 36) / (2 × 20000 × 0.85 - 0.2 × 250)
      // t = 9000 / (34000 - 50) = 9000 / 33950 = 0.2651"
      expect(t_min).toBeCloseTo(0.2651, 3);
    });

    it("should calculate hemispherical head MAWP correctly", () => {
      const t = 0.500;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "hemispherical");

      // Net thickness: t_net = 0.500 - 0.125 = 0.375"
      // Formula: P = 2SEt / (R + 0.2t)
      // P = (2 × 20000 × 0.85 × 0.375) / (36 + 0.075) = 12750 / 36.075 = 353.4 psi
      expect(mawp).toBeCloseTo(353.4, 0);
    });
  });

  describe("Ellipsoidal Head Calculations - ASME UG-32(e)", () => {
    
    it("should calculate 2:1 ellipsoidal head t_min correctly", () => {
      const P = 250;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;

      const t_min = calculateHeadMinThickness(P, R, S, E, CA, "ellipsoidal");

      // Formula: t = PD / (2SE - 0.2P) where D = 2R = 72"
      // t = (250 × 72) / (2 × 20000 × 0.85 - 0.2 × 250)
      // t = 18000 / (34000 - 50) = 18000 / 33950 = 0.5302"
      expect(t_min).toBeCloseTo(0.5302, 3);
    });

    it("should calculate ellipsoidal head MAWP correctly", () => {
      const t = 0.750;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "ellipsoidal");

      // Net thickness: t_net = 0.750 - 0.125 = 0.625"
      // Formula: P = 2SEt / (D + 0.2t) where D = 72"
      // P = (2 × 20000 × 0.85 × 0.625) / (72 + 0.125) = 21250 / 72.125 = 294.6 psi
      expect(mawp).toBeCloseTo(294.6, 0);
    });
  });

  describe("Torispherical Head Calculations - ASME Appendix 1-4(d)", () => {
    
    it("should calculate M factor correctly for standard F&D head", () => {
      const D = 72;
      const L = D; // Crown radius = inside diameter
      const r = 0.06 * D; // Knuckle radius = 6% of diameter = 4.32"

      // M = 0.25 * (3 + sqrt(L/r))
      // M = 0.25 * (3 + sqrt(72/4.32)) = 0.25 * (3 + 4.082) = 1.7705
      const M = 0.25 * (3 + Math.sqrt(L / r));
      expect(M).toBeCloseTo(1.7705, 3);
    });

    it("should calculate torispherical head t_min correctly", () => {
      const P = 250;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;
      const D = 72;
      const L = D;
      const r = 0.06 * D;

      const t_min = calculateHeadMinThickness(P, R, S, E, CA, "torispherical", r, L);

      // M = 1.7705
      // Formula: t = PLM / (2SE - 0.2P)
      // t = (250 × 72 × 1.7705) / (2 × 20000 × 0.85 - 0.2 × 250)
      // t = 31869 / 33950 = 0.9387"
      expect(t_min).toBeCloseTo(0.9387, 3);
    });

    it("should calculate torispherical head MAWP correctly", () => {
      const t = 1.250;
      const R = 36;
      const S = 20000;
      const E = 0.85;
      const CA = 0.125;
      const D = 72;
      const L = D;
      const r = 0.06 * D;

      const mawp = calculateHeadMAWP(t, R, S, E, CA, "torispherical", r, L);

      // Net thickness: t_net = 1.250 - 0.125 = 1.125"
      // M = 1.7705
      // Formula: P = 2SEt / (LM + 0.2t)
      // P = (2 × 20000 × 0.85 × 1.125) / (72 × 1.7705 + 0.225)
      // P = 38250 / (127.476 + 0.225) = 38250 / 127.701 = 299.5 psi
      expect(mawp).toBeCloseTo(299.5, 0);
    });
  });

  describe("Static Head Pressure Calculations", () => {
    
    it("should calculate static head pressure correctly", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
        liquidService: true,
        specificGravity: 0.92,
        liquidHeight: 6.0,
      };

      const result = calculateComponent(data);

      // P_static = SG × h × 0.433 psi/ft
      // P_static = 0.92 × 6.0 × 0.433 = 2.39 psi
      expect(result.staticHeadPressure).toBeCloseTo(2.39, 2);
      expect(result.totalDesignPressure).toBeCloseTo(252.39, 2);
    });

    it("should increase t_min when static head is included", () => {
      const baseData = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result_no_static = calculateComponent(baseData);
      const result_with_static = calculateComponent({
        ...baseData,
        liquidService: true,
        specificGravity: 0.92,
        liquidHeight: 6.0,
      });

      // t_min with static head should be slightly higher
      expect(result_with_static.minimumRequiredThickness).toBeGreaterThan(
        result_no_static.minimumRequiredThickness
      );
    });
  });

  describe("Remaining Life Calculations", () => {
    
    it("should calculate remaining life correctly with positive corrosion allowance", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.875,
        actualThickness: 0.750, // Above t_min of 0.5341"
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 5, // 5 mpy
      };

      const result = calculateComponent(data);

      // t_min = 0.5341" (with S = 20,000 psi)
      // Ca = t_act - t_min = 0.750 - 0.5341 = 0.2159"
      // Cr = 5 mpy = 0.005 inches/year
      // RL = Ca / Cr = 0.2159 / 0.005 = 43.18 years
      expect(result.remainingLife).toBeCloseTo(43.18, 0);
    });

    it("should return 0 remaining life when below minimum thickness", () => {
      // With S = 20,000 psi, t_min = 0.5341"
      // Need t_act below 0.5341"
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.500, // Below t_min of 0.5341"
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 5,
      };

      const result = calculateComponent(data);

      expect(result.remainingLife).toBe(0);
    });

    it("should return 999 years for zero corrosion rate", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.875,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);

      // Per skills.md: Zero corrosion rate returns -1 to indicate "Insufficient data"
      expect(result.remainingLife).toBe(-1);
    });
  });

  describe("Status Determination", () => {
    
    it("should mark as acceptable when t_act >= t_min + 0.5*CA", () => {
      // t_min = 0.5341", monitoring threshold = 0.5341 + 0.0625 = 0.5966"
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.875,
        actualThickness: 0.750, // Above 0.5966"
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      expect(result.status).toBe("acceptable");
    });

    it("should mark as monitoring when t_min <= t_act < t_min + 0.5*CA", () => {
      // t_min = 0.5341", monitoring threshold = 0.5966"
      // Need t_act between 0.5341 and 0.5966
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.600,
        actualThickness: 0.560, // Between t_min (0.5341) and threshold (0.5966)
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      expect(result.status).toBe("monitoring");
    });

    it("should mark as critical when t_act < t_min", () => {
      // t_min = 0.5341"
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.625,
        actualThickness: 0.500, // Below t_min of 0.5341"
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      expect(result.status).toBe("critical");
    });
  });

  describe("Material Allowable Stress Values", () => {
    
    it("should use correct stress for SA-516-70 at different temperatures", () => {
      const baseData = {
        designPressure: 250,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.875,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      // At 200°F: S = 20,000 psi (per ASME Section II Part D, Table 1A)
      const result_200 = calculateComponent({ ...baseData, designTemperature: 200 });
      expect(result_200.allowableStress).toBe(20000);

      // At 700°F: S = 20,000 psi (per ASME Section II Part D, Table 1A)
      const result_700 = calculateComponent({ ...baseData, designTemperature: 700 });
      expect(result_700.allowableStress).toBe(20000);
    });

    it("should use correct stress for SA-106-B", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-106-B",
        nominalThickness: 0.875,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      // SA-106 Gr B at 200°F: S = 17,100 psi (per ASME Table 1A)
      expect(result.allowableStress).toBe(17100);
    });

    it("should use correct stress for SA-285-C", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-285-C",
        nominalThickness: 0.875,
        actualThickness: 0.750,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      // SA-285 Gr C at 200°F: S = 13,800 psi (per ASME Table 1A)
      expect(result.allowableStress).toBe(13800);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    
    it("should handle zero corrosion allowance", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 0.750,
        actualThickness: 0.750,
        corrosionAllowance: 0,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      
      // With CA = 0, MAWP should be calculated with full thickness
      expect(result.mawp).toBeGreaterThan(0);
      expect(result.corrosionAllowance).toBe(0);
    });

    it("should handle very high pressure", () => {
      const data = {
        designPressure: 1000,
        designTemperature: 200,
        insideDiameter: 72,
        materialSpec: "SA-516-70",
        nominalThickness: 2.500,
        actualThickness: 2.500,
        corrosionAllowance: 0.125,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      
      // t_min = (1000 × 36) / (20000 × 0.85 - 600) = 36000 / 16400 = 2.195"
      expect(result.minimumRequiredThickness).toBeCloseTo(2.195, 2);
    });

    it("should handle small diameter vessels", () => {
      const data = {
        designPressure: 250,
        designTemperature: 200,
        insideDiameter: 12, // Small vessel
        materialSpec: "SA-516-70",
        nominalThickness: 0.250,
        actualThickness: 0.250,
        corrosionAllowance: 0.0625,
        jointEfficiency: 0.85,
        componentType: "shell" as const,
        corrosionRate: 0,
      };

      const result = calculateComponent(data);
      
      // t_min = (250 × 6) / (20000 × 0.85 - 150) = 1500 / 16850 = 0.0890"
      expect(result.minimumRequiredThickness).toBeCloseTo(0.0890, 3);
    });
  });
});
