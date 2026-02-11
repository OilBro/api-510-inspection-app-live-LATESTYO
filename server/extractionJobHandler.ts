import { logger } from "./_core/logger";
import { parseExcelFile, parsePDFFile } from "./fileParser";
import { getDb } from "./db";
import { extractionJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sanitizeExtractedData } from "./extractionSanitizer";

type ParserType = "docupipe" | "manus" | "vision" | "hybrid" | undefined;

/**
 * Normalize parsed data from any parser into a consistent structure.
 * Handles differences between manus, vision, hybrid, and docupipe output formats.
 * 
 * IMPORTANT: This normalizer produces a structure compatible with the sanitizer.
 * The sanitizer expects nested format: { reportInfo, vesselData, tmlReadings, inspectionChecklist }
 * For flat data (from fileParser.ts), we re-nest it so the sanitizer can process it uniformly.
 */
function normalizeParserOutput(raw: any): any {
  // The parsers return data in different shapes:
  // - fileParser.ts (manus/docupipe): flat ParsedVesselData with top-level fields
  // - visionPdfParser: nested { vesselInfo, reportInfo, clientInfo, thicknessMeasurements }
  // - hybridPdfParser: mixed { vesselData, vesselInfo, reportInfo, tmlReadings, thicknessMeasurements }
  // - manusParser (standardized): nested { vesselData, reportInfo, clientInfo, tmlReadings }
  
  // Detect which format we have and normalize to flat
  const hasNestedVesselInfo = raw.vesselInfo && typeof raw.vesselInfo === 'object';
  const hasNestedVesselData = raw.vesselData && typeof raw.vesselData === 'object';
  const hasNestedReportInfo = raw.reportInfo && typeof raw.reportInfo === 'object';
  const hasNestedClientInfo = raw.clientInfo && typeof raw.clientInfo === 'object';
  
  // If it's already flat (from fileParser.ts parsePDFFile), convert to nested for sanitizer
  if (!hasNestedVesselInfo && !hasNestedVesselData && !hasNestedReportInfo) {
    return {
      reportInfo: {
        reportNumber: raw.reportNumber || '',
        reportDate: raw.reportDate || '',
        inspectionDate: raw.inspectionDate || '',
        inspectionType: raw.inspectionType || '',
        inspectionCompany: raw.inspectionCompany || '',
        inspectorName: raw.inspectorName || '',
        inspectorCert: raw.inspectorCert || '',
      },
      clientInfo: {
        clientName: raw.clientName || '',
        clientLocation: raw.clientLocation || '',
        product: raw.product || '',
      },
      vesselData: {
        vesselTagNumber: raw.vesselTagNumber || '',
        vesselName: raw.vesselName || '',
        manufacturer: raw.manufacturer || '',
        serialNumber: raw.serialNumber || '',
        yearBuilt: raw.yearBuilt,
        nbNumber: raw.nbNumber || '',
        designPressure: raw.designPressure || '',
        designTemperature: raw.designTemperature || '',
        operatingPressure: raw.operatingPressure || '',
        operatingTemperature: raw.operatingTemperature || '',
        mdmt: raw.mdmt || '',
        materialSpec: raw.materialSpec || '',
        allowableStress: raw.allowableStress || '',
        jointEfficiency: raw.jointEfficiency || '',
        radiographyType: raw.radiographyType || '',
        specificGravity: raw.specificGravity || '',
        vesselType: raw.vesselType || '',
        vesselConfiguration: raw.vesselConfiguration || '',
        insideDiameter: raw.insideDiameter || '',
        overallLength: raw.overallLength || '',
        headType: raw.headType || '',
        crownRadius: raw.crownRadius || '',
        knuckleRadius: raw.knuckleRadius || '',
        constructionCode: raw.constructionCode || '',
        insulationType: raw.insulationType || '',
        corrosionAllowance: raw.corrosionAllowance || '',
      },
      executiveSummary: raw.executiveSummary || '',
      inspectionResults: raw.inspectionResults || '',
      recommendations: raw.recommendations || '',
      tmlReadings: raw.tmlReadings || raw.thicknessMeasurements || [],
      inspectionChecklist: raw.checklistItems || raw.inspectionChecklist || [],
      nozzles: raw.nozzles || [],
      tableA: raw.tableA || null,
    };
  }
  
  // Merge nested structures into consistent nested format for sanitizer
  const vessel = { ...(raw.vesselData || {}), ...(raw.vesselInfo || {}) };
  const report = raw.reportInfo || {};
  const client = raw.clientInfo || {};
  
  const normalized: any = {
    reportInfo: {
      reportNumber: report.reportNumber || '',
      reportDate: report.reportDate || '',
      inspectionDate: report.inspectionDate || '',
      inspectionType: report.inspectionType || '',
      inspectionCompany: report.inspectionCompany || '',
      inspectorName: report.inspectorName || '',
      inspectorCert: report.inspectorCert || report.inspectorCertification || '',
    },
    clientInfo: {
      clientName: client.clientName || report.clientName || '',
      clientLocation: client.clientLocation || report.clientLocation || '',
      product: vessel.product || client.product || '',
    },
    vesselData: {
      vesselTagNumber: vessel.vesselTagNumber || vessel.vesselTag || '',
      vesselName: vessel.vesselName || vessel.vesselDescription || '',
      manufacturer: vessel.manufacturer || '',
      serialNumber: vessel.serialNumber || '',
      yearBuilt: vessel.yearBuilt ? (typeof vessel.yearBuilt === 'number' ? vessel.yearBuilt : parseInt(vessel.yearBuilt, 10)) : undefined,
      nbNumber: vessel.nbNumber || '',
      designPressure: vessel.designPressure || '',
      designTemperature: vessel.designTemperature || '',
      operatingPressure: vessel.operatingPressure || '',
      operatingTemperature: vessel.operatingTemperature || '',
      mdmt: vessel.mdmt || '',
      materialSpec: vessel.materialSpec || '',
      allowableStress: vessel.allowableStress || '',
      jointEfficiency: vessel.jointEfficiency || '',
      radiographyType: vessel.radiographyType || '',
      specificGravity: vessel.specificGravity || '',
      vesselType: vessel.vesselType || '',
      vesselConfiguration: vessel.vesselConfiguration || '',
      insideDiameter: vessel.insideDiameter || '',
      overallLength: vessel.overallLength || '',
      headType: vessel.headType || '',
      crownRadius: vessel.crownRadius || '',
      knuckleRadius: vessel.knuckleRadius || '',
      constructionCode: vessel.constructionCode || '',
      insulationType: vessel.insulationType || '',
      corrosionAllowance: vessel.corrosionAllowance || '',
    },
    executiveSummary: raw.executiveSummary || '',
    inspectionResults: raw.inspectionResults || '',
    recommendations: raw.recommendations || '',
    tmlReadings: raw.tmlReadings || raw.thicknessMeasurements || [],
    inspectionChecklist: raw.checklistItems || raw.inspectionChecklist || [],
    nozzles: raw.nozzles || [],
    tableA: raw.tableA || null,
  };
  
  return normalized;
}

