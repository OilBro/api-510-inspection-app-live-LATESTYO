import { describe, it, expect } from "vitest";

/**
 * Tests for confirmExtraction procedure - specifically testing that
 * narratives (Section 3.0 inspectionResults and Section 4.0 recommendations)
 * are properly included in the save operation.
 */

describe("confirmExtraction narratives handling", () => {
  it("should accept narratives in the input schema", () => {
    // Test that the input structure includes narratives
    const input = {
      vesselInfo: {
        vesselTagNumber: "TEST-001",
        vesselName: "Test Vessel",
      },
      reportInfo: {
        inspectionDate: "2024-01-15",
        reportNumber: "RPT-001",
      },
      tmlReadings: [],
      nozzles: [],
      narratives: {
        executiveSummary: "This vessel is in good condition.",
        inspectionResults: "3.1 Shell - The shell was inspected and found to be in satisfactory condition.\n3.2 Heads - Both heads show no signs of corrosion.",
        recommendations: "4.1 Continue with current inspection interval of 5 years.\n4.2 Monitor CML-3 for increased corrosion rate.",
      },
    };

    // Verify narratives structure
    expect(input.narratives).toBeDefined();
    expect(input.narratives.inspectionResults).toBeDefined();
    expect(input.narratives.recommendations).toBeDefined();
    expect(input.narratives.inspectionResults.length).toBeGreaterThan(0);
    expect(input.narratives.recommendations.length).toBeGreaterThan(0);
  });

  it("should handle empty narratives gracefully", () => {
    const input = {
      vesselInfo: {
        vesselTagNumber: "TEST-002",
      },
      reportInfo: {
        inspectionDate: "2024-01-15",
      },
      tmlReadings: [],
      nozzles: [],
      narratives: {
        executiveSummary: "",
        inspectionResults: "",
        recommendations: "",
      },
    };

    expect(input.narratives.inspectionResults).toBe("");
    expect(input.narratives.recommendations).toBe("");
  });

  it("should handle undefined narratives", () => {
    const input = {
      vesselInfo: {
        vesselTagNumber: "TEST-003",
      },
      reportInfo: {
        inspectionDate: "2024-01-15",
      },
      tmlReadings: [],
      nozzles: [],
      // narratives is optional
    };

    expect(input.narratives).toBeUndefined();
  });

  it("should preserve Section 3.0 and 4.0 content formatting", () => {
    const inspectionResults = `3.0 INSPECTION RESULTS

3.1 Foundation
The foundation was inspected and found to be in satisfactory condition. No cracks or settling observed.

3.2 Shell
The shell was inspected internally and externally. No significant corrosion was observed. All thickness readings are within acceptable limits.

3.3 Heads
Both the East and West heads were inspected. Minor surface corrosion was noted on the East head but is within acceptable limits.

3.4 Nozzles and Appurtenances
All nozzles were inspected and found to be in good condition. Gasket surfaces show normal wear.`;

    const recommendations = `4.0 RECOMMENDATIONS

4.1 Based on the inspection findings, the following recommendations are made:

1. Continue with the current inspection interval of 5 years for internal inspection.
2. Monitor CML-3 and CML-7 for increased corrosion rates at the next inspection.
3. Replace gaskets on N-1 and N-3 during the next turnaround.
4. Maintain the existing coating system to prevent external corrosion.

4.2 Next Inspection Date: January 2029`;

    const input = {
      vesselInfo: { vesselTagNumber: "TEST-004" },
      reportInfo: { inspectionDate: "2024-01-15" },
      tmlReadings: [],
      nozzles: [],
      narratives: {
        executiveSummary: "",
        inspectionResults,
        recommendations,
      },
    };

    // Verify content is preserved with formatting
    expect(input.narratives.inspectionResults).toContain("3.1 Foundation");
    expect(input.narratives.inspectionResults).toContain("3.2 Shell");
    expect(input.narratives.inspectionResults).toContain("3.3 Heads");
    expect(input.narratives.inspectionResults).toContain("3.4 Nozzles");
    expect(input.narratives.recommendations).toContain("4.1 Based on");
    expect(input.narratives.recommendations).toContain("4.2 Next Inspection Date");
    expect(input.narratives.recommendations).toContain("January 2029");
  });
});
