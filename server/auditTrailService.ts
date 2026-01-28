/**
 * Audit Trail Service
 * 
 * Comprehensive logging of all data changes for regulatory compliance.
 * Provides immutable audit records for API 510 and ASME compliance audits.
 * 
 * Reference Standards:
 * - API 510 §6.4 - Records and Reports
 * - ASME BPVC Section VIII Division 1 - Documentation Requirements
 * - 40 CFR Part 264/265 - Record Keeping Requirements
 */

import { logger } from "./_core/logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CALCULATE'
  | 'IMPORT'
  | 'EXPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'REVIEW';

export type AuditEntityType =
  | 'inspection'
  | 'vessel'
  | 'component'
  | 'tml_reading'
  | 'calculation'
  | 'report'
  | 'nozzle'
  | 'finding'
  | 'recommendation'
  | 'user'
  | 'system';

export interface AuditEntry {
  /** Unique audit entry ID */
  id: string;
  
  /** Timestamp of the action (ISO 8601) */
  timestamp: string;
  
  /** Type of action performed */
  action: AuditAction;
  
  /** Type of entity affected */
  entityType: AuditEntityType;
  
  /** ID of the entity affected */
  entityId: string;
  
  /** User who performed the action */
  userId: string;
  
  /** User's display name */
  userName: string;
  
  /** Previous values (for UPDATE actions) */
  previousValues?: Record<string, unknown>;
  
  /** New values (for CREATE/UPDATE actions) */
  newValues?: Record<string, unknown>;
  
  /** Calculation inputs (for CALCULATE actions) */
  calculationInputs?: Record<string, unknown>;
  
  /** Calculation outputs (for CALCULATE actions) */
  calculationOutputs?: Record<string, unknown>;
  
  /** Code references used */
  codeReferences?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** IP address of the client */
  ipAddress?: string;
  
  /** User agent string */
  userAgent?: string;
  
  /** Session ID */
  sessionId?: string;
  
  /** Checksum for integrity verification */
  checksum: string;
}

export interface AuditQuery {
  /** Filter by entity type */
  entityType?: AuditEntityType;
  
  /** Filter by entity ID */
  entityId?: string;
  
  /** Filter by action type */
  action?: AuditAction;
  
  /** Filter by user ID */
  userId?: string;
  
  /** Start date (inclusive) */
  startDate?: string;
  
  /** End date (inclusive) */
  endDate?: string;
  
  /** Maximum number of results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

export interface CalculationAuditData {
  /** Calculation type (e.g., 'shell_thickness', 'mawp', 'remaining_life') */
  calculationType: string;
  
  /** All input parameters */
  inputs: Record<string, unknown>;
  
  /** All output results */
  outputs: Record<string, unknown>;
  
  /** Intermediate calculation values */
  intermediateValues?: Record<string, unknown>;
  
  /** Code references (e.g., 'UG-27(c)(1)', 'API 510 §7.1.1') */
  codeReferences: string[];
  
  /** Formulas used */
  formulas: string[];
  
  /** Material database lookup info (if applicable) */
  materialLookup?: {
    materialSpec: string;
    temperature: number;
    stress: number;
    source: 'database' | 'manual';
    databaseVersion?: string;
  };
  
  /** Warnings generated */
  warnings?: string[];
}

// ============================================================================
// AUDIT TRAIL STORAGE (In-memory for now, can be extended to database)
// ============================================================================

const auditLog: AuditEntry[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique audit entry ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

/**
 * Calculate checksum for audit entry integrity
 */
function calculateChecksum(entry: Omit<AuditEntry, 'checksum'>): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    userId: entry.userId,
    previousValues: entry.previousValues,
    newValues: entry.newValues,
    calculationInputs: entry.calculationInputs,
    calculationOutputs: entry.calculationOutputs
  });
  
  // Simple hash for demonstration - in production use crypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Verify checksum integrity of an audit entry
 */
export function verifyChecksum(entry: AuditEntry): boolean {
  const { checksum, ...entryWithoutChecksum } = entry;
  const calculatedChecksum = calculateChecksum(entryWithoutChecksum);
  return checksum === calculatedChecksum;
}

// ============================================================================
// CORE AUDIT FUNCTIONS
// ============================================================================

/**
 * Log an audit entry for any data change
 */
export function logAuditEntry(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  userId: string,
  userName: string,
  options: {
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    calculationInputs?: Record<string, unknown>;
    calculationOutputs?: Record<string, unknown>;
    codeReferences?: string[];
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  } = {}
): AuditEntry {
  const entryWithoutChecksum: Omit<AuditEntry, 'checksum'> = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    userId,
    userName,
    ...options
  };
  
  const entry: AuditEntry = {
    ...entryWithoutChecksum,
    checksum: calculateChecksum(entryWithoutChecksum)
  };
  
  auditLog.push(entry);
  
  logger.info(`[AUDIT] ${action} ${entityType} ${entityId} by ${userName}`, {
    auditId: entry.id,
    checksum: entry.checksum
  });
  
  return entry;
}

/**
 * Log a calculation audit entry with full traceability
 */
