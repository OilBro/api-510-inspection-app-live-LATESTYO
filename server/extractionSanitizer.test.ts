/**
 * Extraction Sanitizer Tests
 * 
 * Comprehensive tests for all 7 post-processing fixes:
 * 1. Report field sanitization
 * 2. Checklist-to-vessel field hydration
 * 3. Head type from narrative
 * 4. Seam-adjacent CML location handling
 * 5. Incomplete thickness flagging
 * 6. Checklist status normalization
 * 7. Document provenance tracking
 */

import { describe, it, expect } from "vitest";
import { sanitizeExtractedData, convertFractionToDecimal } from "./extractionSanitizer";

// ============================================================================
// HELPER: Build minimal test data
// ============================================================================

function buildTestData(overrides: any = {}): any {
  return {
    reportInfo: {
      reportNumber: "",
      reportDate: "",
      inspectionDate: "",
      inspectionType: "",
      inspectionCompany: "",
      inspectorName: "",
      inspectorCert: "",
      ...overrides.reportInfo,
    },
    clientInfo: {
      clientName: "",
      clientLocation: "",
      product: "",
      ...overrides.clientInfo,
    },
    vesselData: {
      vesselTagNumber: "",
      vesselName: "",
      manufacturer: "",
      serialNumber: "",
      nbNumber: "",
      designPressure: "",
      designTemperature: "",
      operatingPressure: "",
      operatingTemperature: "",
      mdmt: "",
      materialSpec: "",
      insideDiameter: "",
      overallLength: "",
      headType: "",
      allowableStress: "",
      jointEfficiency: "",
      crownRadius: "",
      knuckleRadius: "",
      ...overrides.vesselData,
    },
    executiveSummary: overrides.executiveSummary || "",
    inspectionResults: overrides.inspectionResults || "",
    recommendations: overrides.recommendations || "",
    tmlReadings: overrides.tmlReadings || [],
    inspectionChecklist: overrides.inspectionChecklist || [],
    nozzles: overrides.nozzles || [],
    tableA: overrides.tableA || null,
  };
}

// ============================================================================
// FIX #1: REPORT FIELD SANITIZATION
// ============================================================================

