import { describe, it, expect } from "vitest";
import { generateExcelTemplate } from "./generateExcelTemplate";
import * as XLSX from "xlsx";

describe("Excel Template Generator", () => {
  it("should generate a valid Excel buffer", () => {
    const buffer = generateExcelTemplate();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("should contain all required sheets", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    
    expect(workbook.SheetNames).toContain("Instructions");
    expect(workbook.SheetNames).toContain("Vessel Information");
    expect(workbook.SheetNames).toContain("TML Readings");
    expect(workbook.SheetNames).toContain("Nozzles");
    expect(workbook.SheetNames).toContain("Inspection Details");
  });

  it("should have correct headers in Vessel Information sheet", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const vesselSheet = workbook.Sheets["Vessel Information"];
    const data = XLSX.utils.sheet_to_json(vesselSheet, { header: 1 }) as string[][];
    
    // First row should be headers
    expect(data[0][0]).toBe("Field");
    expect(data[0][1]).toBe("Value");
    expect(data[0][2]).toBe("Notes");
    
    // Check for required vessel fields
    const fields = data.map(row => row[0]);
    expect(fields).toContain("Vessel Tag Number *");
    expect(fields).toContain("Design Pressure (psig)");
    expect(fields).toContain("Material Specification");
  });

  it("should have correct headers in TML Readings sheet", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const tmlSheet = workbook.Sheets["TML Readings"];
    const data = XLSX.utils.sheet_to_json(tmlSheet, { header: 1 }) as string[][];
    
    // First row should be headers
    expect(data[0]).toContain("CML Number *");
    expect(data[0]).toContain("T Actual (in) *");
    expect(data[0]).toContain("Previous Thickness (in)");
    expect(data[0]).toContain("Corrosion Rate (mpy)");
  });

  it("should have correct headers in Nozzles sheet", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const nozzlesSheet = workbook.Sheets["Nozzles"];
    const data = XLSX.utils.sheet_to_json(nozzlesSheet, { header: 1 }) as string[][];
    
    // First row should be headers
    expect(data[0]).toContain("Nozzle Number *");
    expect(data[0]).toContain("Description");
    expect(data[0]).toContain("Actual Thickness (in)");
    expect(data[0]).toContain("Minimum Required (in)");
  });

  it("should include example data in TML Readings", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const tmlSheet = workbook.Sheets["TML Readings"];
    const data = XLSX.utils.sheet_to_json(tmlSheet, { header: 1 }) as any[][];
    
    // Should have example rows with data
    expect(data.length).toBeGreaterThan(1);
    expect(data[1][0]).toBe("001"); // First CML number
    expect(data[1][8]).toBe("0.485"); // T Actual value (stored as string)
  });

  it("should include example data in Nozzles", () => {
    const buffer = generateExcelTemplate();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const nozzlesSheet = workbook.Sheets["Nozzles"];
    const data = XLSX.utils.sheet_to_json(nozzlesSheet, { header: 1 }) as any[][];
    
    // Should have example rows with data
    expect(data.length).toBeGreaterThan(1);
    expect(data[1][0]).toBe("N1"); // First nozzle number
    expect(data[1][1]).toBe("Inlet"); // Description
  });
});
