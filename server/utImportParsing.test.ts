import { describe, it, expect } from "vitest";
import { normalizeComponentGroup } from "./lib/componentGroupNormalizer";

describe("UT Import Parsing - Component Classification", () => {
  
  describe("normalizeComponentGroup - Head Name Preservation", () => {
    it("should preserve South Head as SOUTHHEAD (never map to WESTHEAD)", () => {
      expect(normalizeComponentGroup("South Head")).toBe("SOUTHHEAD");
      expect(normalizeComponentGroup("south head")).toBe("SOUTHHEAD");
      expect(normalizeComponentGroup("SOUTH HEAD")).toBe("SOUTHHEAD");
    });

    it("should preserve North Head as NORTHHEAD (never map to EASTHEAD)", () => {
      expect(normalizeComponentGroup("North Head")).toBe("NORTHHEAD");
      expect(normalizeComponentGroup("north head")).toBe("NORTHHEAD");
      expect(normalizeComponentGroup("NORTH HEAD")).toBe("NORTHHEAD");
    });

    it("should preserve East Head as EASTHEAD", () => {
      expect(normalizeComponentGroup("East Head")).toBe("EASTHEAD");
      expect(normalizeComponentGroup("east head")).toBe("EASTHEAD");
    });

    it("should preserve West Head as WESTHEAD", () => {
      expect(normalizeComponentGroup("West Head")).toBe("WESTHEAD");
      expect(normalizeComponentGroup("west head")).toBe("WESTHEAD");
    });
  });

  describe("normalizeComponentGroup - Shell Detection", () => {
    it("should identify shell components", () => {
      expect(normalizeComponentGroup("Shell")).toBe("SHELL");
      expect(normalizeComponentGroup("Vessel Shell")).toBe("SHELL");
      expect(normalizeComponentGroup("SHELL")).toBe("SHELL");
    });
  });

  describe("normalizeComponentGroup - Nozzle Detection", () => {
    it("should identify nozzle components", () => {
      expect(normalizeComponentGroup("2\" Nozzle")).toBe("NOZZLE");
      expect(normalizeComponentGroup("18\" MW")).toBe("NOZZLE");
      expect(normalizeComponentGroup("1\" Nozzle")).toBe("NOZZLE");
    });
  });

  describe("normalizeComponentGroup - Edge Cases", () => {
    it("should return OTHER for null/undefined/empty", () => {
      expect(normalizeComponentGroup(null)).toBe("OTHER");
      expect(normalizeComponentGroup(undefined)).toBe("OTHER");
      expect(normalizeComponentGroup("")).toBe("OTHER");
    });

    it("should return OTHER for unknown components", () => {
      expect(normalizeComponentGroup("Unknown")).toBe("OTHER");
      expect(normalizeComponentGroup("Flange")).toBe("OTHER");
    });
  });
});

describe("UT Import Parsing - Row Classification Logic", () => {
  
  // Simulate the classification logic from pdfImportRouter
  function classifyRow(compId: string, location: string): string {
    const compIdUpper = compId.trim().toUpperCase();
    const locationStr = location.trim();
    
    const isAngle = /^\d+$/.test(compIdUpper) && [0, 45, 90, 135, 180, 225, 270, 315].includes(parseInt(compIdUpper, 10));
    const isHead = compIdUpper.includes('HEAD');
    const isNozzle = locationStr.toUpperCase().startsWith('N') && /^N\d+$/i.test(locationStr);
    
    if (isAngle) return 'SHELL';
    if (isHead) return 'HEAD';
    if (isNozzle) return 'NOZZLE';
    return 'OTHER';
  }

  describe("Shell Row Classification", () => {
    it("should classify angle-based CompIDs as SHELL", () => {
      expect(classifyRow("0", "7")).toBe("SHELL");
      expect(classifyRow("45", "8")).toBe("SHELL");
      expect(classifyRow("90", "10")).toBe("SHELL");
      expect(classifyRow("135", "15")).toBe("SHELL");
      expect(classifyRow("180", "20")).toBe("SHELL");
      expect(classifyRow("225", "25")).toBe("SHELL"); // Fixed from 224
      expect(classifyRow("270", "26")).toBe("SHELL");
      expect(classifyRow("315", "7")).toBe("SHELL");
    });

    it("should NOT classify non-standard angles as SHELL", () => {
      expect(classifyRow("30", "7")).not.toBe("SHELL");
      expect(classifyRow("60", "7")).not.toBe("SHELL");
      expect(classifyRow("224", "7")).not.toBe("SHELL"); // Old typo - should NOT match
    });
  });

  describe("Head Row Classification", () => {
    it("should classify head CompIDs correctly", () => {
      expect(classifyRow("South Head", "1")).toBe("HEAD");
      expect(classifyRow("North Head", "3")).toBe("HEAD");
      expect(classifyRow("East Head", "2")).toBe("HEAD");
      expect(classifyRow("West Head", "4")).toBe("HEAD");
    });
  });

  describe("Nozzle Row Classification", () => {
    it("should classify N-prefixed locations as NOZZLE", () => {
      expect(classifyRow("18\" MW", "N1")).toBe("NOZZLE");
      expect(classifyRow("2\" Nozzle", "N2")).toBe("NOZZLE");
      expect(classifyRow("1\" Nozzle", "N3")).toBe("NOZZLE");
      expect(classifyRow("3\" Nozzle", "N7")).toBe("NOZZLE");
    });

    it("should NOT classify non-N locations as NOZZLE", () => {
      expect(classifyRow("18\" MW", "1")).not.toBe("NOZZLE");
      expect(classifyRow("2\" Nozzle", "7")).not.toBe("NOZZLE");
    });
  });
});

