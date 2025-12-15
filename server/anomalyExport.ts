import { getDb } from "./db";
import { inspections, reportAnomalies } from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface AnomalyExportRow {
  vesselTag: string;
  vesselName: string;
  inspectionDate: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  affectedComponent: string;
  detectedValue: string;
  expectedRange: string;
  reviewStatus: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewNotes: string;
  detectedAt: string;
}

/**
 * Generate CSV export data for anomalies
 */
export async function exportAnomaliesToCSV(userId: number, inspectionId?: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get inspections for user
  let userInspections;
  if (inspectionId) {
    userInspections = await db
      .select()
      .from(inspections)
      .where(and(eq(inspections.userId, userId), eq(inspections.id, inspectionId)));
  } else {
    userInspections = await db
      .select()
      .from(inspections)
      .where(eq(inspections.userId, userId));
  }

  if (userInspections.length === 0) {
    return generateCSVHeader();
  }

  const inspectionIds = userInspections.map(i => i.id);

  // Get anomalies for these inspections
  const anomalies = await db
    .select()
    .from(reportAnomalies)
    .where(sql`${reportAnomalies.inspectionId} IN (${sql.join(inspectionIds.map(id => sql`${id}`), sql`, `)})`);

  // Build export rows
  const rows: AnomalyExportRow[] = [];

  for (const anomaly of anomalies) {
    const inspection = userInspections.find(i => i.id === anomaly.inspectionId);
    if (!inspection) continue;

    rows.push({
      vesselTag: inspection.vesselTagNumber || '',
      vesselName: inspection.vesselName || '',
      inspectionDate: inspection.inspectionDate?.toISOString().split('T')[0] || '',
      category: formatCategory(anomaly.category),
      severity: anomaly.severity.toUpperCase(),
      title: anomaly.title,
      description: anomaly.description,
      affectedComponent: anomaly.affectedComponent || '',
      detectedValue: anomaly.detectedValue || '',
      expectedRange: anomaly.expectedRange || '',
      reviewStatus: anomaly.reviewStatus.toUpperCase(),
      reviewedBy: anomaly.reviewedBy?.toString() || '',
      reviewedAt: anomaly.reviewedAt?.toISOString() || '',
      reviewNotes: anomaly.reviewNotes || '',
      detectedAt: anomaly.detectedAt?.toISOString() || '',
    });
  }

  return generateCSV(rows);
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function generateCSVHeader(): string {
  return [
    'Vessel Tag',
    'Vessel Name',
    'Inspection Date',
    'Category',
    'Severity',
    'Title',
    'Description',
    'Affected Component',
    'Detected Value',
    'Expected Range',
    'Review Status',
    'Reviewed By',
    'Reviewed At',
    'Review Notes',
    'Detected At'
  ].join(',') + '\n';
}

function generateCSV(rows: AnomalyExportRow[]): string {
  let csv = generateCSVHeader();

  for (const row of rows) {
    csv += [
      escapeCSV(row.vesselTag),
      escapeCSV(row.vesselName),
      escapeCSV(row.inspectionDate),
      escapeCSV(row.category),
      escapeCSV(row.severity),
      escapeCSV(row.title),
      escapeCSV(row.description),
      escapeCSV(row.affectedComponent),
      escapeCSV(row.detectedValue),
      escapeCSV(row.expectedRange),
      escapeCSV(row.reviewStatus),
      escapeCSV(row.reviewedBy),
      escapeCSV(row.reviewedAt),
      escapeCSV(row.reviewNotes),
      escapeCSV(row.detectedAt),
    ].join(',') + '\n';
  }

  return csv;
}

function escapeCSV(value: string): string {
  if (!value) return '';
  
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  
  return value;
}
