import { nanoid } from "nanoid";
import { getDb } from "./db";
import { inspections, reportAnomalies, tmlReadings, componentCalculations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface DetectedAnomaly {
  category: "thickness_below_minimum" | "high_corrosion_rate" | "missing_critical_data" | 
           "calculation_inconsistency" | "negative_remaining_life" | "excessive_thickness_variation" |
           "unusual_mawp" | "incomplete_tml_data";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affectedComponent?: string;
  detectedValue?: string;
  expectedRange?: string;
}

/**
 * Run comprehensive anomaly detection on an inspection
 */
export async function detectAnomalies(inspectionId: string): Promise<DetectedAnomaly[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const anomalies: DetectedAnomaly[] = [];

  // Get inspection data
  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId));
  if (!inspection) return anomalies;

  // 1. Check for missing critical data
  anomalies.push(...detectMissingCriticalData(inspection));

  // 2. Check TML readings for thickness anomalies
  const tmlData = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspectionId));
  anomalies.push(...detectThicknessAnomalies(tmlData, inspection));

  // 3. Check component calculations for anomalies
  // Note: componentCalculations uses reportId, need to find the report first
  const components = await db.select().from(componentCalculations).where(eq(componentCalculations.reportId, inspectionId));
  anomalies.push(...detectCalculationAnomalies(components, inspection));

  // 4. Check for excessive thickness variation
  anomalies.push(...detectThicknessVariation(tmlData));

  return anomalies;
}

/**
 * Detect missing critical data fields
 */
function detectMissingCriticalData(inspection: any): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  const criticalFields = [
    { field: "jointEfficiency", name: "Joint Efficiency (E)", severity: "critical" as const },
    { field: "materialSpec", name: "Material Specification", severity: "critical" as const },
    { field: "designPressure", name: "Design Pressure", severity: "critical" as const },
    { field: "allowableStress", name: "Allowable Stress (S)", severity: "warning" as const },
    { field: "insideDiameter", name: "Inside Diameter", severity: "warning" as const },
    { field: "specificGravity", name: "Specific Gravity (SG)", severity: "info" as const },
  ];

  for (const { field, name, severity } of criticalFields) {
    if (!inspection[field] || inspection[field] === null || inspection[field] === "") {
      anomalies.push({
        category: "missing_critical_data",
        severity,
        title: `Missing ${name}`,
        description: `${name} is required for accurate calculations but was not found in the imported data.`,
        affectedComponent: "Vessel Data",
        detectedValue: "Not provided",
        expectedRange: "Required field"
      });
    }
  }

  return anomalies;
}

/**
 * Detect thickness-related anomalies
 */
