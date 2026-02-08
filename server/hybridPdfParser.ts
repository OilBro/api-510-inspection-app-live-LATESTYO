import { logger } from './_core/logger';
import { parseWithManusAPI, parseAndStandardizeWithManus } from './manusParser';

/**
 * Hybrid PDF Parser - Handles mixed text-based and scanned pages
 * Auto-detects per-page and uses appropriate extraction method
 */
export async function parseWithHybrid(
  fileBuffer: Buffer,
  filename: string
): Promise<any> {
  logger.info('[Hybrid Parser] Starting hybrid PDF parsing...');

  try {
    // Step 1: Extract text from all pages and analyze each
    let parseResult: any;
    try {
      parseResult = await parseWithManusAPI(fileBuffer, filename);
    } catch (error) {
      logger.error('[Hybrid Parser] Manus API failed, falling back to standard parser:', error);
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    }

    // Validate parse result structure
    if (!parseResult || typeof parseResult !== 'object') {
      logger.warn('[Hybrid Parser] Invalid parse result, using standard parser');
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    }

    const pages = Array.isArray(parseResult.pages) ? parseResult.pages : [];
    const totalPages = parseResult.metadata?.numPages || pages.length;

    if (pages.length === 0) {
      logger.warn('[Hybrid Parser] No pages extracted, falling back to standard parser');
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    }

    // Step 2: Identify which pages are scanned vs text-based
    const TEXT_THRESHOLD = 200; // chars per page minimum (increased for better detection)
    const scannedPageNumbers: number[] = [];
    const textPageNumbers: number[] = [];
    let combinedText = '';

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // Validate page structure
      if (!page || typeof page !== 'object') {
        logger.warn(`[Hybrid Parser] Invalid page structure at index ${i}, skipping`);
        continue;
      }

      const pageText = (page.text || '').toString().trim();
      const pageNum = page.pageNumber || (i + 1);
      
      if (pageText.length < TEXT_THRESHOLD) {
        scannedPageNumbers.push(pageNum);
        logger.info(`[Hybrid Parser] Page ${pageNum} detected as SCANNED (${pageText.length} chars)`);
      } else {
        textPageNumbers.push(pageNum);
        combinedText += pageText + '\n';
        logger.info(`[Hybrid Parser] Page ${pageNum} detected as TEXT (${pageText.length} chars)`);
      }
    }

    logger.info(`[Hybrid Parser] Analysis: ${textPageNumbers.length} text pages, ${scannedPageNumbers.length} scanned pages`);

    // Step 3: Determine parsing strategy
    const scannedRatio = scannedPageNumbers.length / totalPages;

    // If >50% scanned, use full vision parsing (more accurate for mixed docs)
    if (scannedRatio > 0.5) {
      logger.info('[Hybrid Parser] Majority scanned - using full vision parser');
      const { parseWithVision } = await import('./visionPdfParser');
      return await parseWithVision(fileBuffer);
    }

    // If 100% text-based, use standard text extraction
    if (scannedPageNumbers.length === 0) {
      logger.info('[Hybrid Parser] All text-based - using standard text parser');
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    }

    // Step 4: Hybrid approach - extract from text pages, then vision for scanned pages
    logger.info('[Hybrid Parser] Mixed content - using hybrid extraction');

    // First, get text-based extraction
    const textExtraction = await parseAndStandardizeWithManus(fileBuffer, filename);

    // Then, get vision extraction for the scanned pages
    const { parseWithVision } = await import('./visionPdfParser');
    const visionExtraction = await parseWithVision(fileBuffer);

    // Step 5: Merge results - prefer text extraction but fill gaps from vision
    const merged = mergeExtractionResults(textExtraction, visionExtraction);
    
    logger.info('[Hybrid Parser] Hybrid parsing complete:', {
      textPages: textPageNumbers.length,
      scannedPages: scannedPageNumbers.length,
      tmlReadings: merged.tmlReadings?.length || 0,
    });

    return merged;
  } catch (error) {
    logger.error('[Hybrid Parser] Fatal error in hybrid parser:', error);
    logger.info('[Hybrid Parser] Attempting fallback to standard parser');
    
    try {
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    } catch (fallbackError) {
      logger.error('[Hybrid Parser] Fallback parser also failed:', fallbackError);
      throw error; // Throw original error
    }
  }
}

/**
 * Merge text-based and vision extraction results
 * Prefers text extraction but fills gaps from vision
 */
function mergeExtractionResults(textResult: any, visionResult: any): any {
  // Start with text extraction as base
  const merged = { ...textResult };

  // Merge vessel info - fill in missing fields from vision
  if (visionResult.vesselInfo || visionResult.vesselData) {
    const visionVessel = visionResult.vesselInfo || visionResult.vesselData || {};
    merged.vesselData = merged.vesselData || {};
    
    for (const [key, value] of Object.entries(visionVessel)) {
      if (!merged.vesselData[key] && value) {
        merged.vesselData[key] = value;
        logger.info(`[Hybrid Parser] Filled vesselData.${key} from vision`);
      }
    }
  }

  // Merge TML readings - combine and deduplicate by CML number
  const textTmls = merged.tmlReadings || textResult.tmlReadings || [];
  const visionTmls = visionResult.thicknessMeasurements || visionResult.tmlReadings || [];
  
  if (visionTmls.length > 0) {
    const cmlMap = new Map<string, any>();
    
    // Add text TMLs first (priority)
    for (const tml of textTmls) {
      const key = tml.legacyLocationId || tml.cml || tml.tmlId || '';
      if (key) cmlMap.set(key.toLowerCase(), tml);
    }
    
    // Add vision TMLs if not already present
    for (const tml of visionTmls) {
      const key = tml.legacyLocationId || tml.cml || tml.tmlId || '';
      if (key && !cmlMap.has(key.toLowerCase())) {
        cmlMap.set(key.toLowerCase(), tml);
        logger.info(`[Hybrid Parser] Added TML ${key} from vision`);
      }
    }
    
    merged.tmlReadings = Array.from(cmlMap.values());
  }

  // Merge checklist items
  const textChecklist = merged.inspectionChecklist || textResult.checklistItems || [];
  const visionChecklist = visionResult.checklistItems || [];
  
  if (visionChecklist.length > textChecklist.length) {
    merged.inspectionChecklist = visionChecklist;
    logger.info(`[Hybrid Parser] Using vision checklist (${visionChecklist.length} items)`);
  }

  // Merge nozzles
  const textNozzles = merged.nozzles || [];
  const visionNozzles = visionResult.nozzles || [];
  
  if (visionNozzles.length > textNozzles.length) {
    merged.nozzles = visionNozzles;
    logger.info(`[Hybrid Parser] Using vision nozzles (${visionNozzles.length} items)`);
  }

  // Merge Table A
  if (!merged.tableA?.components?.length && visionResult.tableA?.components?.length) {
    merged.tableA = visionResult.tableA;
    logger.info('[Hybrid Parser] Using Table A from vision');
  }

  // Merge narrative fields if missing
  if (!merged.executiveSummary && visionResult.executiveSummary) {
    merged.executiveSummary = visionResult.executiveSummary;
  }
  if (!merged.inspectionResults && visionResult.inspectionResults) {
    merged.inspectionResults = visionResult.inspectionResults;
  }
  if (!merged.recommendations && visionResult.recommendations) {
    merged.recommendations = visionResult.recommendations;
  }

  return merged;
}

