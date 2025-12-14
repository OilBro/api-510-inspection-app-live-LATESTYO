import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import { inspections, tmlReadings, componentCalculations } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { detectAnomalies, saveAnomalies, getAnomalies } from "./anomalyDetection";
import { eq } from "drizzle-orm";

describe("Anomaly Detection System", () => {
  let testInspectionId: string;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    testInspectionId = nanoid();

    // Create test inspection with some missing data
    await db.insert(inspections).values({
      id: testInspectionId,
      userId: 1,
      vesselTagNumber: "TEST-ANOMALY-001",
      vesselName: "Test Vessel for Anomaly Detection",
      designPressure: "150",
      insideDiameter: "48",
      // Missing critical fields: jointEfficiency, materialSpec, allowableStress
      status: "draft",
    });
  });

  it("should detect missing critical data", async () => {
    const anomalies = await detectAnomalies(testInspectionId);

    // Should detect missing jointEfficiency, materialSpec, and allowableStress
    const missingDataAnomalies = anomalies.filter(a => a.category === "missing_critical_data");
    expect(missingDataAnomalies.length).toBeGreaterThan(0);

    // Should have at least one critical severity anomaly
    const criticalAnomalies = anomalies.filter(a => a.severity === "critical");
    expect(criticalAnomalies.length).toBeGreaterThan(0);
  });

  it("should save and retrieve anomalies", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const anomalies = await detectAnomalies(testInspectionId);
    await saveAnomalies(testInspectionId, anomalies);

    // Retrieve saved anomalies
    const savedAnomalies = await getAnomalies(testInspectionId);
    expect(savedAnomalies.length).toBe(anomalies.length);

    // Check inspection anomalyCount was updated
    const [inspection] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
    expect(inspection.anomalyCount).toBe(anomalies.length);
  });

  it("should detect thickness below minimum", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Update inspection with complete data
    await db.update(inspections)
      .set({
        jointEfficiency: "0.85",
        materialSpec: "SA-516-70",
        allowableStress: "20000",
      })
      .where(eq(inspections.id, testInspectionId));

    // Add TML reading below minimum thickness
    await db.insert(tmlReadings).values({
      id: nanoid(),
      inspectionId: testInspectionId,
      cmlNumber: "CML-1",
      componentType: "Shell",
      location: "12 o'clock",
      tml1: "0.100", // Very thin - below minimum
      tActual: "0.100",
      currentThickness: "0.100",
      status: "good",
    });

    const anomalies = await detectAnomalies(testInspectionId);

    // Should detect thickness below minimum
    const thicknessAnomalies = anomalies.filter(a => a.category === "thickness_below_minimum");
    expect(thicknessAnomalies.length).toBeGreaterThan(0);
    expect(thicknessAnomalies[0].severity).toBe("critical");
  });

  it("should detect high corrosion rate", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create component calculation with high corrosion rate
    await db.insert(componentCalculations).values({
      id: nanoid(),
      reportId: testInspectionId,
      componentName: "Shell",
      componentType: "shell",
      corrosionRate: "0.060", // 60 mils/year - very high
      remainingLife: "5",
      calculatedMAWP: "140",
    });

    const anomalies = await detectAnomalies(testInspectionId);

    // Should detect high corrosion rate
    const corrosionAnomalies = anomalies.filter(a => a.category === "high_corrosion_rate");
    expect(corrosionAnomalies.length).toBeGreaterThan(0);
    expect(corrosionAnomalies[0].severity).toBe("warning");
  });

  it("should detect negative remaining life", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create component calculation with negative remaining life
    await db.insert(componentCalculations).values({
      id: nanoid(),
      reportId: testInspectionId,
      componentName: "East Head",
      componentType: "head",
      corrosionRate: "0.020",
      remainingLife: "-2.5", // Negative remaining life
      calculatedMAWP: "120",
    });

    const anomalies = await detectAnomalies(testInspectionId);

    // Should detect negative remaining life
    const lifeAnomalies = anomalies.filter(a => a.category === "negative_remaining_life");
    expect(lifeAnomalies.length).toBeGreaterThan(0);
    expect(lifeAnomalies[0].severity).toBe("critical");
  });

  it("should detect excessive thickness variation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Add multiple TML readings with high variation
    const readings = [
      { thickness: "0.500", location: "12 o'clock" },
      { thickness: "0.520", location: "3 o'clock" },
      { thickness: "0.300", location: "6 o'clock" }, // Much thinner
      { thickness: "0.510", location: "9 o'clock" },
    ];

    for (const reading of readings) {
      await db.insert(tmlReadings).values({
        id: nanoid(),
        inspectionId: testInspectionId,
        cmlNumber: "CML-2",
        componentType: "Shell",
        component: "Vessel Shell",
        location: reading.location,
        tml1: reading.thickness,
        tActual: reading.thickness,
        currentThickness: reading.thickness,
        status: "good",
      });
    }

    const anomalies = await detectAnomalies(testInspectionId);

    // Should detect excessive variation
    const variationAnomalies = anomalies.filter(a => a.category === "excessive_thickness_variation");
    expect(variationAnomalies.length).toBeGreaterThan(0);
  });

  it("should re-scan and update anomalies after data correction", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // First scan - should detect missing data
    const initialAnomalies = await detectAnomalies(testInspectionId);
    await saveAnomalies(testInspectionId, initialAnomalies);
    
    const initialCount = initialAnomalies.length;
    expect(initialCount).toBeGreaterThan(0);

    // Correct the data by adding missing fields
    await db.update(inspections)
      .set({
        jointEfficiency: "0.85",
        materialSpec: "SA-516-70",
        allowableStress: "20000",
        specificGravity: "1.0",
      })
      .where(eq(inspections.id, testInspectionId));

    // Re-scan after correction
    const updatedAnomalies = await detectAnomalies(testInspectionId);
    await saveAnomalies(testInspectionId, updatedAnomalies);

    // Should have fewer anomalies after correction
    expect(updatedAnomalies.length).toBeLessThan(initialCount);

    // Verify anomalyCount was updated
    const [inspection] = await db.select().from(inspections).where(eq(inspections.id, testInspectionId));
    expect(inspection.anomalyCount).toBe(updatedAnomalies.length);
  });
});
