/**
 * Extraction Audit Trail Service
 * 
 * Tracks all extraction decisions for regulatory defensibility.
 * Every field extracted from a PDF is logged with its source,
 * validation status, and any corrections applied.
 * 
 * Code References:
 * - API 510 §5.2: Documentation Requirements
 * - 21 CFR Part 11: Electronic Records (for audit trail requirements)
 */

import { nanoid } from 'nanoid';
import { getDb } from './db';
import { sql } from 'drizzle-orm';
import { FieldValidation } from './extractionValidationEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExtractionAuditEntry {
  id: string;
  extractionJobId: string;
  importedFileId: string;
  timestamp: Date;
  fieldName: string;
  rawValue: string | null;
  parsedValue: string | null;
  parsedUnit: string | null;
  validationStatus: 'passed' | 'failed' | 'warning' | 'pending';
  validationMessage: string | null;
  parserSource: string;
  pageNumber: number | null;
  boundingBox: object | null;
  codeReference: string | null;
  confidenceScore: number | null;
}

export interface DataConflict {
  id: string;
  inspectionId: string;
  importedFileId: string;
  fieldName: string;
  existingValue: string | null;
  newValue: string | null;
  conflictType: 'value_mismatch' | 'unit_mismatch' | 'source_conflict';
  resolutionStatus: 'pending' | 'auto_resolved' | 'user_resolved' | 'regulation_override';
  resolutionRationale: string | null;
  resolvedBy: number | null;
  resolvedAt: Date | null;
  regulatoryReference: string | null;
}

// ============================================================================
// AUDIT ENTRY CREATION
// ============================================================================

/**
 * Create an extraction audit entry for a single field
 */
export async function createExtractionAuditEntry(
  extractionJobId: string,
  importedFileId: string,
  fieldValidation: FieldValidation
): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  const id = `audit_${nanoid(16)}`;
  
  await db.execute(sql`INSERT INTO extractionAuditLog (
    id, extractionJobId, importedFileId, fieldName, rawValue, parsedValue,
    parsedUnit, validationStatus, validationMessage, parserSource,
    pageNumber, codeReference, confidenceScore
  ) VALUES (
    ${id},
    ${extractionJobId},
    ${importedFileId},
    ${fieldValidation.fieldName},
    ${fieldValidation.rawValue?.toString() ?? null},
    ${fieldValidation.parsedValue?.toString() ?? null},
    ${fieldValidation.parsedUnit ?? null},
    ${fieldValidation.validation.status},
    ${fieldValidation.validation.message},
    ${fieldValidation.parserSource},
    ${fieldValidation.pageNumber ?? null},
    ${fieldValidation.validation.codeReference ?? null},
    ${fieldValidation.validation.confidenceScore ?? null}
  )`);
  
  return id;
}

/**
 * Create multiple extraction audit entries in batch
 */
export async function createExtractionAuditEntries(
  extractionJobId: string,
  importedFileId: string,
  fieldValidations: FieldValidation[]
): Promise<string[]> {
  const ids: string[] = [];
  
  for (const validation of fieldValidations) {
    const id = await createExtractionAuditEntry(extractionJobId, importedFileId, validation);
    ids.push(id);
  }
  
  return ids;
}

/**
 * Get all audit entries for an extraction job
 */
export async function getExtractionAuditEntries(
  extractionJobId: string
): Promise<ExtractionAuditEntry[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  const result = await db.execute(sql`SELECT * FROM extractionAuditLog WHERE extractionJobId = ${extractionJobId} ORDER BY timestamp ASC`);
  
  const rows = (result as unknown as any[][])[0] as any[];
  if (!rows || !Array.isArray(rows)) {
    return [];
  }
  
  return rows.map(row => ({
    id: row.id as string,
    extractionJobId: row.extractionJobId as string,
    importedFileId: row.importedFileId as string,
    timestamp: new Date(row.timestamp as string),
    fieldName: row.fieldName as string,
    rawValue: row.rawValue as string | null,
    parsedValue: row.parsedValue as string | null,
    parsedUnit: row.parsedUnit as string | null,
    validationStatus: row.validationStatus as 'passed' | 'failed' | 'warning' | 'pending',
    validationMessage: row.validationMessage as string | null,
    parserSource: row.parserSource as string,
    pageNumber: row.pageNumber as number | null,
    boundingBox: row.boundingBox ? JSON.parse(row.boundingBox as string) : null,
    codeReference: row.codeReference as string | null,
    confidenceScore: row.confidenceScore as number | null
  }));
}

/**
 * Get audit entries for a specific imported file
 */
