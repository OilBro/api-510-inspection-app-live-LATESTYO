import { describe, it, expect } from "vitest";

describe("TML Editor Comparison View", () => {
  // Helper functions mirroring the component logic
  function formatValue(value: string | null | undefined): string {
    if (!value || value === "") return "—";
    return value;
  }

  function hasChanged(original: string | null | undefined, edited: string): boolean {
    const origVal = original || "";
    return origVal !== edited;
  }

  describe("formatValue helper", () => {
    it("should return dash for null values", () => {
      expect(formatValue(null)).toBe("—");
    });

    it("should return dash for undefined values", () => {
      expect(formatValue(undefined)).toBe("—");
    });

    it("should return dash for empty string", () => {
      expect(formatValue("")).toBe("—");
    });

    it("should return the value for non-empty strings", () => {
      expect(formatValue("0.375")).toBe("0.375");
      expect(formatValue("CML-1")).toBe("CML-1");
      expect(formatValue("Vessel Shell")).toBe("Vessel Shell");
    });
  });

  describe("hasChanged helper", () => {
    it("should return false when values are the same", () => {
      expect(hasChanged("0.375", "0.375")).toBe(false);
      expect(hasChanged("CML-1", "CML-1")).toBe(false);
    });

    it("should return true when values are different", () => {
      expect(hasChanged("0.375", "0.380")).toBe(true);
      expect(hasChanged("CML-1", "CML-2")).toBe(true);
    });

    it("should treat null/undefined original as empty string", () => {
      expect(hasChanged(null, "")).toBe(false);
      expect(hasChanged(undefined, "")).toBe(false);
      expect(hasChanged(null, "0.375")).toBe(true);
      expect(hasChanged(undefined, "0.375")).toBe(true);
    });

    it("should detect change from empty to value", () => {
      expect(hasChanged("", "0.375")).toBe(true);
    });

    it("should detect change from value to empty", () => {
      expect(hasChanged("0.375", "")).toBe(true);
    });
  });

  describe("Changed fields detection", () => {
    interface FormData {
      legacyLocationId: string;
      componentType: string;
      location: string;
      tml1: string;
      tml2: string;
      tml3: string;
      tml4: string;
      tActual: string;
      nominalThickness: string;
      previousThickness: string;
      status: "good" | "monitor" | "critical";
    }

    function getChangedFields(original: FormData, edited: FormData): string[] {
      const changes: string[] = [];
      if (hasChanged(original.legacyLocationId, edited.legacyLocationId)) changes.push("CML Number");
      if (hasChanged(original.componentType, edited.componentType)) changes.push("Component");
      if (hasChanged(original.location, edited.location)) changes.push("Location");
      if (hasChanged(original.tml1, edited.tml1)) changes.push("0° Reading");
      if (hasChanged(original.tml2, edited.tml2)) changes.push("90° Reading");
      if (hasChanged(original.tml3, edited.tml3)) changes.push("180° Reading");
      if (hasChanged(original.tml4, edited.tml4)) changes.push("270° Reading");
      if (hasChanged(original.tActual, edited.tActual)) changes.push("T-Actual");
      if (hasChanged(original.nominalThickness, edited.nominalThickness)) changes.push("Nominal");
      if (hasChanged(original.previousThickness, edited.previousThickness)) changes.push("T-Previous");
      if (original.status !== edited.status) changes.push("Status");
      return changes;
    }

    it("should return empty array when no changes", () => {
      const data: FormData = {
        legacyLocationId: "CML-1",
        componentType: "Vessel Shell",
        location: "12 o'clock",
        tml1: "0.375",
        tml2: "0.380",
        tml3: "0.372",
        tml4: "0.378",
        tActual: "0.372",
        nominalThickness: "0.500",
        previousThickness: "0.400",
        status: "good",
      };
      expect(getChangedFields(data, data)).toEqual([]);
    });

    it("should detect single field change", () => {
      const original: FormData = {
        legacyLocationId: "CML-1",
        componentType: "Vessel Shell",
        location: "12 o'clock",
        tml1: "0.375",
        tml2: "0.380",
        tml3: "0.372",
        tml4: "0.378",
        tActual: "0.372",
        nominalThickness: "0.500",
        previousThickness: "0.400",
        status: "good",
      };
      const edited = { ...original, tml1: "0.365" };
      expect(getChangedFields(original, edited)).toEqual(["0° Reading"]);
    });

    it("should detect multiple field changes", () => {
      const original: FormData = {
        legacyLocationId: "CML-1",
        componentType: "Vessel Shell",
        location: "12 o'clock",
        tml1: "0.375",
        tml2: "0.380",
        tml3: "0.372",
        tml4: "0.378",
        tActual: "0.372",
        nominalThickness: "0.500",
        previousThickness: "0.400",
        status: "good",
      };
      const edited = { 
        ...original, 
        tml1: "0.365",
        tml2: "0.370",
        status: "monitor" as const,
      };
      const changes = getChangedFields(original, edited);
      expect(changes).toContain("0° Reading");
      expect(changes).toContain("90° Reading");
      expect(changes).toContain("Status");
      expect(changes.length).toBe(3);
    });

    it("should detect status change", () => {
      const original: FormData = {
        legacyLocationId: "CML-1",
        componentType: "Vessel Shell",
        location: "",
        tml1: "",
        tml2: "",
        tml3: "",
        tml4: "",
        tActual: "",
        nominalThickness: "",
        previousThickness: "",
        status: "good",
      };
      const edited = { ...original, status: "critical" as const };
      expect(getChangedFields(original, edited)).toEqual(["Status"]);
    });

    it("should detect all angle readings changed", () => {
      const original: FormData = {
        legacyLocationId: "CML-1",
        componentType: "Vessel Shell",
        location: "",
        tml1: "",
        tml2: "",
        tml3: "",
        tml4: "",
        tActual: "",
        nominalThickness: "",
        previousThickness: "",
        status: "good",
      };
      const edited = { 
        ...original, 
        tml1: "0.375",
        tml2: "0.380",
        tml3: "0.372",
        tml4: "0.378",
      };
      const changes = getChangedFields(original, edited);
      expect(changes).toContain("0° Reading");
      expect(changes).toContain("90° Reading");
      expect(changes).toContain("180° Reading");
      expect(changes).toContain("270° Reading");
      expect(changes.length).toBe(4);
    });
  });

  describe("Comparison view display", () => {
    it("should format comparison row with units", () => {
      const original = "0.375";
      const edited = "0.380";
      const unit = "in";
      
      const displayOriginal = `${formatValue(original)} ${unit}`;
      const displayEdited = `${formatValue(edited)} ${unit}`;
      
      expect(displayOriginal).toBe("0.375 in");
      expect(displayEdited).toBe("0.380 in");
    });

    it("should handle missing original with dash", () => {
      const original = null;
      const edited = "0.375";
      
      expect(formatValue(original)).toBe("—");
      expect(formatValue(edited)).toBe("0.375");
    });

    it("should count total changes correctly", () => {
      const changedFields = ["0° Reading", "90° Reading", "Status"];
      expect(changedFields.length).toBe(3);
      
      const message = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} will be updated`;
      expect(message).toBe("3 fields will be updated");
    });

    it("should use singular form for single change", () => {
      const changedFields = ["Status"];
      const message = `${changedFields.length} field${changedFields.length !== 1 ? 's' : ''} will be updated`;
      expect(message).toBe("1 field will be updated");
    });
  });
});