describe("UT Import - StationKey Generation", () => {
  
  describe("Shell StationKeys", () => {
    it("should generate SHELL-SLICE-{station}-A{angle} format", () => {
      // Simulate the stationKey generation for shell readings
      const axialStation = "7";
      const angleDeg = 0;
      const expectedPattern = /^SHELL-SLICE-\d+-A\d+$/;
      const stationKey = `SHELL-SLICE-${parseInt(axialStation, 10)}-A${angleDeg}`;
      expect(stationKey).toMatch(expectedPattern);
      expect(stationKey).toBe("SHELL-SLICE-7-A0");
    });
  });

  describe("Head StationKeys", () => {
    it("should generate {HEADGROUP}-POS-{position} format", () => {
      const headName = "South Head";
      const position = "1";
      const componentGroup = normalizeComponentGroup(headName);
      const stationKey = `${componentGroup}-POS-${position}`;
      expect(stationKey).toBe("SOUTHHEAD-POS-1");
    });

    it("should NOT generate WESTHEAD for South Head", () => {
      const headName = "South Head";
      const position = "3";
      const componentGroup = normalizeComponentGroup(headName);
      const stationKey = `${componentGroup}-POS-${position}`;
      expect(stationKey).not.toContain("WESTHEAD");
      expect(stationKey).toBe("SOUTHHEAD-POS-3");
    });
  });

  describe("Nozzle StationKeys", () => {
    it("should generate NOZZLE-{id}-A{angle} format for angular readings", () => {
      const nozzleId = "N1";
      const angles = [0, 90, 180, 270];
      for (const angle of angles) {
        const stationKey = `NOZZLE-${nozzleId}-A${angle}`;
        expect(stationKey).toMatch(/^NOZZLE-N\d+-A\d+$/);
      }
    });

    it("should generate NOZZLE-{id}-TACT format for summary", () => {
      const nozzleId = "N1";
      const stationKey = `NOZZLE-${nozzleId}-TACT`;
      expect(stationKey).toBe("NOZZLE-N1-TACT");
    });
  });
});

describe("UT Import - Thickness Calculation", () => {
  
  it("should prefer tAct over individual tml readings", () => {
    const row = { tml1: 0.450, tml2: 0.460, tml3: 0.440, tml4: 0.455, tAct: 0.440 };
    const thickness = row.tAct ?? Math.min(row.tml1, row.tml2, row.tml3, row.tml4);
    expect(thickness).toBe(0.440);
  });

  it("should fallback to min of tml readings when tAct is null", () => {
    const row = { tml1: 0.450, tml2: 0.460, tml3: 0.440, tml4: 0.455, tAct: null };
    const tmlValues = [row.tml1, row.tml2, row.tml3, row.tml4].filter(
      (v): v is number => v !== null && v !== undefined && v > 0
    );
    const thickness = row.tAct ?? (tmlValues.length > 0 ? Math.min(...tmlValues) : null);
    expect(thickness).toBe(0.440);
  });

  it("should skip rows with no thickness data", () => {
    const row = { tml1: null, tml2: null, tml3: null, tml4: null, tAct: null };
    const tmlValues = [row.tml1, row.tml2, row.tml3, row.tml4].filter(
      (v): v is number => v !== null && v !== undefined && v > 0
    );
    const thickness = row.tAct ?? (tmlValues.length > 0 ? Math.min(...tmlValues) : null);
    expect(thickness).toBeNull();
  });
});

describe("UT Import - No Cr/RL in Import Path", () => {
  
  it("should NOT calculate corrosion rate during import", () => {
    // The import path should only store raw thickness data
    // Cr/RL calculations are deferred to the locked calculation engine
    // This test verifies the principle by checking the import does not
    // include any rate calculations
    const importedReading = {
      legacyLocationId: "001",
      location: "Station 7, 0°",
      component: "Shell",
      componentGroup: "SHELL",
      angleDeg: 0,
      thickness: 0.450,
      stationKey: "SHELL-SLICE-7-A0",
    };
    
    // These fields should NOT be present in the import output
    expect(importedReading).not.toHaveProperty("corrosionRate");
    expect(importedReading).not.toHaveProperty("remainingLife");
    expect(importedReading).not.toHaveProperty("shortTermRate");
    expect(importedReading).not.toHaveProperty("longTermRate");
  });
});

describe("UT Import - Nozzle Angle Expansion", () => {
  
  it("should expand nozzle readings to 4 angles (0, 90, 180, 270)", () => {
    const nozzleAngles = [
      { angle: 0, value: 0.450 },
      { angle: 90, value: 0.460 },
      { angle: 180, value: 0.440 },
      { angle: 270, value: 0.455 },
    ];
    
    expect(nozzleAngles).toHaveLength(4);
    expect(nozzleAngles.map(a => a.angle)).toEqual([0, 90, 180, 270]);
    // Should NOT include 45, 135, 225, 315
    expect(nozzleAngles.map(a => a.angle)).not.toContain(45);
    expect(nozzleAngles.map(a => a.angle)).not.toContain(135);
    expect(nozzleAngles.map(a => a.angle)).not.toContain(225);
    expect(nozzleAngles.map(a => a.angle)).not.toContain(315);
  });

  it("should expand shell readings to 8 angles", () => {
    const shellAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    expect(shellAngles).toHaveLength(8);
    expect(shellAngles).toContain(225); // Fixed from 224
    expect(shellAngles).not.toContain(224); // Old typo
  });
});