describe("Fix #1: Report Field Sanitization", () => {
  it("should extract report number from polluted LLM output", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "Based on the document header and report information, the report number appears to be 54-11-004. Let me verify this by checking the header text which reads 'API 510 Inspection Report No. 54-11-004 dated December 2, 2025'. Yes, the report number is 54-11-004.",
      },
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.reportNumber).toBe("54-11-004");
    expect(provenance.fieldOverrides.some(o => o.field === "reportInfo.reportNumber")).toBe(true);
  });

  it("should preserve clean report numbers", () => {
    const data = buildTestData({
      reportInfo: { reportNumber: "54-11-001" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.reportNumber).toBe("54-11-001");
  });

  it("should extract date from polluted date field", () => {
    const data = buildTestData({
      reportInfo: {
        reportDate: "The report was dated 2025-12-02 as shown in the header",
        inspectionDate: "October 15, 2025",
      },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.reportDate).toBe("2025-12-02");
    expect(result.reportInfo.inspectionDate).toBe("2025-10-15");
  });

  it("should extract inspector cert number (not a year)", () => {
    const data = buildTestData({
      reportInfo: {
        inspectorCert: "API 510 Certificate No. 33958 issued 2020",
      },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectorCert).toBe("33958");
  });

  it("should normalize inspection type", () => {
    const data = buildTestData({
      reportInfo: { inspectionType: "In Service" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionType).toBe("IN-SERVICE");
  });

  it("should normalize ON-STREAM inspection type", () => {
    const data = buildTestData({
      reportInfo: { inspectionType: "OnStream" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionType).toBe("ON-STREAM");
  });

  it("should handle US date format (MM/DD/YYYY)", () => {
    const data = buildTestData({
      reportInfo: { reportDate: "12/02/2025" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.reportDate).toBe("2025-12-02");
  });

  it("should clear catastrophically polluted report number with no pattern match", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "This is a very long string with no recognizable report number pattern that was generated by the LLM as part of its reasoning process and should not be stored as a canonical field value because it would break downstream processing",
      },
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.reportNumber).toBe("");
    expect(provenance.fieldOverrides.some(o => o.rule === "polluted_field_cleared")).toBe(true);
  });
});

// ============================================================================
// FIX #2: CHECKLIST-TO-VESSEL FIELD HYDRATION
// ============================================================================

describe("Fix #2: Checklist-to-Vessel Field Hydration", () => {
  it("should extract NB number from checklist", () => {
    const data = buildTestData({
      vesselData: { nbNumber: "" },
      inspectionChecklist: [
        { itemText: "NB / Board Number: 36715", status: "A" },
        { itemText: "Shell condition satisfactory", status: "A" },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.nbNumber).toBe("36715");
    expect(provenance.fieldOverrides.some(o => o.rule === "checklist_hydration_nb_number")).toBe(true);
  });

  it("should extract serial number from checklist", () => {
    const data = buildTestData({
      vesselData: { serialNumber: "" },
      inspectionChecklist: [
        { itemText: "Serial Number: 1531-U", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.serialNumber).toBe("1531-U");
  });

  it("should extract MAWP/design pressure from checklist", () => {
    const data = buildTestData({
      vesselData: { designPressure: "" },
      inspectionChecklist: [
        { itemText: "MAWP: 100 psig", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.designPressure).toBe("100");
  });

  it("should extract MDMT from checklist", () => {
    const data = buildTestData({
      vesselData: { mdmt: "" },
      inspectionChecklist: [
        { itemText: "MDMT: -20°F", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.mdmt).toBe("-20");
  });

  it("should extract manufacturer from checklist", () => {
    const data = buildTestData({
      vesselData: { manufacturer: "" },
      inspectionChecklist: [
        { itemText: "Manufacturer: OLD DOMINION FABRICATORS", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.manufacturer).toBe("OLD DOMINION FABRICATORS");
  });

  it("should convert fraction to decimal for shell nominal thickness", () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Nominal Shell Thickness: 5/16", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result._hydratedFields?.nominalShellThickness).toBe(0.3125);
  });

  it("should extract head nominal thickness", () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Nominal Head Thickness: .450", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result._hydratedFields?.nominalHeadThickness).toBe(0.45);
  });

  it("should NOT overwrite existing vessel data", () => {
    const data = buildTestData({
      vesselData: { nbNumber: "99999" },
      inspectionChecklist: [
        { itemText: "NB / Board Number: 36715", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.nbNumber).toBe("99999"); // Preserved, not overwritten
  });

  it("should extract material spec from checklist", () => {
    const data = buildTestData({
      vesselData: { materialSpec: "" },
      inspectionChecklist: [
        { itemText: "Shell Material: SA-516 Gr 70", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.materialSpec).toBe("SA-516 Gr 70");
  });
});

// ============================================================================
// FIX #3: HEAD TYPE FROM NARRATIVE
// ============================================================================

describe("Fix #3: Head Type from Narrative", () => {
  it("should extract torispherical head type from narrative", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionResults: "The north and south heads are torispherical in design with standard F&D dimensions.",
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("Torispherical");
    expect(provenance.validationWarnings.some(w => w.toLowerCase().includes("torispherical"))).toBe(true);
  });

  it("should extract ellipsoidal head type from narrative", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      executiveSummary: "The vessel has 2:1 ellipsoidal heads at both ends.",
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
  });

  it("should extract hemispherical head type from narrative", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionResults: "Both heads are hemispherical design per original construction drawings.",
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("Hemispherical");
  });

  it("should NOT overwrite existing head type", () => {
    const data = buildTestData({
      vesselData: { headType: "Hemispherical" },
      inspectionResults: "The heads are torispherical in design.",
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("Hemispherical"); // Preserved
  });

  it("should warn about missing crown/knuckle radii for torispherical", () => {
    const data = buildTestData({
      vesselData: { headType: "", crownRadius: "", knuckleRadius: "" },
      inspectionResults: "The heads are torispherical in design.",
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w => w.includes("crownRadius"))).toBe(true);
    expect(provenance.validationWarnings.some(w => w.includes("knuckleRadius"))).toBe(true);
  });

  it("should detect F&D as torispherical", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionResults: "Vessel has flanged and dished heads at both ends.",
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("Torispherical");
  });
});

// ============================================================================
// FIX #4: SEAM-ADJACENT CML LOCATION HANDLING
// ============================================================================

describe("Fix #4: Seam-Adjacent CML Location Handling", () => {
  it("should tag seam-adjacent readings with proper stationKey", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-0",
          location: '2" from Seam w/East Head',
          component: "Shell",
          angle: "0°",
          currentThickness: 0.55,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._metadata.isSeamAdjacent).toBe(true);
    expect(tml._metadata.stationKey).toBe("SEAM-EH-2IN-A0");
    expect(tml.readingType).toBe("seam");
  });

  it("should handle West Head seam references", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-90",
          location: '3" from Seam w/West Head',
          component: "Shell",
          angle: "90°",
          currentThickness: 0.52,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._metadata.stationKey).toBe("SEAM-WH-3IN-A90");
  });

  it("should NOT modify non-seam shell readings", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "4-45",
          location: "4' from East Head",
          component: "Shell",
          angle: "45°",
          currentThickness: 0.66,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._metadata?.isSeamAdjacent).toBeFalsy();
  });

  it("should handle North/South head references (convert to East/West)", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-180",
          location: '2" from Seam w/North Head',
          component: "Shell",
          angle: "180°",
          currentThickness: 0.54,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN-A180");
  });
});

// ============================================================================
// FIX #5: INCOMPLETE THICKNESS FLAGGING
// ============================================================================

describe("Fix #5: Incomplete Thickness Flagging", () => {
  it("should flag records with missing currentThickness", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1-0", component: "Shell", currentThickness: null },
        { legacyLocationId: "2-0", component: "Shell", currentThickness: 0.66 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0]._metadata.dataStatus).toBe("incomplete");
    expect(result.tmlReadings[0]._metadata.calculationReady).toBe(false);
    expect(result.tmlReadings[1]._metadata.dataStatus).toBe("complete");
    expect(result.tmlReadings[1]._metadata.calculationReady).toBe(true);
  });

  it("should nullify zero previousThickness values", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-0",
          component: "Shell",
          currentThickness: 0.66,
          previousThickness: 0,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0].previousThickness).toBeNull();
  });

  it("should report data quality summary", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1-0", component: "Shell", currentThickness: 0.66 },
        { legacyLocationId: "2-0", component: "Shell", currentThickness: null },
        { legacyLocationId: "3-0", component: "Shell", currentThickness: 0.65 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result._metadata.tmlDataQuality.total).toBe(3);
    expect(result._metadata.tmlDataQuality.complete).toBe(2);
    expect(result._metadata.tmlDataQuality.incomplete).toBe(1);
    expect(result._metadata.tmlDataQuality.calculationReadyPercentage).toBe(67);
  });

  it("should flag zero thickness as invalid", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1-0", component: "Shell", currentThickness: 0 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0]._metadata.dataStatus).toBe("incomplete");
    expect(result.tmlReadings[0]._metadata.dataIssues).toContain("zero_thickness_invalid");
  });
});

// ============================================================================
// FIX #6: CHECKLIST STATUS NORMALIZATION
// ============================================================================

describe("Fix #6: Checklist Status Normalization", () => {
  it('should map "A" to acceptable/checked', () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Foundation condition", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const item = result.inspectionChecklist[0];
    expect(item.checked).toBe(true);
    expect(item.status).toBe("acceptable");
  });

  it('should map "N/A" to not_applicable', () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Insulation condition", status: "N/A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const item = result.inspectionChecklist[0];
    expect(item.checked).toBe(false);
    expect(item.status).toBe("not_applicable");
  });

  it('should map "S" to satisfactory', () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Shell condition", status: "S" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.inspectionChecklist[0].status).toBe("satisfactory");
    expect(result.inspectionChecklist[0].checked).toBe(true);
  });

  it('should map "U" to unsatisfactory', () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Coating condition", status: "U" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.inspectionChecklist[0].status).toBe("unsatisfactory");
    expect(result.inspectionChecklist[0].checked).toBe(false);
  });

  it("should store non-standard values as notes", () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Foundation type", status: "CONCRETE" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const item = result.inspectionChecklist[0];
    expect(item.status).toBe("observed");
    expect(item.notes).toContain("CONCRETE");
    expect(item.checked).toBe(true);
  });

  it("should handle PASS/FAIL statuses", () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "Pressure test", status: "PASS" },
        { itemText: "Weld inspection", status: "FAIL" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.inspectionChecklist[0].status).toBe("pass");
    expect(result.inspectionChecklist[0].checked).toBe(true);
    expect(result.inspectionChecklist[1].status).toBe("fail");
    expect(result.inspectionChecklist[1].checked).toBe(false);
  });

  it("should handle NA without slash", () => {
    const data = buildTestData({
      inspectionChecklist: [
        { itemText: "CUI assessment", status: "NA" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.inspectionChecklist[0].status).toBe("not_applicable");
  });
});

// ============================================================================
// FIX #7: DOCUMENT PROVENANCE
// ============================================================================

describe("Fix #7: Document Provenance", () => {
  it("should include provenance block in output", () => {
    const data = buildTestData({
      reportInfo: { reportNumber: "54-11-004" },
      vesselData: { vesselTagNumber: "V-101" },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance).toBeDefined();
    expect(provenance.parser).toBe("manus");
    expect(provenance.sanitizerVersion).toBe("1.1.0");
    expect(provenance.confidence).toBeDefined();
    expect(provenance.fieldOverrides).toBeInstanceOf(Array);
    expect(provenance.validationWarnings).toBeInstanceOf(Array);
  });

  it("should set ocrApplied for vision parser", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "vision");
    expect(provenance.ocrApplied).toBe(true);
  });

  it("should set ocrApplied for hybrid parser", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "hybrid");
    expect(provenance.ocrApplied).toBe(true);
  });

  it("should NOT set ocrApplied for manus text parser", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.ocrApplied).toBe(false);
  });

  it("should calculate report field confidence", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "54-11-004",
        reportDate: "2025-12-02",
        inspectionDate: "2025-10-15",
        inspectionType: "IN-SERVICE",
        inspectorName: "Christopher Welch",
        inspectorCert: "33958",
      },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.confidence.reportFields).toBe(1.0); // All 6 fields populated
  });

  it("should calculate TML confidence based on valid thickness readings", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1-0", currentThickness: 0.66 },
        { legacyLocationId: "2-0", currentThickness: 0.65 },
        { legacyLocationId: "3-0", currentThickness: null },
      ],
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.confidence.tmlReadings).toBeCloseTo(0.67, 1);
  });

  it("should track all field overrides", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "LLM thought loop text 54-11-004 more text",
        inspectionType: "In Service",
      },
      vesselData: { nbNumber: "" },
      inspectionChecklist: [
        { itemText: "NB / Board Number: 36715", status: "A" },
      ],
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    // Should have overrides for: reportNumber, inspectionType, nbNumber, checklist status
    expect(provenance.fieldOverrides.length).toBeGreaterThanOrEqual(3);
  });

  it("should store raw header text when report number is polluted", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "This is a very long polluted string that contains no recognizable report number pattern and was generated by the LLM reasoning loop which should never appear in a canonical field",
      },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.rawHeaderText).toBeDefined();
  });
});

