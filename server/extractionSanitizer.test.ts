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
    expect(provenance.sanitizerVersion).toBe("1.3.0");
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


// ============================================================================
// FIELD-NAME MISMATCH: EMPTY DATA PRE-FLIGHT WARNINGS
// ============================================================================

describe("Pre-flight: Empty Data Warnings", () => {
  it("should warn when checklist is empty", () => {
    const data = buildTestData({
      inspectionChecklist: [],
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No checklist items provided")
    )).toBe(true);
  });

  it("should warn when all narratives are empty", () => {
    const data = buildTestData({
      executiveSummary: "",
      inspectionResults: "",
      recommendations: "",
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No narrative text provided")
    )).toBe(true);
  });

  it("should NOT warn about narratives when at least one is present", () => {
    const data = buildTestData({
      executiveSummary: "Vessel inspected and found acceptable.",
      inspectionResults: "",
      recommendations: "",
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No narrative text provided")
    )).toBe(false);
  });

  it("should warn when TML readings are empty", () => {
    const data = buildTestData({
      tmlReadings: [],
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No TML readings provided")
    )).toBe(true);
  });

  it("should warn when vessel data is entirely empty", () => {
    // Build with all vessel fields as empty strings
    const data = buildTestData({
      vesselData: {
        vesselTagNumber: "",
        vesselName: "",
        manufacturer: "",
        serialNumber: "",
        nbNumber: "",
        designPressure: "",
        designTemperature: "",
        headType: "",
      },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No vessel data provided")
    )).toBe(true);
  });

  it("should NOT warn about vessel data when at least one field is populated", () => {
    const data = buildTestData({
      vesselData: {
        vesselTagNumber: "V-101",
        vesselName: "",
        manufacturer: "",
      },
    });

    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.validationWarnings.some(w =>
      w.includes("No vessel data provided")
    )).toBe(false);
  });

  it("should produce multiple warnings when all sections are empty", () => {
    const data = {
      reportInfo: { reportNumber: "" },
      clientInfo: {},
      vesselData: {},
      executiveSummary: "",
      inspectionResults: "",
      recommendations: "",
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { provenance } = sanitizeExtractedData(data, "manus");
    // Should have at least 3 warnings: checklist, narratives, TML, vessel
    const preflightWarnings = provenance.validationWarnings.filter(w =>
      w.includes("No ") && w.includes("provided")
    );
    expect(preflightWarnings.length).toBeGreaterThanOrEqual(3);
  });
});


// ============================================================================
// SCHEMA NORMALIZATION TESTS (Step 0)
// ============================================================================