export async function getAuditEntriesByFile(
  importedFileId: string
): Promise<ExtractionAuditEntry[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  const result = await db.execute(sql`SELECT * FROM extractionAuditLog WHERE importedFileId = ${importedFileId} ORDER BY timestamp ASC`);
  
  const rows = (result as unknown as any[][])[0] as any[];
  if (!rows || !Array.isArray(rows)) {
    return [];
  }
  
  return rows.map(row => ({
    id: row.id as string,
    extractionJobId: row.extractionJobId as string,
    importedFileId: row.importedFileId as string,
    timestamp: new Date(row.timestamp as string),
    fieldName: row.fieldName as string,
    rawValue: row.rawValue as string | null,
    parsedValue: row.parsedValue as string | null,
    parsedUnit: row.parsedUnit as string | null,
    validationStatus: row.validationStatus as 'passed' | 'failed' | 'warning' | 'pending',
    validationMessage: row.validationMessage as string | null,
    parserSource: row.parserSource as string,
    pageNumber: row.pageNumber as number | null,
    boundingBox: row.boundingBox ? JSON.parse(row.boundingBox as string) : null,
    codeReference: row.codeReference as string | null,
    confidenceScore: row.confidenceScore as number | null
  }));
}

// ============================================================================
// DATA CONFLICT MANAGEMENT
// ============================================================================

/**
 * Create a data conflict record when new data differs from existing
 */
export async function createDataConflict(
  inspectionId: string,
  importedFileId: string,
  fieldName: string,
  existingValue: string | null,
  newValue: string | null,
  conflictType: 'value_mismatch' | 'unit_mismatch' | 'source_conflict'
): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  const id = `conflict_${nanoid(16)}`;
  
  await db.execute(sql`INSERT INTO dataConflicts (
    id, inspectionId, importedFileId, fieldName, existingValue, newValue,
    conflictType, resolutionStatus
  ) VALUES (
    ${id}, ${inspectionId}, ${importedFileId}, ${fieldName}, 
    ${existingValue}, ${newValue}, ${conflictType}, 'pending'
  )`);
  
  return id;
}

/**
 * Get pending conflicts for an inspection
 */
export async function getPendingConflicts(
  inspectionId: string
): Promise<DataConflict[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  const result = await db.execute(sql`SELECT * FROM dataConflicts WHERE inspectionId = ${inspectionId} AND resolutionStatus = 'pending' ORDER BY createdAt ASC`);
  
  const rows = (result as unknown as any[][])[0] as any[];
  if (!rows || !Array.isArray(rows)) {
    return [];
  }
  
  return rows.map(row => ({
    id: row.id as string,
    inspectionId: row.inspectionId as string,
    importedFileId: row.importedFileId as string,
    fieldName: row.fieldName as string,
    existingValue: row.existingValue as string | null,
    newValue: row.newValue as string | null,
    conflictType: row.conflictType as 'value_mismatch' | 'unit_mismatch' | 'source_conflict',
    resolutionStatus: row.resolutionStatus as 'pending' | 'auto_resolved' | 'user_resolved' | 'regulation_override',
    resolutionRationale: row.resolutionRationale as string | null,
    resolvedBy: row.resolvedBy as number | null,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt as string) : null,
    regulatoryReference: row.regulatoryReference as string | null
  }));
}

/**
 * Resolve a data conflict
 */