/**
 * Flatten sanitized nested data back to the format expected by the preview builder.
 * The sanitizer works on nested format; the preview builder expects flat fields.
 */
function flattenForPreview(data: any): any {
  const vessel = data.vesselData || {};
  const report = data.reportInfo || {};
  const client = data.clientInfo || {};
  
  return {
    // Vessel fields
    vesselTagNumber: vessel.vesselTagNumber || '',
    vesselName: vessel.vesselName || '',
    manufacturer: vessel.manufacturer || '',
    serialNumber: vessel.serialNumber || '',
    yearBuilt: vessel.yearBuilt,
    nbNumber: vessel.nbNumber || '',
    designPressure: vessel.designPressure || '',
    designTemperature: vessel.designTemperature || '',
    operatingPressure: vessel.operatingPressure || '',
    operatingTemperature: vessel.operatingTemperature || '',
    mdmt: vessel.mdmt || '',
    materialSpec: vessel.materialSpec || '',
    allowableStress: vessel.allowableStress || '',
    jointEfficiency: vessel.jointEfficiency || '',
    radiographyType: vessel.radiographyType || '',
    specificGravity: vessel.specificGravity || '',
    vesselType: vessel.vesselType || '',
    vesselConfiguration: vessel.vesselConfiguration || '',
    insideDiameter: vessel.insideDiameter || '',
    overallLength: vessel.overallLength || '',
    headType: vessel.headType || '',
    crownRadius: vessel.crownRadius || '',
    knuckleRadius: vessel.knuckleRadius || '',
    constructionCode: vessel.constructionCode || '',
    insulationType: vessel.insulationType || '',
    corrosionAllowance: vessel.corrosionAllowance || '',
    // Report fields
    reportNumber: report.reportNumber || '',
    reportDate: report.reportDate || '',
    inspectionDate: report.inspectionDate || '',
    inspectionType: report.inspectionType || '',
    inspectionCompany: report.inspectionCompany || '',
    inspectorName: report.inspectorName || '',
    inspectorCert: report.inspectorCert || '',
    // Client fields
    clientName: client.clientName || '',
    clientLocation: client.clientLocation || '',
    product: client.product || '',
    // Narratives
    executiveSummary: data.executiveSummary || '',
    inspectionResults: data.inspectionResults || '',
    recommendations: data.recommendations || '',
    // Arrays
    tmlReadings: data.tmlReadings || [],
    checklistItems: data.inspectionChecklist || data.checklistItems || [],
    nozzles: data.nozzles || [],
    tableA: data.tableA || null,
  };
}

