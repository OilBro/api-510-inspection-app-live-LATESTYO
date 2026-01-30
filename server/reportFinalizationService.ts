/**
 * Gold Standard Professional Report Finalization Service
 * 
 * This service handles the finalization workflow for professional inspection
 * reports, ensuring all regulatory requirements are met before a report can
 * be marked as final and signed.
 * 
 * Uses direct SQL queries for compatibility with the existing db.ts pattern.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { professionalReports, componentCalculations, auditLog } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  validateInspectorCertification,
  validateReportForFinalization,
  hashReportContent,
  generateComplianceDeterminationBasis,
  APP_VERSION,
} from './validationService';

// Get database instance
async function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }
  return drizzle(process.env.DATABASE_URL);
}

export interface ReportFinalizationResult {
  success: boolean;
  reportId: string;
  status: 'draft' | 'pending_review' | 'final' | 'superseded';
  signatureHash?: string;
  signatureTimestamp?: Date;
  blockingIssues?: string[];
  warnings?: string[];
  message: string;
}

/**
 * Validates and prepares a report for finalization.
 * Does NOT finalize the report - just checks if it can be finalized.
 */
export async function validateForFinalization(reportId: string): Promise<{
  canFinalize: boolean;
  blockingIssues: string[];
  warnings: string[];
  report: typeof professionalReports.$inferSelect | null;
}> {
  const db = await getDatabase();
  
  // Fetch the report
  const reports = await db.select().from(professionalReports).where(eq(professionalReports.id, reportId));
  const report = reports[0] || null;

  if (!report) {
    return {
      canFinalize: false,
      blockingIssues: [`Report with ID ${reportId} not found`],
      warnings: [],
      report: null,
    };
  }

  // Validate the report
  const validation = validateReportForFinalization({
    inspectorName: report.inspectorName || undefined,
    inspectorCertification: report.inspectorCertification || undefined,
    inspectorCertExpiry: report.inspectorCertExpiry?.toISOString() || undefined,
    reportDate: report.reportDate?.toISOString() || undefined,
    api510Compliant: report.api510Compliant || undefined,
    nonComplianceDetails: report.nonComplianceDetails || undefined,
  });

  return {
    canFinalize: validation.canFinalize,
    blockingIssues: validation.blockingIssues,
    warnings: validation.warnings,
    report,
  };
}

/**
 * Finalizes a professional inspection report.
 * This is a critical operation that:
 * 1. Validates inspector certification
 * 2. Validates all required fields are present
 * 3. Creates a content hash for signature verification
 * 4. Updates the report status to 'final'
 * 5. Logs the finalization in the audit trail
 */
export async function finalizeReport(
  reportId: string,
  userId: string,
  userName?: string
): Promise<ReportFinalizationResult> {
  // Step 1: Validate the report can be finalized
  const validation = await validateForFinalization(reportId);

  if (!validation.canFinalize || !validation.report) {
    return {
      success: false,
      reportId,
      status: 'draft',
      blockingIssues: validation.blockingIssues,
      warnings: validation.warnings,
      message: 'Report cannot be finalized due to blocking issues',
    };
  }

  const db = await getDatabase();
  const report = validation.report;

  // Step 2: Fetch all component calculations for this report
  const calculations = await db.select().from(componentCalculations).where(eq(componentCalculations.reportId, reportId));

  // Step 3: Generate compliance determination basis
  const complianceBasis = generateComplianceDeterminationBasis(
    report,
    calculations
  );

  // Step 4: Create report content for hashing (signature verification)
  const reportContentForHash = JSON.stringify({
    reportId: report.id,
    inspectionId: report.inspectionId,
    inspectorName: report.inspectorName,
    inspectorCertification: report.inspectorCertification,
    reportDate: report.reportDate,
    api510Compliant: report.api510Compliant,
    asmeCompliant: report.asmeCompliant,
    calculations: calculations.map(c => ({
      componentName: c.componentName,
      actualThickness: c.actualThickness,
      minimumThickness: c.minimumThickness,
      calculatedMAWP: c.calculatedMAWP,
      remainingLife: c.remainingLife,
    })),
    complianceBasis,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });

  const signatureHash = hashReportContent(reportContentForHash);
  const signatureTimestamp = new Date();

  // Step 5: Update the report with finalization data
  await db.update(professionalReports)
    .set({
      reportStatus: 'final',
      inspectorSignatureHash: signatureHash,
      inspectorSignatureDate: signatureTimestamp,
      complianceDeterminationBasis: complianceBasis,
      updatedAt: new Date(),
    })
    .where(eq(professionalReports.id, reportId));

  // Step 6: Log the finalization in the audit trail
  await db.insert(auditLog).values({
    timestamp: new Date(),
    userId,
    userName: userName || null,
    tableName: 'professionalReports',
    recordId: reportId,
    fieldName: 'reportStatus',
    oldValue: report.reportStatus || 'draft',
    newValue: 'final',
    actionType: 'UPDATE',
    justification: 'Report finalized after validation checks passed',
    calculationVersion: APP_VERSION,
    codeReference: 'API 510 §6.1',
  });

  return {
    success: true,
    reportId,
    status: 'final',
    signatureHash,
    signatureTimestamp,
    warnings: validation.warnings,
    message: 'Report finalized successfully',
  };
}

/**
 * Creates a new revision of an existing report.
 * The original report is marked as 'superseded' and a new draft is created.
 */
