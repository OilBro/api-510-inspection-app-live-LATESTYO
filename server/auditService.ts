/**
 * AUDIT TRAIL SERVICE
 * OilPro 510 - Regulatory-Grade Inspection Application
 * 
 * This service provides comprehensive audit logging for all critical data changes.
 * The audit log is IMMUTABLE - records can only be appended, never modified or deleted.
 * 
 * Per SPEC-20260128-R2 Section 2.3:
 * - Every output must be defensible to EPA, OSHA, state environmental agencies, and Authorized Inspectors
 * - Complete traceability of all data modifications
 * - User identification and justification for changes
 */

import { getDb } from './db';
import { auditLog } from '../drizzle/schema';
import { CALCULATION_ENGINE_VERSION } from './lockedCalculationEngine';

/**
 * Audit action types
 */
export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Audit log entry interface
 */
export interface AuditEntry {
  userId: string;
  userName?: string;
  tableName: string;
  recordId: string;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
  actionType: AuditActionType;
  justification?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  calculationVersion?: string;
  codeReference?: string;
}

/**
 * Audit context for batch operations
 */
export interface AuditContext {
  userId: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  justification?: string;
}

/**
 * Log a single audit entry to the database.
 * This function is append-only - entries cannot be modified after creation.
 */
export async function logAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({
      userId: entry.userId,
      userName: entry.userName || null,
      tableName: entry.tableName,
      recordId: entry.recordId,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      actionType: entry.actionType,
      justification: entry.justification || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      sessionId: entry.sessionId || null,
      calculationVersion: entry.calculationVersion || null,
      codeReference: entry.codeReference || null,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    console.error('[AUDIT] Failed to log audit entry:', error);
    console.error('[AUDIT] Entry details:', JSON.stringify(entry));
  }
}

/**
 * Log multiple audit entries in a batch.
 * Used for operations that modify multiple fields at once.
 */
export async function logAuditBatch(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  
  try {
    const db = await getDb();
    if (!db) return;
    const values = entries.map(entry => ({
      userId: entry.userId,
      userName: entry.userName || null,
      tableName: entry.tableName,
      recordId: entry.recordId,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      actionType: entry.actionType,
      justification: entry.justification || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      sessionId: entry.sessionId || null,
      calculationVersion: entry.calculationVersion || null,
      codeReference: entry.codeReference || null,
    }));
    
    await db.insert(auditLog).values(values);
  } catch (error) {
    console.error('[AUDIT] Failed to log audit batch:', error);
    console.error('[AUDIT] Batch size:', entries.length);
  }
}

/**
 * Log a CREATE operation.
 * Records all fields of the newly created record.
 */
export async function logCreate(
  context: AuditContext,
  tableName: string,
  recordId: string,
  newRecord: Record<string, any>,
  codeReference?: string
): Promise<void> {
  const entries: AuditEntry[] = [];
  
  for (const [fieldName, value] of Object.entries(newRecord)) {
    // Skip internal fields
    if (['createdAt', 'updatedAt'].includes(fieldName)) continue;
    
    entries.push({
      userId: context.userId,
      userName: context.userName,
      tableName,
      recordId,
      fieldName,
      oldValue: null,
      newValue: stringifyValue(value),
      actionType: 'CREATE',
      justification: context.justification,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      codeReference,
    });
  }
  
  await logAuditBatch(entries);
}

/**
 * Log an UPDATE operation.
 * Only records fields that have actually changed.
 */
export async function logUpdate(
  context: AuditContext,
  tableName: string,
  recordId: string,
  oldRecord: Record<string, any>,
  newRecord: Record<string, any>,
  codeReference?: string
): Promise<void> {
  const entries: AuditEntry[] = [];
  
  for (const [fieldName, newValue] of Object.entries(newRecord)) {
    // Skip internal fields
    if (['createdAt', 'updatedAt'].includes(fieldName)) continue;
    
    const oldValue = oldRecord[fieldName];
    
    // Only log if value actually changed
    if (stringifyValue(oldValue) !== stringifyValue(newValue)) {
      entries.push({
        userId: context.userId,
        userName: context.userName,
        tableName,
        recordId,
        fieldName,
        oldValue: stringifyValue(oldValue),
        newValue: stringifyValue(newValue),
        actionType: 'UPDATE',
        justification: context.justification,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        codeReference,
      });
    }
  }
  
  if (entries.length > 0) {
    await logAuditBatch(entries);
  }
}

