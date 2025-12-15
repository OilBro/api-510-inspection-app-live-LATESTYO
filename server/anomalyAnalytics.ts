import { getDb } from "./db";
import { inspections, reportAnomalies } from "../drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface TrendDataPoint {
  date: string;
  totalAnomalies: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface VesselTypeBreakdown {
  vesselType: string;
  anomalyCount: number;
  inspectionCount: number;
  avgAnomaliesPerInspection: number;
}

/**
 * Get anomaly trends over time
 */
export async function getAnomalyTrends(userId: number, daysBack: number = 90): Promise<TrendDataPoint[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get all inspections for user within date range
  const userInspections = await db
    .select()
    .from(inspections)
    .where(
      and(
        eq(inspections.userId, userId),
        gte(inspections.createdAt, cutoffDate)
      )
    );

  if (userInspections.length === 0) {
    return [];
  }

  const inspectionIds = userInspections.map(i => i.id);

  // Get anomalies for these inspections
  const anomalies = await db
    .select()
    .from(reportAnomalies)
    .where(sql`${reportAnomalies.inspectionId} IN (${sql.join(inspectionIds.map(id => sql`${id}`), sql`, `)})`);

  // Group by date
  const trendMap: { [date: string]: TrendDataPoint } = {};

  for (const anomaly of anomalies) {
    const date = anomaly.detectedAt?.toISOString().split('T')[0] || '';
    if (!date) continue;

    if (!trendMap[date]) {
      trendMap[date] = {
        date,
        totalAnomalies: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
      };
    }

    trendMap[date].totalAnomalies++;
    if (anomaly.severity === 'critical') trendMap[date].criticalCount++;
    if (anomaly.severity === 'warning') trendMap[date].warningCount++;
    if (anomaly.severity === 'info') trendMap[date].infoCount++;
  }

  return Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get breakdown of anomalies by category
 */
export async function getCategoryBreakdown(userId: number): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all inspections for user
  const userInspections = await db
    .select()
    .from(inspections)
    .where(eq(inspections.userId, userId));

  if (userInspections.length === 0) {
    return [];
  }

  const inspectionIds = userInspections.map(i => i.id);

  // Get anomalies for these inspections
  const anomalies = await db
    .select()
    .from(reportAnomalies)
    .where(sql`${reportAnomalies.inspectionId} IN (${sql.join(inspectionIds.map(id => sql`${id}`), sql`, `)})`);

  // Count by category
  const categoryMap: { [category: string]: number } = {};
  for (const anomaly of anomalies) {
    categoryMap[anomaly.category] = (categoryMap[anomaly.category] || 0) + 1;
  }

  const total = anomalies.length;
  return Object.entries(categoryMap)
    .map(([category, count]) => ({
      category: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get breakdown by vessel type
 */
export async function getVesselTypeBreakdown(userId: number): Promise<VesselTypeBreakdown[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all inspections for user
  const userInspections = await db
    .select()
    .from(inspections)
    .where(eq(inspections.userId, userId));

  if (userInspections.length === 0) {
    return [];
  }

  // Group by vessel type
  const vesselTypeMap: { [type: string]: { inspections: string[], anomalyCount: number } } = {};

  for (const inspection of userInspections) {
    const type = inspection.vesselType || 'Unknown';
    if (!vesselTypeMap[type]) {
      vesselTypeMap[type] = { inspections: [], anomalyCount: 0 };
    }
    vesselTypeMap[type].inspections.push(inspection.id);
    vesselTypeMap[type].anomalyCount += inspection.anomalyCount || 0;
  }

  return Object.entries(vesselTypeMap)
    .map(([vesselType, data]) => ({
      vesselType,
      anomalyCount: data.anomalyCount,
      inspectionCount: data.inspections.length,
      avgAnomaliesPerInspection: data.inspections.length > 0 
        ? data.anomalyCount / data.inspections.length 
        : 0,
    }))
    .sort((a, b) => b.avgAnomaliesPerInspection - a.avgAnomaliesPerInspection);
}

/**
 * Get recurring problems (vessels with multiple inspections showing same anomaly category)
 */
export async function getRecurringProblems(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all inspections for user
  const userInspections = await db
    .select()
    .from(inspections)
    .where(eq(inspections.userId, userId));

  if (userInspections.length === 0) {
    return [];
  }

  const inspectionIds = userInspections.map(i => i.id);

  // Get anomalies
  const anomalies = await db
    .select()
    .from(reportAnomalies)
    .where(sql`${reportAnomalies.inspectionId} IN (${sql.join(inspectionIds.map(id => sql`${id}`), sql`, `)})`);

  // Group by vessel tag number and category
  const vesselCategoryMap: { 
    [vesselTag: string]: { 
      [category: string]: { count: number, inspections: Set<string> } 
    } 
  } = {};

  for (const anomaly of anomalies) {
    const inspection = userInspections.find(i => i.id === anomaly.inspectionId);
    if (!inspection) continue;

    const vesselTag = inspection.vesselTagNumber;
    if (!vesselCategoryMap[vesselTag]) {
      vesselCategoryMap[vesselTag] = {};
    }
    if (!vesselCategoryMap[vesselTag][anomaly.category]) {
      vesselCategoryMap[vesselTag][anomaly.category] = { count: 0, inspections: new Set() };
    }

    vesselCategoryMap[vesselTag][anomaly.category].count++;
    vesselCategoryMap[vesselTag][anomaly.category].inspections.add(anomaly.inspectionId);
  }

  // Find recurring problems (same category in multiple inspections)
  const recurringProblems: any[] = [];

  for (const [vesselTag, categories] of Object.entries(vesselCategoryMap)) {
    for (const [category, data] of Object.entries(categories)) {
      if (data.inspections.size > 1) { // Recurring if appears in multiple inspections
        recurringProblems.push({
          vesselTag,
          category: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          occurrences: data.count,
          inspectionCount: data.inspections.size,
        });
      }
    }
  }

  return recurringProblems.sort((a, b) => b.inspectionCount - a.inspectionCount);
}