/**
 * Process an extraction job in the background
 * This runs asynchronously and updates the job status in the database
 */
export async function processExtractionJob(
  jobId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileType: "pdf" | "excel",
  parserType?: ParserType
): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.error(`[Extraction Job ${jobId}] Database not available`);
    return;
  }
  try {
    // Update job to processing
    await db!.update(extractionJobs)
      .set({
        status: "processing",
        startedAt: new Date(),
        progress: 10,
        progressMessage: "Starting extraction...",
      })
      .where(eq(extractionJobs.id, jobId));

    logger.info(`[Extraction Job ${jobId}] Starting processing for ${fileName}`);

    // Update progress
    await db!.update(extractionJobs)
      .set({
        progress: 20,
        progressMessage: "Parsing file...",
      })
      .where(eq(extractionJobs.id, jobId));

    // Parse based on file type
    let rawParsedData;
    if (fileType === "excel") {
      rawParsedData = await parseExcelFile(fileBuffer);
    } else {
      rawParsedData = await parsePDFFile(fileBuffer, parserType);
    }

    // Update progress - normalization phase
    await db!.update(extractionJobs)
      .set({
        progress: 60,
        progressMessage: "Normalizing extracted data...",
      })
      .where(eq(extractionJobs.id, jobId));

    // Normalize parser output to consistent nested format
    const normalizedData = normalizeParserOutput(rawParsedData);
    
    // Update progress - sanitization phase
    await db!.update(extractionJobs)
      .set({
        progress: 75,
        progressMessage: "Running post-processing sanitizer (7 audit fixes)...",
      })
      .where(eq(extractionJobs.id, jobId));

    // Run the 7-fix sanitizer pipeline for audit defensibility
    const { data: sanitizedData, provenance } = sanitizeExtractedData(
      normalizedData,
      parserType || 'manus'
    );
    
    // Flatten sanitized data for preview builder
    const parsedData = flattenForPreview(sanitizedData);
    
    logger.info(`[Extraction Job ${jobId}] Sanitized data (confidence: ${provenance.confidence.overall}):`, {
      vesselTag: parsedData.vesselTagNumber,
      tmlCount: parsedData.tmlReadings?.length || 0,
      nozzleCount: parsedData.nozzles?.length || 0,
      checklistCount: parsedData.checklistItems?.length || 0,
      hasNarratives: !!(parsedData.executiveSummary || parsedData.inspectionResults),
      overrides: provenance.fieldOverrides.length,
      warnings: provenance.validationWarnings.length,
    });

    // Helper function to parse numeric values for display
    const parseNumeric = (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const str = String(value).trim();
      // Handle negative numbers and decimals
      const match = str.match(/-?[0-9]+\.?[0-9]*/);
      return match ? match[0] : null;
    };

    // Structure the preview data
    const previewData = {
      vesselInfo: {
        vesselTagNumber: parsedData.vesselTagNumber || '',
        vesselName: parsedData.vesselName || '',
        manufacturer: parsedData.manufacturer || '',
        serialNumber: parsedData.serialNumber || '',
        yearBuilt: parsedData.yearBuilt ? String(parsedData.yearBuilt) : '',
        nbNumber: parsedData.nbNumber || '',
        designPressure: parseNumeric(parsedData.designPressure) || '',
        designTemperature: parseNumeric(parsedData.designTemperature) || '',
        operatingPressure: parseNumeric(parsedData.operatingPressure) || '',
        operatingTemperature: parseNumeric(parsedData.operatingTemperature) || '',
        mdmt: parsedData.mdmt || '',
        materialSpec: parsedData.materialSpec || '',
        allowableStress: parseNumeric(parsedData.allowableStress) || '',
        jointEfficiency: parsedData.jointEfficiency || '',
        insideDiameter: parseNumeric(parsedData.insideDiameter) || '',
        overallLength: parseNumeric(parsedData.overallLength) || '',
        headType: parsedData.headType || '',
        vesselType: parsedData.vesselType || '',
        vesselConfiguration: parsedData.vesselConfiguration || '',
        constructionCode: parsedData.constructionCode || '',
        product: parsedData.product || '',
        insulationType: parsedData.insulationType || '',
        corrosionAllowance: parseNumeric(parsedData.corrosionAllowance) || '',
      },
      reportInfo: {
        reportNumber: parsedData.reportNumber || '',
        reportDate: parsedData.reportDate || '',
        inspectionDate: parsedData.inspectionDate || '',
        inspectionType: parsedData.inspectionType || '',
        inspectorName: parsedData.inspectorName || '',
        inspectorCert: parsedData.inspectorCert || '',
        clientName: parsedData.clientName || '',
        clientLocation: parsedData.clientLocation || '',
      },
      tmlReadings: (parsedData.tmlReadings || []).map((tml: any, idx: number) => ({
        id: `tml-${idx}`,
        legacyLocationId: String(tml.legacyLocationId || tml.cml || ''),
        tmlId: String(tml.tmlId || ''),
        location: String(tml.location || tml.sliceLocation || ''),
        component: String(tml.component || ''),
        componentType: String(tml.componentType || ''),
        currentThickness: String(tml.currentThickness ?? tml.tActual ?? ''),
        previousThickness: String(tml.previousThickness ?? ''),
        nominalThickness: String(tml.nominalThickness ?? ''),
        angle: String(tml.angle || ''),
        readingType: String(tml.readingType || ''),
        // Include sanitizer metadata for downstream use
        _dataStatus: tml._metadata?.dataStatus || 'unknown',
        _stationKey: tml._metadata?.stationKey || null,
        _isSeamAdjacent: tml._metadata?.isSeamAdjacent || false,
      })),
      nozzles: (parsedData.nozzles || []).map((noz: any, idx: number) => ({
        id: `noz-${idx}`,
        nozzleNumber: String(noz.nozzleNumber || ''),
        nozzleDescription: String(noz.nozzleDescription || noz.service || noz.description || ''),
        nominalSize: String(noz.nominalSize || noz.size || ''),
        schedule: String(noz.schedule || ''),
        actualThickness: String(noz.actualThickness ?? ''),
        pipeNominalThickness: String(noz.pipeNominalThickness ?? noz.nominalThickness ?? ''),
        minimumRequired: String(noz.minimumRequired ?? ''),
        acceptable: noz.acceptable !== undefined ? noz.acceptable : true,
        notes: String(noz.notes || ''),
      })),
      checklistItems: (parsedData.checklistItems || []).map((item: any, idx: number) => ({
        id: `chk-${idx}`,
        category: item.category || '',
        itemNumber: item.itemNumber || '',
        itemText: item.itemText || item.description || '',
        checked: item.checked ?? false,
        notes: item.notes || '',
        status: item.status || '',
      })),
      narratives: {
        executiveSummary: parsedData.executiveSummary || '',
        inspectionResults: parsedData.inspectionResults || '',
        recommendations: parsedData.recommendations || '',
      },
      tableA: parsedData.tableA || null,
      rawParsedData: rawParsedData,
      // Include provenance and hydrated fields for audit trail
      provenance: provenance,
      hydratedFields: sanitizedData._hydratedFields || null,
      dataQuality: sanitizedData._metadata?.tmlDataQuality || null,
    };

    // Count extracted items for summary
    const extractionSummary = {
      hasVesselInfo: !!previewData.vesselInfo.vesselTagNumber,
      vesselFieldsCount: Object.values(previewData.vesselInfo).filter(v => v && v !== '').length,
      tmlReadingsCount: previewData.tmlReadings.length,
      nozzlesCount: previewData.nozzles.length,
      checklistItemsCount: previewData.checklistItems.length,
      hasNarratives: !!(previewData.narratives.executiveSummary || previewData.narratives.inspectionResults),
      // Sanitizer metrics
      sanitizerOverrides: provenance.fieldOverrides.length,
      sanitizerWarnings: provenance.validationWarnings.length,
      dataConfidence: provenance.confidence.overall,
      tmlDataQuality: sanitizedData._metadata?.tmlDataQuality?.calculationReadyPercentage || 0,
    };

    // Update job as completed
    await db!.update(extractionJobs)
      .set({
        status: "completed",
        progress: 100,
        progressMessage: `Extraction complete (confidence: ${Math.round(provenance.confidence.overall * 100)}%)`,
        extractedData: {
          preview: previewData,
          summary: extractionSummary,
          parserUsed: parserType || 'manus',
        },
        completedAt: new Date(),
      })
      .where(eq(extractionJobs.id, jobId));

    logger.info(`[Extraction Job ${jobId}] Completed successfully:`, extractionSummary);

  } catch (error) {
    logger.error(`[Extraction Job ${jobId}] Failed:`, error);
    
    // Update job as failed
    await db!.update(extractionJobs)
      .set({
        status: "failed",
        progress: 0,
        progressMessage: "Extraction failed",
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(extractionJobs.id, jobId));
  }
}
