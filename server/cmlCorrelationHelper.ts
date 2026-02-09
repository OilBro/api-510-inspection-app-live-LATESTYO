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
    matchMethod: 'stationKey' | 'correlation' | 'legacyLocationId' | 'none';
  }> = [];
  
  for (const currentReading of currentReadings) {
    let baselineReading: typeof baselineReadings[0] | null = null;
    let matchMethod: 'stationKey' | 'correlation' | 'legacyLocationId' | 'none' = 'none';
    
    // PRIORITY 1: Direct stationKey match (highest confidence)
    if (currentReading.stationKey) {
      baselineReading = baselineReadings.find(
        (b) => b.stationKey === currentReading.stationKey
      ) || null;
      
      if (baselineReading) {
        matchMethod = 'stationKey';
      }
    }
    
    // PRIORITY 2: Use correlation mapping (for cases where stationKey changed)
    if (!baselineReading) {
      // Use exact match on normalized strings to avoid false positives (e.g., N1 vs N10)
      const normalizedLocation = currentReading.location?.trim().toUpperCase() || '';
      const normalizedLegacyId = currentReading.legacyLocationId?.trim().toUpperCase() || '';
      
      const correlation = correlations.find((c) => {
        const normalizedCurrentCML = c.currentCML.trim().toUpperCase();
        return normalizedLocation === normalizedCurrentCML ||
               normalizedLegacyId === normalizedCurrentCML;
      });
      
      if (correlation) {
        const normalizedBaselineCML = correlation.baselineCML.trim().toUpperCase();
        baselineReading = baselineReadings.find((b) => {
          const bLocation = b.location?.trim().toUpperCase() || '';
          const bLegacyId = b.legacyLocationId?.trim().toUpperCase() || '';
          return bLocation === normalizedBaselineCML ||
                 bLegacyId === normalizedBaselineCML;
        }) || null;
        
        if (baselineReading) {
          matchMethod = 'correlation';
        }
      }
    }
    
    // PRIORITY 3: Fallback to direct legacyLocationId match (legacy support)
    if (!baselineReading && currentReading.legacyLocationId) {
      baselineReading = baselineReadings.find(
        (b) => b.legacyLocationId === currentReading.legacyLocationId
      ) || null;
      
      if (baselineReading) {
        matchMethod = 'legacyLocationId';
      }
    }
    
    correlatedPairs.push({
      current: currentReading,
      baseline: baselineReading,
      matchMethod,
    });
  }
  
  // Log match quality statistics for audit trail
  const matchStats = {
    stationKey: correlatedPairs.filter(p => p.matchMethod === 'stationKey').length,
    correlation: correlatedPairs.filter(p => p.matchMethod === 'correlation').length,
    legacyLocationId: correlatedPairs.filter(p => p.matchMethod === 'legacyLocationId').length,
    none: correlatedPairs.filter(p => p.matchMethod === 'none').length,
    total: correlatedPairs.length,
  };
  
  console.log(`[CML Pairing] Component: ${component}`);
  console.log(`[CML Pairing] Match statistics:`, matchStats);
  console.log(`[CML Pairing] Match quality: ${((matchStats.stationKey / matchStats.total) * 100).toFixed(1)}% stationKey matches`);
  
  // Warn if low stationKey match rate
  if (matchStats.stationKey < matchStats.total * 0.5) {
    console.warn(`[CML Pairing] WARNING: Low stationKey match rate (${matchStats.stationKey}/${matchStats.total}). Consider running backfill script.`);
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