export async function createReportRevision(
  originalReportId: string,
  revisionReason: string,
  userId: string,
  userName?: string
): Promise<{
  success: boolean;
  newReportId?: string;
  message: string;
}> {
  const db = await getDatabase();
  
  // Fetch the original report
  const reports = await db.select().from(professionalReports).where(eq(professionalReports.id, originalReportId));
  const originalReport = reports[0] || null;

  if (!originalReport) {
    return {
      success: false,
      message: `Original report with ID ${originalReportId} not found`,
    };
  }

  // Create new report ID
  const newReportId = nanoid();
  const currentRevision = originalReport.reportRevision || 0;
  const newRevision = currentRevision + 1;

  // Create the new revision (copy of original with updated fields)
  await db.insert(professionalReports).values({
    ...originalReport,
    id: newReportId,
    reportRevision: newRevision,
    reportStatus: 'draft',
    previousReportId: originalReportId,
    revisionReason,
    inspectorSignature: null,
    inspectorSignatureDate: null,
    inspectorSignatureHash: null,
    clientSignature: null,
    clientSignatureDate: null,
    clientSignatureName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Mark original as superseded
  await db.update(professionalReports)
    .set({
      reportStatus: 'superseded',
      updatedAt: new Date(),
    })
    .where(eq(professionalReports.id, originalReportId));

  // Log the revision in audit trail
  await db.insert(auditLog).values({
    timestamp: new Date(),
    userId,
    userName: userName || null,
    tableName: 'professionalReports',
    recordId: newReportId,
    fieldName: 'reportRevision',
    oldValue: String(currentRevision),
    newValue: String(newRevision),
    actionType: 'CREATE',
    justification: revisionReason,
    calculationVersion: APP_VERSION,
    codeReference: 'API 510 §6.1',
  });

  return {
    success: true,
    newReportId,
    message: `Revision ${newRevision} created successfully`,
  };
}

/**
 * Gets the revision history for a report.
 */
export async function getReportRevisionHistory(reportId: string): Promise<{
  currentReport: typeof professionalReports.$inferSelect | null;
  revisions: Array<{
    id: string;
    revision: number;
    status: string;
    date: string;
    reason?: string;
  }>;
}> {
  const db = await getDatabase();
  
  // Get the current report
  const reports = await db.select().from(professionalReports).where(eq(professionalReports.id, reportId));
  const currentReport = reports[0] || null;

  if (!currentReport) {
    return { currentReport: null, revisions: [] };
  }

  // Build revision chain by following previousReportId links
  const revisions: Array<{
    id: string;
    revision: number;
    status: string;
    date: string;
    reason?: string;
  }> = [];

  // Add current report
  revisions.push({
    id: currentReport.id,
    revision: currentReport.reportRevision || 0,
    status: currentReport.reportStatus || 'draft',
    date: currentReport.createdAt?.toISOString() || '',
    reason: currentReport.revisionReason || undefined,
  });

  // Follow the chain backwards
  let previousId = currentReport.previousReportId;
  while (previousId) {
    const prevReports = await db.select().from(professionalReports).where(eq(professionalReports.id, previousId));
    const previousReport = prevReports[0] || null;

    if (!previousReport) break;

    revisions.push({
      id: previousReport.id,
      revision: previousReport.reportRevision || 0,
      status: previousReport.reportStatus || 'draft',
      date: previousReport.createdAt?.toISOString() || '',
      reason: previousReport.revisionReason || undefined,
    });

    previousId = previousReport.previousReportId;
  }

  // Sort by revision number (descending)
  revisions.sort((a, b) => b.revision - a.revision);

  return { currentReport, revisions };
}

/**
 * Verifies the integrity of a finalized report by recalculating the signature hash.
 */
export async function verifyReportIntegrity(reportId: string): Promise<{
  verified: boolean;
  storedHash?: string;
  calculatedHash?: string;
  message: string;
}> {
  const db = await getDatabase();
  
  const reports = await db.select().from(professionalReports).where(eq(professionalReports.id, reportId));
  const report = reports[0] || null;

  if (!report) {
    return {
      verified: false,
      message: `Report with ID ${reportId} not found`,
    };
  }

  if (report.reportStatus !== 'final') {
    return {
      verified: false,
      message: 'Report is not finalized - no signature hash to verify',
    };
  }

  if (!report.inspectorSignatureHash) {
    return {
      verified: false,
      message: 'Report is marked as final but has no signature hash',
    };
  }

  // Fetch calculations
  const calculations = await db.select().from(componentCalculations).where(eq(componentCalculations.reportId, reportId));

  // Regenerate the compliance basis
  const complianceBasis = generateComplianceDeterminationBasis(report, calculations);

  // Recreate the content that was hashed
  const reportContentForHash = JSON.stringify({
    reportId: report.id,
    inspectionId: report.inspectionId,
    inspectorName: report.inspectorName,
    inspectorCertification: report.inspectorCertification,
    reportDate: report.reportDate,
    api510Compliant: report.api510Compliant,
    asmeCompliant: report.asmeCompliant,
    calculations: calculations.map(c => ({
      componentName: c.componentName,
      actualThickness: c.actualThickness,
      minimumThickness: c.minimumThickness,
      calculatedMAWP: c.calculatedMAWP,
      remainingLife: c.remainingLife,
    })),
    complianceBasis,
    version: APP_VERSION,
    timestamp: report.inspectorSignatureDate,
  });

  const calculatedHash = hashReportContent(reportContentForHash);

  const verified = calculatedHash === report.inspectorSignatureHash;

  return {
    verified,
    storedHash: report.inspectorSignatureHash,
    calculatedHash,
    message: verified
      ? 'Report integrity verified - signature hash matches'
      : 'WARNING: Report integrity check failed - signature hash does not match',
  };
}