/**
 * Log a DELETE operation.
 * Records all fields of the deleted record for recovery purposes.
 */
export async function logDelete(
  context: AuditContext,
  tableName: string,
  recordId: string,
  deletedRecord: Record<string, any>,
  codeReference?: string
): Promise<void> {
  const entries: AuditEntry[] = [];
  
  for (const [fieldName, value] of Object.entries(deletedRecord)) {
    entries.push({
      userId: context.userId,
      userName: context.userName,
      tableName,
      recordId,
      fieldName,
      oldValue: stringifyValue(value),
      newValue: null,
      actionType: 'DELETE',
      justification: context.justification,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      codeReference,
    });
  }
  
  await logAuditBatch(entries);
}

/**
 * Log a calculation event.
 * Special logging for calculation operations with code references.
 */
export async function logCalculation(
  context: AuditContext,
  tableName: string,
  recordId: string,
  calculationType: string,
  inputValues: Record<string, any>,
  outputValues: Record<string, any>,
  codeReference: string
): Promise<void> {
  const entries: AuditEntry[] = [];
  
  // Log calculation type
  entries.push({
    userId: context.userId,
    userName: context.userName,
    tableName,
    recordId,
    fieldName: 'calculationType',
    oldValue: null,
    newValue: calculationType,
    actionType: 'CREATE',
    justification: context.justification,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    calculationVersion: CALCULATION_ENGINE_VERSION,
    codeReference,
  });
  
  // Log input values
  for (const [fieldName, value] of Object.entries(inputValues)) {
    entries.push({
      userId: context.userId,
      userName: context.userName,
      tableName,
      recordId,
      fieldName: `input.${fieldName}`,
      oldValue: null,
      newValue: stringifyValue(value),
      actionType: 'CREATE',
      justification: context.justification,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      calculationVersion: CALCULATION_ENGINE_VERSION,
      codeReference,
    });
  }
  
  // Log output values
  for (const [fieldName, value] of Object.entries(outputValues)) {
    entries.push({
      userId: context.userId,
      userName: context.userName,
      tableName,
      recordId,
      fieldName: `output.${fieldName}`,
      oldValue: null,
      newValue: stringifyValue(value),
      actionType: 'CREATE',
      justification: context.justification,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      calculationVersion: CALCULATION_ENGINE_VERSION,
      codeReference,
    });
  }
  
  await logAuditBatch(entries);
}

/**
 * Log a data import event.
 * Special logging for PDF/Excel import operations.
 */