export async function resolveDataConflict(
  conflictId: string,
  resolution: {
    status: 'auto_resolved' | 'user_resolved' | 'regulation_override';
    rationale: string;
    resolvedBy?: number;
    regulatoryReference?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  await db.execute(sql`UPDATE dataConflicts SET
    resolutionStatus = ${resolution.status},
    resolutionRationale = ${resolution.rationale},
    resolvedBy = ${resolution.resolvedBy ?? null},
    resolvedAt = NOW(),
    regulatoryReference = ${resolution.regulatoryReference ?? null}
  WHERE id = ${conflictId}`);
}

/**
 * Auto-resolve conflicts based on regulatory rules
 */
export async function autoResolveConflicts(
  inspectionId: string
): Promise<{ resolved: number; remaining: number }> {
  const conflicts = await getPendingConflicts(inspectionId);
  let resolved = 0;
  
  for (const conflict of conflicts) {
    // Rule 1: If new value is more conservative (lower thickness, higher pressure), use new value
    if (conflict.fieldName.includes('thickness') || conflict.fieldName.includes('Thickness')) {
      const existing = parseFloat(conflict.existingValue || '0');
      const newVal = parseFloat(conflict.newValue || '0');
      
      if (!isNaN(existing) && !isNaN(newVal) && newVal < existing) {
        await resolveDataConflict(conflict.id, {
          status: 'regulation_override',
          rationale: 'API 510 §7.1: Use most conservative (lowest) thickness measurement',
          regulatoryReference: 'API 510 §7.1'
        });
        resolved++;
        continue;
      }
    }
    
    // Rule 2: If values are within measurement tolerance (±0.005"), consider them equal
    if (conflict.conflictType === 'value_mismatch') {
      const existing = parseFloat(conflict.existingValue || '0');
      const newVal = parseFloat(conflict.newValue || '0');
      
      if (!isNaN(existing) && !isNaN(newVal) && Math.abs(existing - newVal) < 0.005) {
        await resolveDataConflict(conflict.id, {
          status: 'auto_resolved',
          rationale: 'Values within measurement tolerance (±0.005")'
        });
        resolved++;
        continue;
      }
    }
  }
  
  return {
    resolved,
    remaining: conflicts.length - resolved
  };
}

// ============================================================================
// EXTRACTION JOB TRACKING
// ============================================================================

/**
 * Start a new extraction job
 */
export function generateExtractionJobId(): string {
  return `job_${nanoid(16)}`;
}

/**
 * Update imported file with extraction quality metrics
 */
export async function updateImportedFileMetrics(
  importedFileId: string,
  metrics: {
    vesselDataCompleteness: number;
    tmlDataCompleteness: number;
    physicalValidationPassRate: number;
    confidenceScoreAverage: number;
    overallQuality: 'complete' | 'partial' | 'needs_review' | 'failed';
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  await db.execute(sql`UPDATE importedFiles SET
    vesselDataCompleteness = ${metrics.vesselDataCompleteness},
    tmlDataCompleteness = ${metrics.tmlDataCompleteness},
    physicalValidationPassRate = ${metrics.physicalValidationPassRate},
    confidenceScoreAverage = ${metrics.confidenceScoreAverage},
    overallQuality = ${metrics.overallQuality}
  WHERE id = ${importedFileId}`);
}

// ============================================================================
// AUDIT SUMMARY GENERATION
// ============================================================================

/**
 * Generate an audit summary for an extraction job
 */
export async function generateExtractionAuditSummary(
  extractionJobId: string
): Promise<{
  totalFields: number;
  passedFields: number;
  failedFields: number;
  warningFields: number;
  pendingFields: number;
  validationPassRate: number;
  fieldsByStatus: Record<string, string[]>;
  codeReferences: string[];
}> {
  const entries = await getExtractionAuditEntries(extractionJobId);
  
  const summary = {
    totalFields: entries.length,
    passedFields: 0,
    failedFields: 0,
    warningFields: 0,
    pendingFields: 0,
    validationPassRate: 0,
    fieldsByStatus: {
      passed: [] as string[],
      failed: [] as string[],
      warning: [] as string[],
      pending: [] as string[]
    },
    codeReferences: [] as string[]
  };
  
  for (const entry of entries) {
    switch (entry.validationStatus) {
      case 'passed':
        summary.passedFields++;
        summary.fieldsByStatus.passed.push(entry.fieldName);
        break;
      case 'failed':
        summary.failedFields++;
        summary.fieldsByStatus.failed.push(entry.fieldName);
        break;
      case 'warning':
        summary.warningFields++;
        summary.fieldsByStatus.warning.push(entry.fieldName);
        break;
      case 'pending':
        summary.pendingFields++;
        summary.fieldsByStatus.pending.push(entry.fieldName);
        break;
    }
    
    if (entry.codeReference && !summary.codeReferences.includes(entry.codeReference)) {
      summary.codeReferences.push(entry.codeReference);
    }
  }
  
  summary.validationPassRate = summary.totalFields > 0
    ? (summary.passedFields / summary.totalFields) * 100
    : 0;
  
  return summary;
}

/**
 * Get extraction history for an inspection (all imported files)
 */
export async function getExtractionHistory(
  inspectionId: string
): Promise<{
  importedFiles: Array<{
    id: string;
    fileName: string;
    importedAt: Date;
    parserUsed: string;
    overallQuality: string | null;
    auditEntryCount: number;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    return { importedFiles: [] };
  }
  
  const result = await db.execute(sql`SELECT 
    f.id, f.fileName, f.createdAt as importedAt, f.parserUsed, f.overallQuality,
    COUNT(a.id) as auditEntryCount
  FROM importedFiles f
  LEFT JOIN extractionAuditLog a ON f.id = a.importedFileId
  WHERE f.inspectionId = ${inspectionId}
  GROUP BY f.id
  ORDER BY f.createdAt DESC`);
  
  const rows = (result as unknown as any[][])[0] as any[];
  if (!rows || !Array.isArray(rows)) {
    return { importedFiles: [] };
  }
  
  return {
    importedFiles: rows.map(row => ({
      id: row.id as string,
      fileName: row.fileName as string,
      importedAt: new Date(row.importedAt as string),
      parserUsed: row.parserUsed as string,
      overallQuality: row.overallQuality as string | null,
      auditEntryCount: row.auditEntryCount as number
    }))
  };
}
