import { logger } from "./_core/logger";
import { parseExcelFile, parsePDFFile } from "./fileParser";
import { getDb } from "./db";
import { extractionJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type ParserType = "docupipe" | "manus" | "vision" | "hybrid" | undefined;

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
    let parsedData;
    if (fileType === "excel") {
      parsedData = await parseExcelFile(fileBuffer);
    } else {
      parsedData = await parsePDFFile(fileBuffer, parserType);
    }

    // Update progress
    await db!.update(extractionJobs)
      .set({
        progress: 70,
        progressMessage: "Structuring extracted data...",
      })
      .where(eq(extractionJobs.id, jobId));

    // Helper function to parse numeric values for display
    const parseNumeric = (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const str = String(value).trim();
      const match = str.match(/([0-9]+\.?[0-9]*)/);
      return match ? match[1] : null;
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
        cmlNumber: String(tml.cmlNumber || tml.cml || ''),
        tmlId: String(tml.tmlId || ''),
        location: String(tml.location || ''),
        component: String(tml.component || ''),
        componentType: String(tml.componentType || ''),
        currentThickness: String(tml.currentThickness ?? tml.tActual ?? ''),
        previousThickness: String(tml.previousThickness ?? ''),
        nominalThickness: String(tml.nominalThickness ?? ''),
        angle: String(tml.angle || ''),
        readingType: String(tml.readingType || ''),
      })),
      nozzles: (parsedData.nozzles || []).map((noz: any, idx: number) => ({
        id: `noz-${idx}`,
        nozzleNumber: String(noz.nozzleNumber || ''),
        nozzleDescription: String(noz.nozzleDescription || noz.service || ''),
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
        checked: item.checked || false,
        notes: item.notes || '',
      })),
      narratives: {
        executiveSummary: parsedData.executiveSummary || '',
        inspectionResults: parsedData.inspectionResults || '',
        recommendations: parsedData.recommendations || '',
      },
      tableA: parsedData.tableA || null,
      rawParsedData: parsedData,
    };

    // Count extracted items for summary
    const extractionSummary = {
      hasVesselInfo: !!previewData.vesselInfo.vesselTagNumber,
      vesselFieldsCount: Object.values(previewData.vesselInfo).filter(v => v && v !== '').length,
      tmlReadingsCount: previewData.tmlReadings.length,
      nozzlesCount: previewData.nozzles.length,
      checklistItemsCount: previewData.checklistItems.length,
      hasNarratives: !!(previewData.narratives.executiveSummary || previewData.narratives.inspectionResults),
    };

    // Update job as completed
    await db!.update(extractionJobs)
      .set({
        status: "completed",
        progress: 100,
        progressMessage: "Extraction complete",
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