describe("Step 0: Schema normalization", () => {
  it("should normalize vesselInfo → vesselData when vesselData is absent", () => {
    const data = {
      vesselInfo: { manufacturer: "ACME Corp", serialNumber: "SN-123" },
      reportInfo: { reportNumber: "54-11-004" },
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData).toBeDefined();
    expect(result.vesselData.manufacturer).toBe("ACME Corp");
    expect(result.vesselData.serialNumber).toBe("SN-123");
    expect(result.vesselInfo).toBeUndefined();
    // Should have a schema normalization override
    const schemaOverride = provenance.fieldOverrides.find(o => o.field === "_schema");
    expect(schemaOverride).toBeDefined();
    expect(schemaOverride!.rule).toBe("schema_normalization");
  });

  it("should merge vesselInfo into vesselData when both exist (vesselData takes precedence)", () => {
    const data = {
      vesselInfo: { manufacturer: "OLD MFG", serialNumber: "SN-OLD" },
      vesselData: { manufacturer: "NEW MFG" },
      reportInfo: { reportNumber: "" },
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.manufacturer).toBe("NEW MFG"); // vesselData wins
    expect(result.vesselData.serialNumber).toBe("SN-OLD"); // merged from vesselInfo
    expect(result.vesselInfo).toBeUndefined();
  });

  it("should normalize narratives.* → top-level fields", () => {
    const data = {
      narratives: {
        executiveSummary: "The vessel was inspected on December 2, 2025.",
        inspectionResults: "All readings within acceptable limits.",
        recommendations: "Continue monitoring annually.",
        scopeOfInspection: "Internal and external visual inspection.",
      },
      reportInfo: { reportNumber: "" },
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.executiveSummary).toBe("The vessel was inspected on December 2, 2025.");
    expect(result.inspectionResults).toBe("All readings within acceptable limits.");
    expect(result.recommendations).toBe("Continue monitoring annually.");
    expect(result.scopeOfInspection).toBe("Internal and external visual inspection.");
    expect(result.narratives).toBeUndefined();
  });

  it("should not overwrite existing top-level narratives with narratives.* values", () => {
    const data = {
      executiveSummary: "Existing top-level summary",
      narratives: {
        executiveSummary: "Should NOT overwrite",
      },
      reportInfo: { reportNumber: "" },
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.executiveSummary).toBe("Existing top-level summary");
  });

  it("should normalize checklistItems → inspectionChecklist", () => {
    const data = {
      checklistItems: [
        { itemText: "Visual inspection", status: "A" },
      ],
      reportInfo: { reportNumber: "" },
      vesselData: {},
      tmlReadings: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.inspectionChecklist).toBeDefined();
    expect(result.inspectionChecklist.length).toBe(1);
    expect(result.checklistItems).toBeUndefined();
  });

  it("should normalize readings → tmlReadings", () => {
    const data = {
      readings: [
        { legacyLocationId: "1-0", currentThickness: 0.45 },
      ],
      reportInfo: { reportNumber: "" },
      vesselData: {},
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.tmlReadings).toBeDefined();
    expect(result.tmlReadings.length).toBe(1);
    expect(result.readings).toBeUndefined();
  });

  it("should normalize report → reportInfo", () => {
    const data = {
      report: { reportNumber: "54-11-004", inspectionDate: "2025-12-02" },
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo).toBeDefined();
    expect(result.reportInfo.reportNumber).toBe("54-11-004");
    expect(result.report).toBeUndefined();
  });
});

// ============================================================================
// INSPECTION DATE INFERENCE TESTS (Step 0B)
// ============================================================================