function detectThicknessAnomalies(tmlData: any[], inspection: any): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  // Calculate minimum required thickness (simplified)
  const P = parseFloat(inspection.designPressure || "0");
  const D = parseFloat(inspection.insideDiameter || "0");
  const S = parseFloat(inspection.allowableStress || "20000");
  const E = parseFloat(inspection.jointEfficiency || "0.85");
  const R = D / 2;

  if (P > 0 && R > 0 && S > 0 && E > 0) {
    const t_min_shell = (P * R) / (S * E - 0.6 * P);

    for (const reading of tmlData) {
      // Check all possible thickness fields
      const thicknessStr = reading.currentThickness || reading.newThickness || reading.actualThickness || reading.tml1 || "0";
      const thickness = parseFloat(thicknessStr);
      const location = reading.location || reading.legacyLocationId || "Unknown";

      // Check if thickness is below minimum
      if (thickness > 0 && thickness < t_min_shell) {
        anomalies.push({
          category: "thickness_below_minimum",
          severity: "critical",
          title: `Thickness Below Minimum at ${location}`,
          description: `Measured thickness (${thickness.toFixed(3)}") is below the minimum required thickness (${t_min_shell.toFixed(3)}"). This component requires immediate attention.`,
          affectedComponent: location,
          detectedValue: `${thickness.toFixed(3)} inches`,
          expectedRange: `≥ ${t_min_shell.toFixed(3)} inches`
        });
      }

      // Check for incomplete TML data
      if (!reading.currentThickness && !reading.newThickness && !reading.actualThickness && !reading.tml1) {
        anomalies.push({
          category: "incomplete_tml_data",
          severity: "warning",
          title: `Missing Thickness Reading at ${location}`,
          description: `No thickness measurement recorded for this location.`,
          affectedComponent: location,
          detectedValue: "No data",
          expectedRange: "Thickness measurement required"
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect calculation-related anomalies
 */
function detectCalculationAnomalies(components: any[], inspection: any): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const comp of components) {
    const componentName = comp.componentName || "Unknown Component";

    // Check for negative remaining life
    const remainingLife = parseFloat(comp.remainingLife || "0");
    if (remainingLife < 0) {
      anomalies.push({
        category: "negative_remaining_life",
        severity: "critical",
        title: `Negative Remaining Life: ${componentName}`,
        description: `Calculated remaining life is ${remainingLife.toFixed(1)} years. This indicates the component has exceeded its safe operating life and requires immediate replacement or repair.`,
        affectedComponent: componentName,
        detectedValue: `${remainingLife.toFixed(1)} years`,
        expectedRange: "> 0 years"
      });
    }

    // Check for unusually high corrosion rates
    const corrosionRate = parseFloat(comp.corrosionRate || "0");
    if (corrosionRate > 0.050) { // > 50 mils/year is unusually high
      anomalies.push({
        category: "high_corrosion_rate",
        severity: "warning",
        title: `High Corrosion Rate: ${componentName}`,
        description: `Corrosion rate of ${(corrosionRate * 1000).toFixed(1)} mils/year exceeds typical industry thresholds. Consider more frequent inspection intervals.`,
        affectedComponent: componentName,
        detectedValue: `${(corrosionRate * 1000).toFixed(1)} mils/year`,
        expectedRange: "< 50 mils/year (typical)"
      });
    }

    // Check for unusual MAWP
    const calculatedMAWP = parseFloat(comp.calculatedMAWP || "0");
    const designPressure = parseFloat(inspection.designPressure || "0");
    
    if (calculatedMAWP > 0 && designPressure > 0) {
      if (calculatedMAWP < designPressure * 0.8) {
        anomalies.push({
          category: "calculation_inconsistency",
          severity: "warning",
          title: `MAWP Below Design Pressure: ${componentName}`,
          description: `Calculated MAWP (${calculatedMAWP.toFixed(1)} psi) is significantly below design pressure (${designPressure.toFixed(1)} psi). Verify thickness measurements and material properties.`,
          affectedComponent: componentName,
          detectedValue: `${calculatedMAWP.toFixed(1)} psi`,
          expectedRange: `≥ ${(designPressure * 0.8).toFixed(1)} psi`
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect excessive thickness variation within components
 */
function detectThicknessVariation(tmlData: any[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  // Group readings by component
  const componentGroups: { [key: string]: number[] } = {};
  
  for (const reading of tmlData) {
    // Check all possible thickness fields
    const thicknessStr = reading.currentThickness || reading.newThickness || reading.actualThickness || reading.tml1 || "0";
    const thickness = parseFloat(thicknessStr);
    if (thickness <= 0) continue;

    const component = reading.component || "Unknown";
    if (!componentGroups[component]) {
      componentGroups[component] = [];
    }
    componentGroups[component].push(thickness);
  }

  // Check variation in each component
  for (const [component, thicknesses] of Object.entries(componentGroups)) {
    if (thicknesses.length < 3) continue; // Need at least 3 readings

    const min = Math.min(...thicknesses);
    const max = Math.max(...thicknesses);
    const avg = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length;
    const range = max - min;
    const percentVariation = (range / avg) * 100;

    // Flag if variation exceeds 20%
    if (percentVariation > 20) {
      anomalies.push({
        category: "excessive_thickness_variation",
        severity: "warning",
        title: `High Thickness Variation: ${component}`,
        description: `Thickness readings vary by ${percentVariation.toFixed(1)}% (${min.toFixed(3)}" to ${max.toFixed(3)}"). This may indicate localized corrosion or measurement inconsistencies.`,
        affectedComponent: component,
        detectedValue: `${percentVariation.toFixed(1)}% variation`,
        expectedRange: "< 20% variation"
      });
    }
  }

  return anomalies;
}

/**
 * Save detected anomalies to database
 */
export async function saveAnomalies(inspectionId: string, anomalies: DetectedAnomaly[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Clear existing anomalies for this inspection
  await db.delete(reportAnomalies).where(eq(reportAnomalies.inspectionId, inspectionId));

  // Insert new anomalies
  if (anomalies.length > 0) {
    await db.insert(reportAnomalies).values(
      anomalies.map(anomaly => ({
        id: nanoid(),
        inspectionId,
        category: anomaly.category,
        severity: anomaly.severity,
        title: anomaly.title,
        description: anomaly.description,
        affectedComponent: anomaly.affectedComponent || null,
        detectedValue: anomaly.detectedValue || null,
        expectedRange: anomaly.expectedRange || null,
        reviewStatus: "pending" as const,
        detectedAt: new Date(),
      }))
    );
  }

  // Update inspection anomaly count and review status
  const criticalCount = anomalies.filter(a => a.severity === "critical").length;
  const reviewStatus = criticalCount > 0 ? "pending_review" : "approved";

  await db.update(inspections)
    .set({ 
      anomalyCount: anomalies.length,
      reviewStatus: reviewStatus as any
    })
    .where(eq(inspections.id, inspectionId));
}

/**
 * Get anomalies for an inspection (excludes resolved/dismissed anomalies)
 */
export async function getAnomalies(inspectionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Only return anomalies that are not resolved (dismissed)
  return await db.select()
    .from(reportAnomalies)
    .where(
      and(
        eq(reportAnomalies.inspectionId, inspectionId),
        // Exclude resolved anomalies (these are "cleared/dismissed")
        // Show pending, acknowledged, and false_positive
        // resolved means user clicked "Clear All" or "Mark as Resolved"
        eq(reportAnomalies.reviewStatus, "pending")
      )
    );
}

/**
 * Mark anomaly as reviewed
 */
export async function reviewAnomaly(
  anomalyId: string,
  userId: number,
  status: "acknowledged" | "resolved" | "false_positive",
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(reportAnomalies)
    .set({
      reviewStatus: status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    })
    .where(eq(reportAnomalies.id, anomalyId));
}