export function logCalculationAudit(
  entityType: AuditEntityType,
  entityId: string,
  userId: string,
  userName: string,
  calculationData: CalculationAuditData,
  metadata?: Record<string, unknown>
): AuditEntry {
  return logAuditEntry(
    'CALCULATE',
    entityType,
    entityId,
    userId,
    userName,
    {
      calculationInputs: calculationData.inputs,
      calculationOutputs: calculationData.outputs,
      codeReferences: calculationData.codeReferences,
      metadata: {
        calculationType: calculationData.calculationType,
        formulas: calculationData.formulas,
        intermediateValues: calculationData.intermediateValues,
        materialLookup: calculationData.materialLookup,
        warnings: calculationData.warnings,
        ...metadata
      }
    }
  );
}

/**
 * Log a data change with before/after values
 */
export function logDataChange(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: AuditEntityType,
  entityId: string,
  userId: string,
  userName: string,
  previousValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  metadata?: Record<string, unknown>
): AuditEntry {
  return logAuditEntry(
    action,
    entityType,
    entityId,
    userId,
    userName,
    {
      previousValues: previousValues ?? undefined,
      newValues: newValues ?? undefined,
      metadata
    }
  );
}

/**
 * Query audit entries with filters
 */
export function queryAuditLog(query: AuditQuery): AuditEntry[] {
  let results = [...auditLog];
  
  if (query.entityType) {
    results = results.filter(e => e.entityType === query.entityType);
  }
  
  if (query.entityId) {
    results = results.filter(e => e.entityId === query.entityId);
  }
  
  if (query.action) {
    results = results.filter(e => e.action === query.action);
  }
  
  if (query.userId) {
    results = results.filter(e => e.userId === query.userId);
  }
  
  if (query.startDate) {
    results = results.filter(e => e.timestamp >= query.startDate!);
  }
  
  if (query.endDate) {
    results = results.filter(e => e.timestamp <= query.endDate!);
  }
  
  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  
  // Apply pagination
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  
  return results.slice(offset, offset + limit);
}

/**
 * Get audit history for a specific entity
 */
export function getEntityAuditHistory(
  entityType: AuditEntityType,
  entityId: string
): AuditEntry[] {
  return queryAuditLog({ entityType, entityId });
}

/**
 * Get all calculation audits for an inspection
 */
export function getCalculationAudits(inspectionId: string): AuditEntry[] {
  return auditLog.filter(
    e => e.action === 'CALCULATE' && 
         (e.entityId === inspectionId || 
          e.metadata?.inspectionId === inspectionId)
  );
}

/**
 * Export audit log for regulatory compliance
 */
export function exportAuditLog(query?: AuditQuery): {
  exportDate: string;
  totalEntries: number;
  entries: AuditEntry[];
  integrityVerified: boolean;
} {
  const entries = query ? queryAuditLog(query) : [...auditLog];
  
  // Verify integrity of all entries
  const integrityVerified = entries.every(verifyChecksum);
  
  return {
    exportDate: new Date().toISOString(),
    totalEntries: entries.length,
    entries,
    integrityVerified
  };
}

/**
 * Generate audit report for a specific inspection
 */
export function generateInspectionAuditReport(inspectionId: string): string {
  const entries = getEntityAuditHistory('inspection', inspectionId);
  const calculations = getCalculationAudits(inspectionId);
  
  let report = `# Inspection Audit Report\n\n`;
  report += `**Inspection ID:** ${inspectionId}\n`;
  report += `**Report Generated:** ${new Date().toISOString()}\n`;
  report += `**Total Audit Entries:** ${entries.length}\n`;
  report += `**Calculation Entries:** ${calculations.length}\n\n`;
  
  report += `## Audit Trail\n\n`;
  report += `| Timestamp | Action | User | Details |\n`;
  report += `|-----------|--------|------|----------|\n`;
  
  for (const entry of entries) {
    const details = entry.action === 'CALCULATE' 
      ? entry.metadata?.calculationType 
      : Object.keys(entry.newValues || {}).join(', ');
    report += `| ${entry.timestamp} | ${entry.action} | ${entry.userName} | ${details} |\n`;
  }
  
  report += `\n## Calculation Audit Details\n\n`;
  
  for (const calc of calculations) {
    report += `### ${calc.metadata?.calculationType || 'Calculation'}\n`;
    report += `**Timestamp:** ${calc.timestamp}\n`;
    report += `**User:** ${calc.userName}\n`;
    report += `**Code References:** ${calc.codeReferences?.join(', ') || 'N/A'}\n`;
    report += `**Checksum:** ${calc.checksum}\n\n`;
    
    if (calc.calculationInputs) {
      report += `**Inputs:**\n\`\`\`json\n${JSON.stringify(calc.calculationInputs, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (calc.calculationOutputs) {
      report += `**Outputs:**\n\`\`\`json\n${JSON.stringify(calc.calculationOutputs, null, 2)}\n\`\`\`\n\n`;
    }
  }
  
  return report;
}

/**
 * Clear audit log (for testing only - should never be used in production)
 */
export function _clearAuditLogForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Cannot clear audit log outside of test environment');
  }
  auditLog.length = 0;
}
