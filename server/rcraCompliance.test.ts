import { describe, it, expect } from "vitest";

// Test RCRA checklist categories
describe("RCRA Compliance Checklist Categories", () => {
  const categories = [
    "integrity_assessment",
    "daily_visual",
    "corrosion_protection",
    "secondary_containment",
    "ancillary_equipment",
    "air_emission_controls",
    "leak_detection",
    "spill_overfill_prevention",
  ];

  it("should have all required RCRA categories", () => {
    expect(categories).toHaveLength(8);
    expect(categories).toContain("integrity_assessment");
    expect(categories).toContain("secondary_containment");
    expect(categories).toContain("corrosion_protection");
  });

  it("should have proper category naming convention", () => {
    categories.forEach(cat => {
      expect(cat).toMatch(/^[a-z_]+$/);
    });
  });
});

// Test containment compliance calculation
describe("Secondary Containment Compliance Calculation", () => {
  const calculateContainmentCompliance = (
    capacityGallons: number,
    largestTankGallons: number,
    stormWaterCapacityGallons: number
  ) => {
    const requiredCapacity = largestTankGallons + stormWaterCapacityGallons;
    const isCompliant = capacityGallons >= requiredCapacity;
    return {
      requiredCapacity,
      actualCapacity: capacityGallons,
      isCompliant,
      deficit: isCompliant ? 0 : requiredCapacity - capacityGallons,
      surplus: isCompliant ? capacityGallons - requiredCapacity : 0,
      compliancePercent: (capacityGallons / requiredCapacity) * 100,
    };
  };

  it("should calculate compliant containment correctly", () => {
    // 10,000 gallon tank + 2,500 gallon storm = 12,500 required
    // 15,000 gallon containment = compliant
    const result = calculateContainmentCompliance(15000, 10000, 2500);
    expect(result.isCompliant).toBe(true);
    expect(result.requiredCapacity).toBe(12500);
    expect(result.surplus).toBe(2500);
    expect(result.deficit).toBe(0);
  });

  it("should calculate non-compliant containment correctly", () => {
    // 10,000 gallon tank + 2,500 gallon storm = 12,500 required
    // 10,000 gallon containment = non-compliant
    const result = calculateContainmentCompliance(10000, 10000, 2500);
    expect(result.isCompliant).toBe(false);
    expect(result.requiredCapacity).toBe(12500);
    expect(result.deficit).toBe(2500);
    expect(result.surplus).toBe(0);
  });

  it("should calculate compliance percentage correctly", () => {
    const result = calculateContainmentCompliance(12500, 10000, 2500);
    expect(result.compliancePercent).toBe(100);
  });

  it("should handle edge case of exact compliance", () => {
    const result = calculateContainmentCompliance(12500, 10000, 2500);
    expect(result.isCompliant).toBe(true);
    expect(result.surplus).toBe(0);
    expect(result.deficit).toBe(0);
  });
});

// Test regulatory references
describe("RCRA Regulatory References", () => {
  const regulatoryReferences = [
    "40 CFR 265.191(a)",
    "40 CFR 265.191(b)",
    "40 CFR 265.191(b)(3)",
    "40 CFR 265.193(a)",
    "40 CFR 265.193(b)",
    "40 CFR 265.193(c)",
    "40 CFR 265.193(c)(1)",
    "40 CFR 265.193(c)(4)",
    "40 CFR 265.193(f)(1)",
    "40 CFR 265.193(g)",
    "40 CFR 265.194(a)",
    "40 CFR 265.194(b)",
    "40 CFR 265.195(a)",
    "40 CFR 265.195(b)",
    "40 CFR 265.196",
    "40 CFR 265.1085",
    "40 CFR 265.1085(c)",
    "40 CFR 265.1085(d)",
    "40 CFR 265.1085(e)",
    "40 CFR 265.1090",
    "40 CFR 265.16",
    "NACE SP0169",
  ];

  it("should have valid CFR reference format", () => {
    const cfrReferences = regulatoryReferences.filter(r => r.startsWith("40 CFR"));
    cfrReferences.forEach(ref => {
      expect(ref).toMatch(/^40 CFR 265\.\d+/);
    });
  });

  it("should include key tank system regulations", () => {
    expect(regulatoryReferences).toContain("40 CFR 265.191(a)"); // Integrity assessment
    expect(regulatoryReferences).toContain("40 CFR 265.193(a)"); // Containment
    expect(regulatoryReferences).toContain("40 CFR 265.195(a)"); // Inspections
  });

  it("should include NACE corrosion standard", () => {
    expect(regulatoryReferences).toContain("NACE SP0169");
  });
});

// Test inspection schedule frequencies
describe("RCRA Inspection Schedule Frequencies", () => {
  const schedules = [
    { type: "daily_visual", frequencyDays: 1 },
    { type: "bimonthly_impressed_current", frequencyDays: 60 },
    { type: "annual_cathodic_protection", frequencyDays: 365 },
    { type: "annual_leak_test", frequencyDays: 365 },
    { type: "pe_integrity_assessment", frequencyDays: 1825 }, // 5 years
  ];

  it("should have daily visual inspection", () => {
    const daily = schedules.find(s => s.type === "daily_visual");
    expect(daily?.frequencyDays).toBe(1);
  });

  it("should have bimonthly impressed current check", () => {
    const bimonthly = schedules.find(s => s.type === "bimonthly_impressed_current");
    expect(bimonthly?.frequencyDays).toBe(60);
  });

  it("should have annual cathodic protection survey", () => {
    const annual = schedules.find(s => s.type === "annual_cathodic_protection");
    expect(annual?.frequencyDays).toBe(365);
  });

  it("should have 5-year PE integrity assessment", () => {
    const pe = schedules.find(s => s.type === "pe_integrity_assessment");
    expect(pe?.frequencyDays).toBe(1825);
  });
});

// Test checklist item structure
describe("RCRA Checklist Item Structure", () => {
  const sampleItem = {
    code: "IA-001",
    description: "Tank system designed and constructed to contain hazardous waste",
    reference: "40 CFR 265.191(a)",
  };

  it("should have proper item code format", () => {
    expect(sampleItem.code).toMatch(/^[A-Z]{2}-\d{3}$/);
  });

  it("should have description", () => {
    expect(sampleItem.description.length).toBeGreaterThan(10);
  });

  it("should have regulatory reference", () => {
    expect(sampleItem.reference).toBeTruthy();
  });
});

// Test status enum values
describe("RCRA Status Values", () => {
  const statusValues = ["satisfactory", "unsatisfactory", "na", "not_inspected"];

  it("should have all required status values", () => {
    expect(statusValues).toContain("satisfactory");
    expect(statusValues).toContain("unsatisfactory");
    expect(statusValues).toContain("na");
    expect(statusValues).toContain("not_inspected");
  });
});
