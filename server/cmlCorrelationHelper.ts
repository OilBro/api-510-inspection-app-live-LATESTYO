import { getDb } from "./db";
import { cmlCorrelations, tmlReadings } from "../drizzle/schema";
import { eq, and, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Get correlated TML readings for corrosion rate calculation
 * Maps baseline CML locations to current inspection locations
 */
export async function getCorrelatedTMLReadings(
  currentInspectionId: string,
  baselineInspectionId: string,
  component: string
) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all correlation mappings for this inspection
  const correlations = await db
    .select()
    .from(cmlCorrelations)
    .where(eq(cmlCorrelations.inspectionId, currentInspectionId));
  
  // Get all TML readings for both inspections
  const [currentReadings, baselineReadings] = await Promise.all([
    db
      .select()
      .from(tmlReadings)
      .where(
        and(
          eq(tmlReadings.inspectionId, currentInspectionId),
          eq(tmlReadings.component, component)
        )
      ),
    db
      .select()
      .from(tmlReadings)
      .where(
        and(
          eq(tmlReadings.inspectionId, baselineInspectionId),
          eq(tmlReadings.component, component)
        )
      ),
  ]);
  
  // Map current readings to baseline readings using correlations
  const correlatedPairs: Array<{
    current: typeof currentReadings[0];
    baseline: typeof baselineReadings[0] | null;
  }> = [];
  
  for (const currentReading of currentReadings) {
    // Find correlation mapping for this reading
    const correlation = correlations.find((c) =>
      currentReading.location?.includes(c.currentCML) ||
      currentReading.cmlNumber?.includes(c.currentCML)
    );
    
    if (correlation) {
      // Find matching baseline reading
      const baselineReading = baselineReadings.find((b) =>
        b.location?.includes(correlation.baselineCML) ||
        b.cmlNumber?.includes(correlation.baselineCML)
      );
      
      correlatedPairs.push({
        current: currentReading,
        baseline: baselineReading || null,
      });
    } else {
      // No correlation found - try direct CML number match
      const baselineReading = baselineReadings.find(
        (b) => b.cmlNumber === currentReading.cmlNumber
      );
      
      correlatedPairs.push({
        current: currentReading,
        baseline: baselineReading || null,
      });
    }
  }
  
  return correlatedPairs;
}

/**
 * Import CML correlations from an array of correlation data
 */
export async function importCMLCorrelations(
  inspectionId: string,
  correlationData: Array<{
    baselineCML: string;
    baselineDescription?: string;
    currentCML: string;
    currentDescription?: string;
    correlationBasis?: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const records = correlationData.map((data) => ({
    id: nanoid(),
    inspectionId,
    baselineCML: data.baselineCML,
    baselineDescription: data.baselineDescription || null,
    currentCML: data.currentCML,
    currentDescription: data.currentDescription || null,
    correlationBasis: data.correlationBasis || null,
  }));
  
  await db.insert(cmlCorrelations).values(records);
  
  return records.length;
}

/**
 * Find correlation mapping for a specific CML
 */
export async function findCMLMapping(
  inspectionId: string,
  cmlIdentifier: string
) {
  const db = await getDb();
  if (!db) return null;
  
  const correlation = await db
    .select()
    .from(cmlCorrelations)
    .where(
      and(
        eq(cmlCorrelations.inspectionId, inspectionId),
        or(
          like(cmlCorrelations.baselineCML, `%${cmlIdentifier}%`),
          like(cmlCorrelations.currentCML, `%${cmlIdentifier}%`)
        )
      )
    )
    .limit(1);
  
  return correlation[0] || null;
}