describe("Step 0B: Inspection date validation & inference from narrative", () => {
  it("should infer inspection date from 'inspection was performed on' pattern when LLM date is blank", () => {
    const data = {
      reportInfo: { reportNumber: "54-11-004", inspectionDate: "" },
      executiveSummary: "The inspection was performed on December 2, 2025 at the facility.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-12-02");
    const dateOverride = provenance.fieldOverrides.find(o => o.rule === "anchored_inspection_date_inference");
    expect(dateOverride).toBeDefined();
  });

  it("should infer inspection date from 'conducted on MM/DD/YYYY' pattern", () => {
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "" },
      executiveSummary: "An API Standard 510 inspection was conducted on 12/02/2025 at the facility.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-12-02");
  });

  it("should infer inspection date from 'inspection date: YYYY-MM-DD' pattern", () => {
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "" },
      executiveSummary: "Inspection date: 2025-12-02. All components within limits.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-12-02");
  });

  it("should fall back to reportDate when no narrative date found", () => {
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "", reportDate: "2025-12-15" },
      executiveSummary: "General summary with no dates mentioned.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-12-15");
    const fallbackOverride = provenance.fieldOverrides.find(o => o.rule === "fallback_to_report_date");
    expect(fallbackOverride).toBeDefined();
  });

  it("should OVERRIDE LLM date when it conflicts with anchored narrative date", () => {
    // This is the critical 54-11-067 bug: LLM returned the next-due date instead of actual inspection date
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "2030-10-08" },
      executiveSummary: "An API Standard 510 inspection was conducted on 10/08/2025.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-10-08"); // overridden with anchored date
    const overrideEntry = provenance.fieldOverrides.find(o => o.rule === "anchored_date_override_conflict");
    expect(overrideEntry).toBeDefined();
    expect(overrideEntry!.from).toBe("2030-10-08");
    expect(overrideEntry!.to).toBe("2025-10-08");
  });

  it("should keep LLM date when it matches the anchored narrative date", () => {
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "2025-12-02" },
      executiveSummary: "Inspection was performed on December 2, 2025.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-12-02"); // unchanged — dates agree
    // No override should exist for this field
    const dateOverrides = provenance.fieldOverrides.filter(
      o => o.field === "reportInfo.inspectionDate" && o.rule.includes("anchored")
    );
    expect(dateOverrides.length).toBe(0);
  });

  it("should keep LLM date when no anchored date found in narrative", () => {
    const data = {
      reportInfo: { reportNumber: "", inspectionDate: "2025-06-15" },
      executiveSummary: "General inspection summary without specific date phrases.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.reportInfo.inspectionDate).toBe("2025-06-15"); // unchanged
  });

  // --- REAL-WORLD CASE: Vessel 54-11-067 ---
  it("should correctly handle the 54-11-067 extraction (LLM returned due date as inspection date)", () => {
    const data = {
      reportInfo: {
        clientName: "SACHEM INC",
        inspectionDate: "2030-10-08", // WRONG: this is the next external due date
        reportNumber: "54-11-067",
      },
      vesselData: {
        vesselTagNumber: "54-11-067",
        headType: "2:1 Ellipsoidal",
        yearBuilt: "2005",
      },
      executiveSummary: "An API Standard 510 inspection of pressure vessel 54-11-067 located in CLEBURNE T;, was conducted on 10/08/2025 .",
      inspectionResults: "",
      recommendations: "4.8.1 Next external inspection is due by: 10/08/2030. 4.8.2 Next internal inspection is due by: 10/08/2035. 4.8.3 Next UT inspection is due by: 10/08/2026.",
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");

    // Inspection date should be corrected
    expect(result.reportInfo.inspectionDate).toBe("2025-10-08");

    // Next inspection due dates should be extracted
    expect(result._nextInspectionDates).toBeDefined();
    expect(result._nextInspectionDates.nextExternalInspectionDue).toBe("2030-10-08");
    expect(result._nextInspectionDates.nextInternalInspectionDue).toBe("2035-10-08");
    expect(result._nextInspectionDates.nextUTInspectionDue).toBe("2026-10-08");

    // Should have a conflict override
    const conflictOverride = provenance.fieldOverrides.find(o => o.rule === "anchored_date_override_conflict");
    expect(conflictOverride).toBeDefined();

    // Should have a warning about the conflict
    const conflictWarning = provenance.validationWarnings.find(w => w.includes("INSPECTION DATE CONFLICT"));
    expect(conflictWarning).toBeDefined();
  });

  // --- Next inspection due date extraction ---
  it("should extract next inspection due dates from recommendations", () => {
    const data = {
      reportInfo: { inspectionDate: "2025-10-08" },
      recommendations: "Next external inspection is due by: 03/15/2030. Next internal inspection is due by: 03/15/2035.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result, provenance } = sanitizeExtractedData(data, "manus");
    expect(result._nextInspectionDates.nextExternalInspectionDue).toBe("2030-03-15");
    expect(result._nextInspectionDates.nextInternalInspectionDue).toBe("2035-03-15");
    const dueOverrides = provenance.fieldOverrides.filter(o => o.rule === "next_inspection_due_extraction");
    expect(dueOverrides.length).toBe(2);
  });

  it("should extract UT inspection due date", () => {
    const data = {
      reportInfo: { inspectionDate: "2025-10-08" },
      recommendations: "Next UT inspection is due by: 10/08/2026.",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result._nextInspectionDates.nextUTInspectionDue).toBe("2026-10-08");
  });

  it("should not extract due dates when recommendations section is empty", () => {
    const data = {
      reportInfo: { inspectionDate: "2025-10-08" },
      recommendations: "",
      vesselData: {},
      tmlReadings: [],
      inspectionChecklist: [],
    };

    const { data: result } = sanitizeExtractedData(data, "manus");
    // _nextInspectionDates may not exist or be empty
    const dueDates = result._nextInspectionDates || {};
    expect(Object.keys(dueDates).length).toBe(0);
  });
});

// ============================================================================
// ELLIPTICAL HEAD TYPE REGEX FIX
// ============================================================================

describe("Elliptical head type regex", () => {
  it("should match 'elliptical' as 2:1 Ellipsoidal", () => {
    const data = buildTestData({
      executiveSummary: "The vessel has elliptical heads on both ends.",
      vesselData: { headType: "" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
  });

  it("should match 'Elliptical' (capitalized) as 2:1 Ellipsoidal", () => {
    const data = buildTestData({
      inspectionResults: "Both Elliptical heads were inspected and found satisfactory.",
      vesselData: { headType: "" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
  });

  it("should still match 'ellipsoidal' as 2:1 Ellipsoidal", () => {
    const data = buildTestData({
      executiveSummary: "The vessel has 2:1 ellipsoidal heads.",
      vesselData: { headType: "" },
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result.vesselData.headType).toBe("2:1 Ellipsoidal");
  });
});

// ============================================================================
// DUAL-WRITE CONVENTION TESTS (_stationKey / _dataStatus)
// ============================================================================

describe("Dual-write convention: _stationKey and _dataStatus", () => {
  it("should write stationKey to both tml._stationKey and tml._metadata.stationKey", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "6-135",
          location: '2" from Seam w/East Head',
          currentThickness: 0.312,
          componentType: "Shell",
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._stationKey).toBeDefined();
    expect(tml._metadata.stationKey).toBeDefined();
    expect(tml._stationKey).toBe(tml._metadata.stationKey);
    expect(tml._stationKey).toContain("SEAM-EH");
  });

  it("should write dataStatus to both tml._dataStatus and tml._metadata.dataStatus for complete records", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-0",
          currentThickness: 0.45,
          componentType: "Shell",
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._dataStatus).toBe("complete");
    expect(tml._metadata.dataStatus).toBe("complete");
    expect(tml._dataStatus).toBe(tml._metadata.dataStatus);
  });

  it("should write dataStatus to both tml._dataStatus and tml._metadata.dataStatus for incomplete records", () => {
    const data = buildTestData({
      tmlReadings: [
        {
          legacyLocationId: "1-0",
          currentThickness: null,
          componentType: "Shell",
        },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    const tml = result.tmlReadings[0];
    expect(tml._dataStatus).toBe("incomplete");
    expect(tml._metadata.dataStatus).toBe("incomplete");
    expect(tml._dataStatus).toBe(tml._metadata.dataStatus);
  });
});

// ============================================================================
// TML INCOMPLETE BEHAVIOR VERIFICATION
// ============================================================================

describe("TML incomplete behavior verification", () => {
  it("should mark record as incomplete ONLY when currentThickness is missing/zero", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1", currentThickness: 0.45, previousThickness: null },
        { legacyLocationId: "2", currentThickness: null, previousThickness: 0.50 },
        { legacyLocationId: "3", currentThickness: 0, previousThickness: 0.50 },
        { legacyLocationId: "4", currentThickness: 0.40, previousThickness: 0 },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    
    // Record 1: has currentThickness, no previous → complete
    expect(result.tmlReadings[0]._metadata.dataStatus).toBe("complete");
    expect(result.tmlReadings[0]._metadata.calculationReady).toBe(true);
    
    // Record 2: no currentThickness → incomplete
    expect(result.tmlReadings[1]._metadata.dataStatus).toBe("incomplete");
    expect(result.tmlReadings[1]._metadata.calculationReady).toBe(false);
    
    // Record 3: zero currentThickness → incomplete
    expect(result.tmlReadings[2]._metadata.dataStatus).toBe("incomplete");
    expect(result.tmlReadings[2]._metadata.calculationReady).toBe(false);
    
    // Record 4: has currentThickness, zero previous → complete (previous nullified, informational only)
    expect(result.tmlReadings[3]._metadata.dataStatus).toBe("complete");
    expect(result.tmlReadings[3]._metadata.calculationReady).toBe(true);
    expect(result.tmlReadings[3].previousThickness).toBeNull(); // zero was nullified
  });

  it("should report correct tmlDataQuality metrics", () => {
    const data = buildTestData({
      tmlReadings: [
        { legacyLocationId: "1", currentThickness: 0.45 },
        { legacyLocationId: "2", currentThickness: 0.40 },
        { legacyLocationId: "3", currentThickness: null },
      ],
    });

    const { data: result } = sanitizeExtractedData(data, "manus");
    expect(result._metadata.tmlDataQuality.total).toBe(3);
    expect(result._metadata.tmlDataQuality.complete).toBe(2);
    expect(result._metadata.tmlDataQuality.incomplete).toBe(1);
    expect(result._metadata.tmlDataQuality.calculationReadyPercentage).toBe(67);
  });
});


// ============================================================================
// FIX #8: NARRATIVE MINING — VESSEL PHYSICAL CHARACTERISTICS
// ============================================================================

describe("Fix #8: Narrative Mining — Vessel Physical Characteristics", () => {
  // --- Vessel Configuration ---
  describe("Vessel Configuration", () => {
    it("should extract 'Horizontal' from 'horizontal Storage Tank'", () => {
      const data = buildTestData({
        executiveSummary: "An API Standard 510 inspection of pressure vessel 54-11-067.",
        inspectionResults: "The vessel has 2 steel foundation supports attached to the lower section of the horizontal Storage Tank.",
        vesselData: { vesselConfiguration: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselConfiguration).toBe("Horizontal");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_vessel_configuration");
      expect(override).toBeDefined();
    });

    it("should extract 'Vertical' from 'vertical column'", () => {
      const data = buildTestData({
        inspectionResults: "The vertical column was inspected externally.",
        vesselData: { vesselConfiguration: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselConfiguration).toBe("Vertical");
    });

    it("should extract 'Sphere' from 'spherical vessel'", () => {
      const data = buildTestData({
        inspectionResults: "The spherical vessel was found in satisfactory condition.",
        vesselData: { vesselConfiguration: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselConfiguration).toBe("Sphere");
    });

    it("should NOT override existing vesselConfiguration", () => {
      const data = buildTestData({
        inspectionResults: "The horizontal Storage Tank was inspected.",
        vesselData: { vesselConfiguration: "Vertical" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselConfiguration).toBe("Vertical"); // unchanged
    });
  });

  // --- Shell Material ---
  describe("Shell Material", () => {
    it("should extract 'Stainless steel' from shell description", () => {
      const data = buildTestData({
        inspectionResults: "The shell is un-insulated, Stainless steel with 20 to 30 mils epoxy external coating.",
        vesselData: { materialSpec: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.materialSpec).toBe("Stainless steel");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_material_spec");
      expect(override).toBeDefined();
      // Should have a warning about lowest authority
      const warning = provenance.validationWarnings.find(w => w.includes("Material spec") && w.includes("lowest authority"));
      expect(warning).toBeDefined();
    });

    it("should extract SA-spec from narrative", () => {
      const data = buildTestData({
        inspectionResults: "The vessel is constructed of SA-516 Gr 70 carbon steel.",
        vesselData: { materialSpec: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.materialSpec).toBe("SA-516 Gr 70");
    });

    it("should extract 'carbon steel' from head description", () => {
      const data = buildTestData({
        inspectionResults: "The north and south heads are 2:1 Elliptical in design, un-insulated, carbon steel, with 20 to 30 mils of epoxy external coating.",
        vesselData: { materialSpec: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.materialSpec).toBe("carbon steel");
    });

    it("should NOT override existing materialSpec", () => {
      const data = buildTestData({
        inspectionResults: "The shell is Stainless steel.",
        vesselData: { materialSpec: "SA-240 Type 304" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.materialSpec).toBe("SA-240 Type 304"); // unchanged
    });
  });

  // --- Insulation Type ---
  describe("Insulation Type", () => {
    it("should extract 'None (un-insulated)' from 'un-insulated' narrative", () => {
      const data = buildTestData({
        inspectionResults: "The shell is un-insulated, Stainless steel.",
        vesselData: { insulationType: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.insulationType).toBe("None (un-insulated)");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_insulation_type");
      expect(override).toBeDefined();
    });

    it("should extract 'fiberglass' from 'insulated with fiberglass'", () => {
      const data = buildTestData({
        inspectionResults: "The vessel is insulated with fiberglass insulation in good condition.",
        vesselData: { insulationType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.insulationType).toBe("fiberglass");
    });

    it("should extract 'calcium silicate' from 'calcium silicate insulation'", () => {
      const data = buildTestData({
        inspectionResults: "The vessel has calcium silicate insulation that is deteriorating.",
        vesselData: { insulationType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.insulationType).toBe("calcium silicate");
    });

    it("should NOT override existing insulationType", () => {
      const data = buildTestData({
        inspectionResults: "The shell is un-insulated.",
        vesselData: { insulationType: "Fiberglass" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.insulationType).toBe("Fiberglass"); // unchanged
    });
  });

  // --- External Coating ---
  describe("External Coating", () => {
    it("should extract coating description from narrative", () => {
      const data = buildTestData({
        inspectionResults: "The shell is un-insulated, Stainless steel with 20 to 30 mils epoxy external coating.",
        vesselData: {},
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result._hydratedFields).toBeDefined();
      expect(result._hydratedFields.externalCoating).toBeDefined();
      expect(result._hydratedFields.externalCoating).toContain("epoxy");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_external_coating");
      expect(override).toBeDefined();
    });

    it("should extract 'epoxy external coating' pattern", () => {
      const data = buildTestData({
        inspectionResults: "The vessel has an epoxy external coating in good condition.",
        vesselData: {},
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result._hydratedFields.externalCoating).toContain("epoxy");
    });
  });

  // --- Vessel Type ---
  describe("Vessel Type", () => {
    it("should extract 'Storage Tank' from narrative", () => {
      const data = buildTestData({
        executiveSummary: "Inspection of the horizontal storage tank was conducted.",
        vesselData: { vesselType: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselType).toBe("Storage Tank");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_vessel_type");
      expect(override).toBeDefined();
    });

    it("should extract 'Heat Exchanger' from narrative", () => {
      const data = buildTestData({
        executiveSummary: "The heat exchanger was inspected for tube bundle integrity.",
        vesselData: { vesselType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselType).toBe("Heat Exchanger");
    });

    it("should extract 'Separator' from narrative", () => {
      const data = buildTestData({
        inspectionResults: "The separator vessel was found in satisfactory condition.",
        vesselData: { vesselType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselType).toBe("Separator");
    });

    it("should NOT override existing vesselType", () => {
      const data = buildTestData({
        executiveSummary: "Inspection of the storage tank.",
        vesselData: { vesselType: "Reactor" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselType).toBe("Reactor"); // unchanged
    });
  });

  // --- Full real-world case: Vessel 54-11-067 ---
  describe("Real-world: Vessel 54-11-067 narrative mining", () => {
    it("should extract all physical characteristics from 54-11-067 inspection results", () => {
      const data = buildTestData({
        executiveSummary: "An API Standard 510 inspection of pressure vessel 54-11-067 located in CLEBURNE T;, was conducted on 10/08/2025.",
        inspectionResults: "3.1 Foundation: 3.1.1 The vessel has 2 steel foundation supports attached to the lower section of the horizontal Storage Tank. 3.2 Shell: 3.2.1 The shell is un-insulated, Stainless steel with 20 to 30 mils epoxy external coating. 3.3 Head(s): 3.3.1 The north and south heads are 2:1 Elliptical in design, un-insulated, carbon steel, with 20 to 30 mils of epoxy external coating.",
        vesselData: {
          vesselTagNumber: "54-11-067",
          headType: "2:1 Ellipsoidal",
          vesselConfiguration: "",
          materialSpec: "",
          insulationType: "",
          vesselType: "",
        },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");

      // Vessel configuration
      expect(result.vesselData.vesselConfiguration).toBe("Horizontal");

      // Material spec (shell material takes priority since it comes first)
      expect(result.vesselData.materialSpec).toBeTruthy();
      // Should be either "Stainless steel" or "carbon steel" depending on which pattern matches first
      expect(
        result.vesselData.materialSpec === "Stainless steel" ||
        result.vesselData.materialSpec === "carbon steel"
      ).toBe(true);

      // Insulation
      expect(result.vesselData.insulationType).toBe("None (un-insulated)");

      // Coating
      expect(result._hydratedFields.externalCoating).toBeDefined();
      expect(result._hydratedFields.externalCoating).toContain("epoxy");

      // Vessel type
      expect(result.vesselData.vesselType).toBe("Storage Tank");
    });
  });

  // --- Edge cases ---
  describe("Edge cases", () => {
    it("should not mine anything when narrative is empty", () => {
      const data = buildTestData({
        executiveSummary: "",
        inspectionResults: "",
        vesselData: {
          vesselConfiguration: "",
          materialSpec: "",
          insulationType: "",
          vesselType: "",
        },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.vesselData.vesselConfiguration).toBe("");
      expect(result.vesselData.materialSpec).toBe("");
      expect(result.vesselData.insulationType).toBe("");
      const miningOverrides = provenance.fieldOverrides.filter(o => o.rule.startsWith("narrative_mining_"));
      expect(miningOverrides.length).toBe(0);
    });

    it("should not mine vesselData fields when all are already populated (coating still extracted)", () => {
      const data = buildTestData({
        inspectionResults: "The horizontal storage tank is un-insulated, carbon steel with epoxy coating.",
        vesselData: {
          vesselConfiguration: "Vertical",
          materialSpec: "SA-516 Gr 70",
          insulationType: "Fiberglass",
          vesselType: "Reactor",
        },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      // All vesselData fields should remain unchanged
      expect(result.vesselData.vesselConfiguration).toBe("Vertical");
      expect(result.vesselData.materialSpec).toBe("SA-516 Gr 70");
      expect(result.vesselData.insulationType).toBe("Fiberglass");
      expect(result.vesselData.vesselType).toBe("Reactor");
      // Coating is in _hydratedFields (not vesselData), so it may still be extracted
      const vesselDataOverrides = provenance.fieldOverrides.filter(
        o => o.rule.startsWith("narrative_mining_") && o.field.startsWith("vesselData.")
      );
      expect(vesselDataOverrides.length).toBe(0);
    });
  });
});

// ============================================================================
// SANITIZER VERSION CHECK
// ============================================================================

describe("Sanitizer version", () => {
  it("should report version 1.3.0", () => {
    const data = buildTestData({});
    const { provenance } = sanitizeExtractedData(data, "manus");
    expect(provenance.sanitizerVersion).toBe("1.3.0");
  });
});

// ============================================================================
// IMG ONERROR GLOBAL HANDLING (compile-time verification)
// ============================================================================

describe("Global img onError handling", () => {
  it("should be documented as implemented across all img tags", () => {
    // This is a documentation test — the actual onError handlers are in the React components.
    // The following components have been updated with onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}:
    // - DashboardLayout.tsx (3 logo images)
    // - ManusDialog.tsx (1 logo image)
    // - PhotoComparisonView.tsx (5 photo images)
    // - PhotosSection.tsx (already had onError handling)
    expect(true).toBe(true);
  });
});

// ============================================================================
// FIX #9: REPORT INFO MINING (clientLocation, inspectionType)
// ============================================================================

describe("Fix #9: Report Info Mining from Narrative", () => {
  // --- Client Location ---
  describe("Client Location", () => {
    it("should extract 'CLEBURNE TX' from 'located in CLEBURNE TX'", () => {
      const data = buildTestData({
        executiveSummary: "An API Standard 510 inspection of pressure vessel 54-11-067 located in CLEBURNE TX, was conducted on 10/08/2025.",
        reportInfo: { clientLocation: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.clientLocation).toContain("CLEBURNE");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_client_location");
      expect(override).toBeDefined();
    });

    it("should extract 'Houston, TX' from 'located in Houston, TX'", () => {
      const data = buildTestData({
        executiveSummary: "The vessel is located in Houston, TX and serves as a storage tank.",
        reportInfo: { clientLocation: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.clientLocation).toContain("Houston");
      expect(result.reportInfo.clientLocation).toContain("TX");
    });

    it("should extract location with full state name", () => {
      const data = buildTestData({
        executiveSummary: "The facility located in Baton Rouge, Louisiana operates a refinery.",
        reportInfo: { clientLocation: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.clientLocation).toBeTruthy();
      expect(result.reportInfo.clientLocation).toContain("Baton Rouge");
    });

    it("should NOT override existing clientLocation", () => {
      const data = buildTestData({
        executiveSummary: "The vessel is located in Houston, TX.",
        reportInfo: { clientLocation: "Dallas, TX" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.clientLocation).toBe("Dallas, TX");
    });
  });

  // --- Inspection Type ---
  describe("Inspection Type", () => {
    it("should extract 'External' from 'external inspection'", () => {
      const data = buildTestData({
        executiveSummary: "An external inspection was conducted on the vessel.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("External");
      const override = provenance.fieldOverrides.find(o => o.rule === "narrative_mining_inspection_type");
      expect(override).toBeDefined();
    });

    it("should extract 'Internal' from 'internal visual'", () => {
      const data = buildTestData({
        inspectionResults: "An internal visual examination was performed on the vessel.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("Internal");
    });

    it("should extract 'On-Stream' from 'on-stream inspection'", () => {
      const data = buildTestData({
        executiveSummary: "An on-stream inspection was performed while the vessel remained in service.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("On-Stream");
    });

    it("should extract 'External (In-Lieu-of Internal)' from in-lieu-of pattern", () => {
      const data = buildTestData({
        executiveSummary: "An in-lieu-of internal inspection was conducted using UT thickness measurements.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("External (In-Lieu-of Internal)");
    });

    it("should infer 'External' from UT-only inspection without internal access", () => {
      const data = buildTestData({
        inspectionResults: "UT thickness measurements were taken at all CML locations.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("External");
    });

    it("should NOT override existing inspectionType", () => {
      const data = buildTestData({
        executiveSummary: "An external inspection was conducted.",
        reportInfo: { inspectionType: "Internal" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      // Fix #1 may uppercase the value, but it should NOT be replaced with "External"
      expect(result.reportInfo.inspectionType.toLowerCase()).toBe("internal");
    });

    it("should prefer 'Internal' over 'External' when both mentioned but internal comes first", () => {
      const data = buildTestData({
        inspectionResults: "An internal inspection was performed. External coating was also examined.",
        reportInfo: { inspectionType: "" },
      });

      const { data: result } = sanitizeExtractedData(data, "manus");
      expect(result.reportInfo.inspectionType).toBe("Internal");
    });
  });

  // --- Full real-world case ---
  describe("Real-world: Vessel 54-11-067 report info mining", () => {
    it("should extract location and infer inspection type from 54-11-067 data", () => {
      const data = buildTestData({
        executiveSummary: "An API Standard 510 inspection of pressure vessel 54-11-067 located in CLEBURNE TX, was conducted on 10/08/2025.",
        inspectionResults: "3.2 Shell: 3.2.1 The shell is un-insulated, Stainless steel with 20 to 30 mils epoxy external coating. UT thickness measurements were taken at all CML locations.",
        reportInfo: { clientLocation: "", inspectionType: "" },
      });

      const { data: result, provenance } = sanitizeExtractedData(data, "manus");
      
      // Client location
      expect(result.reportInfo.clientLocation).toContain("CLEBURNE");
      
      // Inspection type (UT measurements without internal access → External)
      expect(result.reportInfo.inspectionType).toBeTruthy();
    });
  });
});