// ============================================================================
// FRACTION CONVERSION UTILITY
// ============================================================================

describe("Fraction Conversion Utility", () => {
  it("should convert 5/16 to 0.3125", () => {
    expect(convertFractionToDecimal("5/16")).toBe(0.3125);
  });

  it("should convert 3/8 to 0.375", () => {
    expect(convertFractionToDecimal("3/8")).toBe(0.375);
  });

  it("should convert 1/4 to 0.25", () => {
    expect(convertFractionToDecimal("1/4")).toBe(0.25);
  });

  it("should handle decimal strings", () => {
    expect(convertFractionToDecimal(".450")).toBe(0.45);
    expect(convertFractionToDecimal("0.375")).toBe(0.375);
  });

  it("should handle mixed numbers", () => {
    expect(convertFractionToDecimal("1-1/2")).toBe(1.5);
    expect(convertFractionToDecimal("2 3/4")).toBe(2.75);
  });

  it("should return null for invalid input", () => {
    expect(convertFractionToDecimal("abc")).toBeNull();
    expect(convertFractionToDecimal("")).toBeNull();
  });
});

// ============================================================================
// INTEGRATION: FULL PIPELINE (vessel 54-11-004 scenario)
// ============================================================================

describe("Integration: Full Pipeline (vessel 54-11-004)", () => {
  it("should correctly sanitize the 54-11-004 extraction scenario", () => {
    const data = buildTestData({
      reportInfo: {
        reportNumber: "Based on the document header, the report number is 54-11-004. Let me verify...",
        reportDate: "2025-12-02",
        inspectionDate: "2025-10-15",
        inspectionType: "IN-SERVICE",
        inspectorName: "Christopher Welch",
        inspectorCert: "33958",
      },
      vesselData: {
        vesselTagNumber: "54-11-004",
        yearBuilt: 1981,
        headType: "", // Missing - should be extracted from narrative
        nbNumber: "", // Missing - should be hydrated from checklist
        serialNumber: "", // Missing - should be hydrated from checklist
        designPressure: "", // Missing - should be hydrated from checklist
        mdmt: "", // Missing - should be hydrated from checklist
        manufacturer: "", // Missing - should be hydrated from checklist
      },
      inspectionResults: "The vessel has north and south heads that are torispherical in design with standard flanged and dished dimensions.",
      inspectionChecklist: [
        { itemText: "NB / Board Number: 36715", status: "A" },
        { itemText: "Serial: 1531-U", status: "A" },
        { itemText: "MAWP: 100 psig", status: "A" },
        { itemText: "MDMT: -20°F", status: "A" },
        { itemText: "Nominal Shell Thickness: 5/16", status: "A" },
        { itemText: "Nominal Head Thickness: .450", status: "A" },
        { itemText: "Manufacturer: OLD DOMINION FABRICATORS", status: "A" },
        { itemText: "Foundation condition", status: "CONCRETE" },
        { itemText: "Insulation", status: "N/A" },
      ],
      tmlReadings: [
        {
          legacyLocationId: "1-0",
          location: '2" from Seam w/East Head',
          component: "Shell",
          angle: "0°",
          currentThickness: null, // Missing — will be dropped as phantom (head quadrant + no thickness)
        },
        {
          legacyLocationId: "6-135",
          location: '2" East Head Seam - Head Side',
          component: "Shell",
          angle: "135°",
          currentThickness: 0.580, // Has thickness — will be kept and tagged seam-adjacent
        },
        {
          legacyLocationId: "4-45",
          location: "4' from East Head",
          component: "Shell",
          angle: "45°",
          currentThickness: 0.66,
          previousThickness: 0, // Invalid zero
        },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");

    // Fix #1: Report number cleaned
    expect(result.reportInfo.reportNumber).toBe("54-11-004");

    // Fix #2: Vessel fields hydrated from checklist
    expect(result.vesselData.nbNumber).toBe("36715");
    expect(result.vesselData.serialNumber).toBe("1531-U");
    expect(result.vesselData.designPressure).toBe("100");
    expect(result.vesselData.mdmt).toBe("-20");
    expect(result.vesselData.manufacturer).toBe("OLD DOMINION FABRICATORS");
    expect(result._hydratedFields.nominalShellThickness).toBe(0.3125);
    expect(result._hydratedFields.nominalHeadThickness).toBe(0.45);

    // Fix #3: Head type from narrative
    expect(result.vesselData.headType).toBe("Torispherical");

    // Fix #3B: Phantom row dropped (legacyId "1-0" + head location + no thickness)
    // Original 3 rows → 2 rows after phantom removal
    expect(result.tmlReadings.length).toBe(2);

    // Fix #4: Seam-adjacent CML tagged (the kept seam reading)
    expect(result.tmlReadings[0]._metadata.isSeamAdjacent).toBe(true);
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN-A135");

    // Fix #5: Thickness flagging on remaining rows
    expect(result.tmlReadings[0]._metadata.dataStatus).toBe("complete");
    expect(result.tmlReadings[1]._metadata.dataStatus).toBe("complete");
    expect(result.tmlReadings[1].previousThickness).toBeNull(); // Zero nullified

    // Fix #6: Checklist statuses normalized
    const nbItem = result.inspectionChecklist.find((i: any) => i.itemText.includes("Board Number"));
    expect(nbItem.status).toBe("acceptable");
    expect(nbItem.checked).toBe(true);

    const concreteItem = result.inspectionChecklist.find((i: any) => i.itemText.includes("Foundation"));
    expect(concreteItem.status).toBe("observed");
    expect(concreteItem.notes).toContain("CONCRETE");

    const naItem = result.inspectionChecklist.find((i: any) => i.itemText.includes("Insulation"));
    expect(naItem.status).toBe("not_applicable");

    // Fix #7: Provenance present
    expect(provenance.parser).toBe("manus");
    expect(provenance.fieldOverrides.length).toBeGreaterThan(0);
    expect(provenance.validationWarnings.length).toBeGreaterThan(0);
    expect(provenance.confidence.overall).toBeGreaterThan(0);
  });
});


// ============================================================================
// BUG FIX TESTS: 9 Code Review Fixes (Feb 2026)
// ============================================================================

describe("Bug Fix #1: parseNumeric fraction handling (extractionJobHandler)", () => {
  // Note: parseNumeric is a local function in extractionJobHandler.ts,
  // so we test the sanitizer's convertFractionToDecimal which covers the same logic
  
  it("should convert 5/16 to 0.3125", () => {
    expect(convertFractionToDecimal("5/16")).toBe(0.3125);
  });

  it("should convert 3/8 to 0.375", () => {
    expect(convertFractionToDecimal("3/8")).toBe(0.375);
  });

  it("should convert 1/4 to 0.25", () => {
    expect(convertFractionToDecimal("1/4")).toBe(0.25);
  });

  it("should convert mixed number 1-1/2 to 1.5", () => {
    expect(convertFractionToDecimal("1-1/2")).toBe(1.5);
  });

  it("should handle decimal strings like .450", () => {
    expect(convertFractionToDecimal(".450")).toBe(0.45);
  });

  it("should handle plain decimal 0.500", () => {
    expect(convertFractionToDecimal("0.500")).toBe(0.5);
  });
});

describe("Bug Fix #2: Checklist-to-vessel hydration (radiography)", () => {
  it("should hydrate radiographyType from checklist", () => {
    const data = buildTestData({
      vesselData: { radiographyType: "" },
      inspectionChecklist: [
        { itemText: "Radiography Type: Spot", status: "A" },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.radiographyType).toBe("Spot");
    expect(provenance.fieldOverrides.some(o => o.rule === "checklist_hydration_radiography")).toBe(true);
  });

  it("should not overwrite existing radiographyType", () => {
    const data = buildTestData({
      vesselData: { radiographyType: "Full" },
      inspectionChecklist: [
        { itemText: "Radiography Type: Spot", status: "A" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.radiographyType).toBe("Full");
  });
});

describe("Bug Fix #5: legacyLocationId '0' preservation", () => {
  it("should preserve legacyLocationId of '0' through sanitizer", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "0", location: "Shell Slice 1", currentThickness: 0.5, component: "Shell" },
        { legacyLocationId: "1", location: "Shell Slice 2", currentThickness: 0.48, component: "Shell" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    // The sanitizer should not strip "0" from legacyLocationId
    expect(result.tmlReadings[0].legacyLocationId).toBe("0");
    expect(result.tmlReadings[1].legacyLocationId).toBe("1");
  });
});

describe("Bug Fix #8: ParserType naming consistency", () => {
  it("should accept 'manus' as parser type without error", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.parser).toBe("manus");
  });

  it("should accept 'vision' as parser type", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "vision");
    expect(provenance.parser).toBe("vision");
    expect(provenance.ocrApplied).toBe(true);
  });

  it("should accept 'hybrid' as parser type", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "hybrid");
    expect(provenance.parser).toBe("hybrid");
    expect(provenance.ocrApplied).toBe(true);
  });

  it("should accept 'docupipe' as parser type", () => {
    const data = buildTestData();
    const { provenance } = sanitizeExtractedData(data, "docupipe");
    expect(provenance.parser).toBe("docupipe");
    expect(provenance.ocrApplied).toBe(false);
  });
});


// ============================================================================
// FIX #A: HEAD TYPE AUTHORITY HIERARCHY TESTS
// ============================================================================

describe("Fix #A: Head Type Authority Hierarchy", () => {
  it("should keep nameplate headType when present (highest authority)", () => {
    const data = buildTestData({
      vesselData: { headType: "2:1 Ellipsoidal" },
      inspectionResults: "The vessel heads are torispherical in design.",
      inspectionChecklist: [
        { itemText: "Head Type: Hemispherical", status: "A" },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
    // Should warn about conflicts
    const conflictWarnings = provenance.validationWarnings.filter(w =>
      w.includes("Head type conflict")
    );
    expect(conflictWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("should use checklist headType when nameplate is empty", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionChecklist: [
        { itemText: "Head Type: 2:1 Ellipsoidal", status: "A" },
      ],
      inspectionResults: "The vessel heads are torispherical.",
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
    // Should warn about checklist source
    expect(provenance.validationWarnings.some(w =>
      w.includes("extracted from checklist")
    )).toBe(true);
    // Should warn about conflict with narrative
    expect(provenance.validationWarnings.some(w =>
      w.includes("Head type conflict") && w.includes("narrative")
    )).toBe(true);
  });

  it("should use narrative headType when both nameplate and checklist are empty", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionResults: "The vessel has flanged and dished heads.",
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("Torispherical");
    expect(provenance.validationWarnings.some(w =>
      w.includes("lowest authority")
    )).toBe(true);
  });

  it("should not modify headType when all sources are empty", () => {
    const data = buildTestData({
      vesselData: { headType: "" },
      inspectionResults: "The vessel was inspected and found in good condition.",
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("");
  });

  it("should warn about torispherical missing crown/knuckle radii from any source", () => {
    const data = buildTestData({
      vesselData: { headType: "Torispherical", crownRadius: "", knuckleRadius: "" },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("crownRadius")
    )).toBe(true);
    expect(provenance.validationWarnings.some(w =>
      w.includes("knuckleRadius")
    )).toBe(true);
  });

  it("should detect nameplate vs checklist conflict and warn", () => {
    const data = buildTestData({
      vesselData: { headType: "Hemispherical" },
      inspectionChecklist: [
        { itemText: "Head type is 2:1 ellipsoidal per design drawings", status: "A" },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    // Nameplate wins
    expect(result.vesselData.headType).toBe("Hemispherical");
    // Conflict warning present
    expect(provenance.validationWarnings.some(w =>
      w.includes("Head type conflict") && w.includes("nameplate") && w.includes("checklist")
    )).toBe(true);
  });
});

// ============================================================================
// FIX #B: PHANTOM NOZZLE TML ROW REMOVAL TESTS
// ============================================================================

describe("Fix #B: Phantom Nozzle TML Row Removal", () => {
  it("should drop nozzle readingType rows with no thickness", () => {
    const data = buildTestData({
      tmlReadings: [
        { readingType: "nozzle", location: "Nozzle N1", legacyLocationId: "N1", currentThickness: null },
        { readingType: "nozzle", location: "Nozzle N2", legacyLocationId: "N2", currentThickness: 0.375 },
        { readingType: "shell", location: "Shell Slice 1", legacyLocationId: "1-0", currentThickness: 0.5 },
      ],
    });

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings.length).toBe(2);
    // N1 dropped (nozzle + no thickness), N2 and shell kept
    expect(result.tmlReadings[0].legacyLocationId).toBe("N2");
    expect(result.tmlReadings[1].legacyLocationId).toBe("1-0");
    expect(provenance.fieldOverrides.some(o => o.rule === "remove_phantom_nozzle_tml_rows")).toBe(true);
  });

  it("should drop head quadrant expansions with no thickness", () => {
    const data = buildTestData({
      tmlReadings: [
        { location: "East Head", legacyLocationId: "1-0", currentThickness: null },
        { location: "East Head", legacyLocationId: "1-90", currentThickness: null },
        { location: "East Head", legacyLocationId: "1-180", currentThickness: null },
        { location: "East Head", legacyLocationId: "1-270", currentThickness: null },
        { location: "East Head", legacyLocationId: "1-45", currentThickness: 0.420 },
        { location: "Shell Slice 2", legacyLocationId: "2-0", currentThickness: 0.5 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    // 4 phantom head quadrant rows dropped, 2 kept
    expect(result.tmlReadings.length).toBe(2);
    expect(result.tmlReadings[0].legacyLocationId).toBe("1-45");
    expect(result.tmlReadings[1].legacyLocationId).toBe("2-0");
  });

  it("should NOT drop head quadrant rows that have thickness", () => {
    const data = buildTestData({
      tmlReadings: [
        { location: "East Head", legacyLocationId: "1-0", currentThickness: 0.450 },
        { location: "East Head", legacyLocationId: "1-90", currentThickness: 0.448 },
        { location: "East Head", legacyLocationId: "1-180", currentThickness: 0.452 },
        { location: "East Head", legacyLocationId: "1-270", currentThickness: 0.449 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings.length).toBe(4);
  });

  it("should dedupe by (location, legacyLocationId) keeping row with thickness", () => {
    const data = buildTestData({
      tmlReadings: [
        { location: "Shell Slice 1", legacyLocationId: "1-0", currentThickness: null },
        { location: "Shell Slice 1", legacyLocationId: "1-0", currentThickness: 0.500 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings.length).toBe(1);
    expect(result.tmlReadings[0].currentThickness).toBe(0.500);
  });

  it("should keep all rows when no phantoms exist", () => {
    const data = buildTestData({
      tmlReadings: [
        { location: "Shell Slice 1", legacyLocationId: "1-0", currentThickness: 0.5, component: "Shell" },
        { location: "Shell Slice 2", legacyLocationId: "2-0", currentThickness: 0.48, component: "Shell" },
        { location: "Shell Slice 3", legacyLocationId: "3-0", currentThickness: 0.51, component: "Shell" },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings.length).toBe(3);
  });

  it("should report correct counts in warning message", () => {
    const data = buildTestData({
      tmlReadings: [
        { readingType: "nozzle", location: "Nozzle N1", legacyLocationId: "N1", currentThickness: null },
        { readingType: "nozzle", location: "Nozzle N2", legacyLocationId: "N2", currentThickness: null },
        { location: "East Head", legacyLocationId: "1-0", currentThickness: null },
        { location: "Shell Slice 1", legacyLocationId: "1-0", currentThickness: 0.5, component: "Shell" },
      ],
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    const phantomWarning = provenance.validationWarnings.find(w => w.includes("phantom TML rows"));
    expect(phantomWarning).toBeDefined();
    expect(phantomWarning).toContain("2 nozzle rows");
    expect(phantomWarning).toContain("1 head quadrant");
  });
});

// ============================================================================
// FIX #C: SEAM STATIONKEY ANGLE PRESERVATION TESTS
// ============================================================================

describe("Fix #C: Seam StationKey Angle Preservation", () => {
  it("should extract angle from legacyLocationId suffix (6-135 → A135)", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "6-135",
          location: '2" from Seam w/East Head',
          component: "Shell",
          currentThickness: 0.580,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN-A135");
    expect(result.tmlReadings[0]._metadata.isSeamAdjacent).toBe(true);
  });

  it("should use explicit angle field over legacyLocationId suffix", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "6-135",
          location: '2" from Seam w/East Head',
          component: "Shell",
          angle: "90",
          currentThickness: 0.580,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    // Explicit angle=90 takes priority over legacyId suffix 135
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN-A90");
  });

  it("should produce distinct stationKeys for different angles at same seam distance", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "6-0", location: '2" from Seam w/East Head', component: "Shell", currentThickness: 0.580 },
        { legacyLocationId: "6-45", location: '2" from Seam w/East Head', component: "Shell", currentThickness: 0.575 },
        { legacyLocationId: "6-90", location: '2" from Seam w/East Head', component: "Shell", currentThickness: 0.570 },
        { legacyLocationId: "6-135", location: '2" from Seam w/East Head', component: "Shell", currentThickness: 0.565 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const keys = result.tmlReadings.map((t: any) => t._metadata.stationKey);
    expect(keys).toEqual([
      "SEAM-EH-2IN-A0",
      "SEAM-EH-2IN-A45",
      "SEAM-EH-2IN-A90",
      "SEAM-EH-2IN-A135",
    ]);
    // All should be unique
    expect(new Set(keys).size).toBe(4);
  });

  it("should not append angle when legacyLocationId has no angle suffix", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "",
          location: '2" from Seam w/East Head',
          component: "Shell",
          currentThickness: 0.580,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    // No angle from any source → no angle suffix
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN");
  });

  it("should handle angle 0 correctly (not collapse to empty)", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "6-0",
          location: '2" from Seam w/East Head',
          component: "Shell",
          currentThickness: 0.580,
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings[0]._metadata.stationKey).toBe("SEAM-EH-2IN-A0");
  });
});

// ============================================================================
// FIX #D: FRACTION-AWARE PARSERNUMERIC VERIFICATION TESTS
// ============================================================================

describe("Fix #D: Fraction-Aware parseNumeric Verification", () => {
  it("should handle all common pressure vessel fractions", () => {
    // These are the most common nominal thicknesses in pressure vessel work
    const fractions: Record<string, number> = {
      "1/16": 0.0625,
      "1/8": 0.125,
      "3/16": 0.1875,
      "1/4": 0.25,
      "5/16": 0.3125,
      "3/8": 0.375,
      "7/16": 0.4375,
      "1/2": 0.5,
      "9/16": 0.5625,
      "5/8": 0.625,
      "11/16": 0.6875,
      "3/4": 0.75,
      "13/16": 0.8125,
      "7/8": 0.875,
      "15/16": 0.9375,
    };

    for (const [fraction, expected] of Object.entries(fractions)) {
      const result = convertFractionToDecimal(fraction);
      expect(result).toBe(expected);
    }
  });

  it("should handle mixed numbers common in vessel dimensions", () => {
    expect(convertFractionToDecimal("1-1/2")).toBe(1.5);
    expect(convertFractionToDecimal("2-1/4")).toBe(2.25);
    expect(convertFractionToDecimal("1 1/2")).toBe(1.5);
  });
});