export async function logDataImport(
  context: AuditContext,
  tableName: string,
  recordId: string,
  sourceFile: string,
  importedFields: Record<string, any>,
  parserType: string
): Promise<void> {
  const entries: AuditEntry[] = [];
  
  // Log import metadata
  entries.push({
    userId: context.userId,
    userName: context.userName,
    tableName,
    recordId,
    fieldName: '_import_source',
    oldValue: null,
    newValue: sourceFile,
    actionType: 'CREATE',
    justification: `Data imported from ${sourceFile} using ${parserType} parser`,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
  });
  
  // Log each imported field
  for (const [fieldName, value] of Object.entries(importedFields)) {
    entries.push({
      userId: context.userId,
      userName: context.userName,
      tableName,
      recordId,
      fieldName,
      oldValue: null,
      newValue: stringifyValue(value),
      actionType: 'CREATE',
      justification: `Imported from ${sourceFile}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
    });
  }
  
  await logAuditBatch(entries);
}

/**
 * Log a corrosion rate selection.
 * Required per API 510 - user must select controlling rate.
 */
export async function logCorrosionRateSelection(
  context: AuditContext,
  componentId: string,
  selectedRateType: 'LT' | 'ST' | 'USER',
  selectedRate: number,
  selectionReason: string,
  ltRate?: number,
  stRate?: number
): Promise<void> {
  await logAuditEntry({
    userId: context.userId,
    userName: context.userName,
    tableName: 'components',
    recordId: componentId,
    fieldName: 'governingCorrosionRate',
    oldValue: null,
    newValue: JSON.stringify({
      selectedRateType,
      selectedRate,
      ltRate,
      stRate,
      selectionReason,
    }),
    actionType: 'UPDATE',
    justification: selectionReason,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    codeReference: 'API 510 §7.1.1 - Corrosion Rate Selection',
  });
}

/**
 * Get audit history for a specific record.
 */
export async function getAuditHistory(
  tableName: string,
  recordId: string
): Promise<Array<{
  timestamp: Date;
  userId: string;
  userName: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  actionType: string;
  justification: string | null;
  codeReference: string | null;
}>> {
  const { eq, and, desc } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select({
      timestamp: auditLog.timestamp,
      userId: auditLog.userId,
      userName: auditLog.userName,
      fieldName: auditLog.fieldName,
      oldValue: auditLog.oldValue,
      newValue: auditLog.newValue,
      actionType: auditLog.actionType,
      justification: auditLog.justification,
      codeReference: auditLog.codeReference,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, tableName),
        eq(auditLog.recordId, recordId)
      )
    )
    .orderBy(desc(auditLog.timestamp));
  
  return results;
}

/**
 * Get audit history for a user.
 */
export async function getUserAuditHistory(
  userId: string,
  limit: number = 100
): Promise<Array<{
  timestamp: Date;
  tableName: string;
  recordId: string;
  fieldName: string;
  actionType: string;
  justification: string | null;
}>> {
  const { eq, desc } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select({
      timestamp: auditLog.timestamp,
      tableName: auditLog.tableName,
      recordId: auditLog.recordId,
      fieldName: auditLog.fieldName,
      actionType: auditLog.actionType,
      justification: auditLog.justification,
    })
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);
  
  return results;
}

/**
 * Generate audit report for a component.
 * Used for regulatory documentation.
 */
export async function generateComponentAuditReport(
  componentId: string
): Promise<{
  componentId: string;
  totalChanges: number;
  createdAt: Date | null;
  createdBy: string | null;
  lastModifiedAt: Date | null;
  lastModifiedBy: string | null;
  calculationHistory: Array<{
    timestamp: Date;
    calculationType: string;
    codeReference: string | null;
    calculationVersion: string | null;
  }>;
  changeHistory: Array<{
    timestamp: Date;
    userId: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    justification: string | null;
  }>;
}> {
  const { eq, and, desc, like } = await import('drizzle-orm');
  const db = await getDb();
  if (!db) {
    return {
      componentId,
      totalChanges: 0,
      createdAt: null,
      createdBy: null,
      lastModifiedAt: null,
      lastModifiedBy: null,
      calculationHistory: [],
      changeHistory: [],
    };
  }
  
  // Get all audit entries for this component
  const allEntries = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tableName, 'components'),
        eq(auditLog.recordId, componentId)
      )
    )
    .orderBy(desc(auditLog.timestamp));
  
  // Find creation entry
  const createEntry = allEntries.find((e: typeof allEntries[0]) => e.actionType === 'CREATE' && e.fieldName === 'id');
  
  // Find last modification
  const lastModEntry = allEntries[0];
  
  // Get calculation history
  const calcEntries = allEntries.filter((e: typeof allEntries[0]) => e.fieldName === 'calculationType');
  
  // Get change history (excluding calculations)
  const changeEntries = allEntries.filter((e: typeof allEntries[0]) => 
    !e.fieldName.startsWith('input.') && 
    !e.fieldName.startsWith('output.') &&
    e.fieldName !== 'calculationType'
  );
  
  return {
    componentId,
    totalChanges: allEntries.length,
    createdAt: createEntry?.timestamp || null,
    createdBy: createEntry?.userId || null,
    lastModifiedAt: lastModEntry?.timestamp || null,
    lastModifiedBy: lastModEntry?.userId || null,
    calculationHistory: calcEntries.map((e: typeof allEntries[0]) => ({
      timestamp: e.timestamp,
      calculationType: e.newValue || '',
      codeReference: e.codeReference,
      calculationVersion: e.calculationVersion,
    })),
    changeHistory: changeEntries.slice(0, 50).map((e: typeof allEntries[0]) => ({
      timestamp: e.timestamp,
      userId: e.userId,
      fieldName: e.fieldName,
      oldValue: e.oldValue,
      newValue: e.newValue,
      justification: e.justification,
    })),
  };
}

// Helper function to stringify values for storage
function stringifyValue(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
