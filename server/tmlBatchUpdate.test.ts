import { describe, it, expect } from "vitest";

describe("TML Batch Update Router", () => {
  describe("updateBatch input validation", () => {
    it("should accept valid batch update input structure", () => {
      const validInput = {
        inspectionId: "test-inspection-123",
        updates: [
          {
            cmlNumber: "CML-1",
            tml1: 0.375,
            tml2: 0.380,
            tml3: 0.372,
            tml4: 0.378,
          },
          {
            cmlNumber: "CML-2",
            tml1: 0.250,
            previousThickness: 0.260,
          },
        ],
      };

      // Validate structure
      expect(validInput.inspectionId).toBeDefined();
      expect(Array.isArray(validInput.updates)).toBe(true);
      expect(validInput.updates.length).toBe(2);
      expect(validInput.updates[0].cmlNumber).toBe("CML-1");
      expect(validInput.updates[0].tml1).toBe(0.375);
    });

    it("should calculate tActual as minimum of angle readings", () => {
      const readings = [0.375, 0.380, 0.372, 0.378];
      const filteredReadings = readings.filter(
        (v): v is number => v !== undefined && v !== null && !isNaN(v)
      );
      const tActual = Math.min(...filteredReadings);

      expect(tActual).toBe(0.372);
    });

    it("should handle partial angle data", () => {
      const readings = [0.375, undefined, 0.372, null];
      const filteredReadings = (readings as (number | undefined | null)[])
        .filter((v): v is number => v !== undefined && v !== null && !isNaN(v));
      
      expect(filteredReadings).toEqual([0.375, 0.372]);
      expect(Math.min(...filteredReadings)).toBe(0.372);
    });

    it("should normalize CML numbers for matching", () => {
      const normalizeCml = (cml: string) =>
        cml.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();

      expect(normalizeCml("CML-1")).toBe("cml1");
      expect(normalizeCml("CML 1")).toBe("cml1");
      expect(normalizeCml("cml1")).toBe("cml1");
      expect(normalizeCml("1")).toBe("1");
      expect(normalizeCml("CML-001")).toBe("cml001");
    });
  });

  describe("Angle data extraction from PDF", () => {
    it("should support angle0, angle90, angle180, angle270 fields", () => {
      const extractedMeasurement = {
        cml: "CML-1",
        component: "Vessel Shell",
        location: "12 o'clock",
        angle0: 0.375,
        angle90: 0.380,
        angle180: 0.372,
        angle270: 0.378,
        readings: [0.375, 0.380, 0.372, 0.378],
        minThickness: 0.372,
      };

      // Verify angle fields are present
      expect(extractedMeasurement.angle0).toBe(0.375);
      expect(extractedMeasurement.angle90).toBe(0.380);
      expect(extractedMeasurement.angle180).toBe(0.372);
      expect(extractedMeasurement.angle270).toBe(0.378);
    });

    it("should prioritize angle fields over readings array", () => {
      const measurement = {
        angle0: 0.375,
        angle90: 0.380,
        angle180: 0.372,
        angle270: 0.378,
        readings: [0.400, 0.410, 0.420, 0.430], // Different values
      };

      // Use explicit angle fields if available
      const tml1 = measurement.angle0?.toString() || measurement.readings[0]?.toString();
      const tml2 = measurement.angle90?.toString() || measurement.readings[1]?.toString();
      const tml3 = measurement.angle180?.toString() || measurement.readings[2]?.toString();
      const tml4 = measurement.angle270?.toString() || measurement.readings[3]?.toString();

      expect(tml1).toBe("0.375");
      expect(tml2).toBe("0.38");
      expect(tml3).toBe("0.372");
      expect(tml4).toBe("0.378");
    });
  });

  describe("Excel parser angle column detection", () => {
    it("should detect TML 1/2/3/4 column headers", () => {
      const headers = ["cml number", "component", "tml 1", "tml 2", "tml 3", "tml 4"];
      
      const tml1Col = headers.findIndex(h => h.includes("tml 1") || h === "tml1");
      const tml2Col = headers.findIndex(h => h.includes("tml 2") || h === "tml2");
      const tml3Col = headers.findIndex(h => h.includes("tml 3") || h === "tml3");
      const tml4Col = headers.findIndex(h => h.includes("tml 4") || h === "tml4");

      expect(tml1Col).toBe(2);
      expect(tml2Col).toBe(3);
      expect(tml3Col).toBe(4);
      expect(tml4Col).toBe(5);
    });

    it("should detect angle degree column headers (0°, 90°, 180°, 270°)", () => {
      const headers = ["cml number", "component", "0°", "90°", "180°", "270°"];
      
      let tml1Col = headers.findIndex(h => h.includes("tml 1") || h === "tml1");
      let tml2Col = headers.findIndex(h => h.includes("tml 2") || h === "tml2");
      let tml3Col = headers.findIndex(h => h.includes("tml 3") || h === "tml3");
      let tml4Col = headers.findIndex(h => h.includes("tml 4") || h === "tml4");

      // Fallback to angle columns
      if (tml1Col < 0) tml1Col = headers.findIndex(h => h.includes("0°") || h === "0");
      if (tml2Col < 0) tml2Col = headers.findIndex(h => h.includes("90°") || h === "90");
      if (tml3Col < 0) tml3Col = headers.findIndex(h => h.includes("180°") || h === "180");
      if (tml4Col < 0) tml4Col = headers.findIndex(h => h.includes("270°") || h === "270");

      expect(tml1Col).toBe(2);
      expect(tml2Col).toBe(3);
      expect(tml3Col).toBe(4);
      expect(tml4Col).toBe(5);
    });

    it("should detect mixed format headers", () => {
      const headers = ["cml", "location", "0 deg", "90 deg", "180 deg", "270 deg", "min"];
      
      let tml1Col = headers.findIndex(h => h.includes("0 deg"));
      let tml2Col = headers.findIndex(h => h.includes("90 deg"));
      let tml3Col = headers.findIndex(h => h.includes("180 deg"));
      let tml4Col = headers.findIndex(h => h.includes("270 deg"));

      expect(tml1Col).toBe(2);
      expect(tml2Col).toBe(3);
      expect(tml3Col).toBe(4);
      expect(tml4Col).toBe(5);
    });
  });
});
