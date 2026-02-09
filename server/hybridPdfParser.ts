import { logger } from './_core/logger';
import { parseWithManusAPI, parseAndStandardizeWithManus } from './manusParser';

/**
 * Hybrid PDF Parser - Handles mixed text-based and scanned pages
 * Auto-detects per-page and uses appropriate extraction method
 * 
 * Strategy:
 * 1. Extract text with pdfjs-dist to analyze page content
 * 2. If mostly text-based → use text extraction + LLM (faster, handles large docs)
 * 3. If mostly scanned → use vision parser (reads images directly)
 * 4. If mixed → run both and merge results (most thorough)
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
      logger.error('[Hybrid Parser] Text extraction failed, falling back to vision parser:', error);
      try {
        const { parseWithVision } = await import('./visionPdfParser');
        return await parseWithVision(fileBuffer);
      } catch (visionError) {
        logger.error('[Hybrid Parser] Vision parser also failed:', visionError);
        throw error;
      }
    }

    // Validate parse result structure
    if (!parseResult || typeof parseResult !== 'object') {
      logger.warn('[Hybrid Parser] Invalid parse result, using vision parser');
      const { parseWithVision } = await import('./visionPdfParser');
      return await parseWithVision(fileBuffer);
    }

    const pages = Array.isArray(parseResult.pages) ? parseResult.pages : [];
    const totalPages = parseResult.metadata?.numPages || pages.length;

    if (pages.length === 0) {
      logger.warn('[Hybrid Parser] No pages extracted, falling back to vision parser');
      const { parseWithVision } = await import('./visionPdfParser');
      return await parseWithVision(fileBuffer);
    }

    // Step 2: Identify which pages are scanned vs text-based
    const TEXT_THRESHOLD = 100; // chars per page minimum (lowered for better detection of sparse pages)
    const scannedPageNumbers: number[] = [];
    const textPageNumbers: number[] = [];
    let combinedText = '';
    let totalTextLength = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      // Validate page structure
      if (!page || typeof page !== 'object') {
        logger.warn(`[Hybrid Parser] Invalid page structure at index ${i}, skipping`);
        continue;
      }

      const pageText = (page.text || '').toString().trim();
      const pageNum = page.pageNumber || (i + 1);
      totalTextLength += pageText.length;
      
      if (pageText.length < TEXT_THRESHOLD) {
        scannedPageNumbers.push(pageNum);
        logger.info(`[Hybrid Parser] Page ${pageNum} detected as SCANNED (${pageText.length} chars)`);
      } else {
        textPageNumbers.push(pageNum);
        combinedText += pageText + '\n';
        logger.info(`[Hybrid Parser] Page ${pageNum} detected as TEXT (${pageText.length} chars)`);
      }
    }

    logger.info(`[Hybrid Parser] Analysis: ${textPageNumbers.length} text pages, ${scannedPageNumbers.length} scanned pages, total text: ${totalTextLength} chars`);

    // Step 3: Determine parsing strategy
    const scannedRatio = scannedPageNumbers.length / Math.max(totalPages, 1);

    // If >60% scanned, use full vision parsing (more accurate for image-heavy docs)
    if (scannedRatio > 0.6) {
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

    // Run both parsers in parallel for speed
    const [textExtraction, visionExtraction] = await Promise.allSettled([
      parseAndStandardizeWithManus(fileBuffer, filename),
      (async () => {
        const { parseWithVision } = await import('./visionPdfParser');
        return await parseWithVision(fileBuffer);
      })(),
    ]);

    const textResult = textExtraction.status === 'fulfilled' ? textExtraction.value : null;
    const visionResult = visionExtraction.status === 'fulfilled' ? visionExtraction.value : null;

    if (textExtraction.status === 'rejected') {
      logger.warn('[Hybrid Parser] Text extraction failed:', textExtraction.reason);
    }
    if (visionExtraction.status === 'rejected') {
      logger.warn('[Hybrid Parser] Vision extraction failed:', visionExtraction.reason);
    }

    // If only one succeeded, use that
    if (!textResult && visionResult) {
      logger.info('[Hybrid Parser] Only vision succeeded, using vision result');
      return visionResult;
    }
    if (textResult && !visionResult) {
      logger.info('[Hybrid Parser] Only text succeeded, using text result');
      return textResult;
    }
    if (!textResult && !visionResult) {
      throw new Error('Both text and vision parsers failed');
    }

    // Step 5: Merge results - prefer text extraction but fill gaps from vision
    const merged = mergeExtractionResults(textResult, visionResult);
    
    logger.info('[Hybrid Parser] Hybrid parsing complete:', {
      textPages: textPageNumbers.length,
      scannedPages: scannedPageNumbers.length,
      tmlReadings: merged.tmlReadings?.length || merged.thicknessMeasurements?.length || 0,
      nozzles: merged.nozzles?.length || 0,
      checklistItems: merged.checklistItems?.length || merged.inspectionChecklist?.length || 0,
    });

    return merged;
  } catch (error) {
    logger.error('[Hybrid Parser] Fatal error in hybrid parser:', error);
    logger.info('[Hybrid Parser] Attempting fallback to standard parser');
    
    try {
      return await parseAndStandardizeWithManus(fileBuffer, filename);
    } catch (fallbackError) {
      logger.error('[Hybrid Parser] Fallback text parser also failed:', fallbackError);
      
      // Last resort: try vision parser
      try {
        const { parseWithVision } = await import('./visionPdfParser');
        return await parseWithVision(fileBuffer);
      } catch (visionError) {
        logger.error('[Hybrid Parser] All parsers failed');
        throw error; // Throw original error
      }
    }
  }
}

/**
 * Merge text-based and vision extraction results
 * Strategy: Use text extraction as base, fill gaps from vision, 
 * and take the LARGER dataset for arrays (TMLs, nozzles, checklist)
 */
function mergeExtractionResults(textResult: any, visionResult: any): any {
  // Start with text extraction as base
  const merged = { ...textResult };

  // Merge vessel info - fill in missing fields from vision
  const textVessel = textResult.vesselData || textResult.vesselInfo || {};
  const visionVessel = visionResult.vesselInfo || visionResult.vesselData || {};
  
  merged.vesselData = { ...textVessel };
  
  for (const [key, value] of Object.entries(visionVessel)) {
    if ((!merged.vesselData[key] || merged.vesselData[key] === '') && value && value !== '') {
      merged.vesselData[key] = value;
      logger.info(`[Hybrid Parser] Filled vesselData.${key} from vision: ${String(value).substring(0, 50)}`);
    }
  }

  // Also merge top-level vessel fields (for flat format parsers)
  const vesselFields = [
    'vesselTagNumber', 'vesselName', 'manufacturer', 'serialNumber', 'yearBuilt',
    'nbNumber', 'designPressure', 'designTemperature', 'operatingPressure',
    'operatingTemperature', 'mdmt', 'materialSpec', 'allowableStress',
    'jointEfficiency', 'insideDiameter', 'overallLength', 'headType',
    'vesselConfiguration', 'constructionCode', 'product', 'insulationType',
    'corrosionAllowance', 'radiographyType', 'specificGravity',
    'crownRadius', 'knuckleRadius',
  ];
  
  for (const field of vesselFields) {
    if ((!merged[field] || merged[field] === '') && (visionVessel[field] || visionResult[field])) {
      merged[field] = visionVessel[field] || visionResult[field];
    }
  }

  // Merge report info
  const textReport = textResult.reportInfo || {};
  const visionReport = visionResult.reportInfo || visionResult.inspectionInfo || {};
  merged.reportInfo = { ...textReport };
  
  for (const [key, value] of Object.entries(visionReport)) {
    if ((!merged.reportInfo[key] || merged.reportInfo[key] === '') && value && value !== '') {
      merged.reportInfo[key] = value;
      logger.info(`[Hybrid Parser] Filled reportInfo.${key} from vision`);
    }
  }

  // Merge client info
  const textClient = textResult.clientInfo || {};
  const visionClient = visionResult.clientInfo || {};
  merged.clientInfo = { ...textClient };
  
  for (const [key, value] of Object.entries(visionClient)) {
    if ((!merged.clientInfo[key] || merged.clientInfo[key] === '') && value && value !== '') {
      merged.clientInfo[key] = value;
    }
  }

  // Merge TML readings - take the LARGER set, then fill gaps
  const textTmls = textResult.tmlReadings || textResult.thicknessMeasurements || [];
  const visionTmls = visionResult.thicknessMeasurements || visionResult.tmlReadings || [];
  
  if (visionTmls.length > 0 || textTmls.length > 0) {
    // Use the larger set as base
    const baseTmls = textTmls.length >= visionTmls.length ? textTmls : visionTmls;
    const supplementTmls = textTmls.length >= visionTmls.length ? visionTmls : textTmls;
    
    const cmlMap = new Map<string, any>();
    
    // Add base TMLs first
    for (const tml of baseTmls) {
      const key = (tml.legacyLocationId || tml.cml || tml.tmlId || '').toString().toLowerCase().trim();
      if (key) cmlMap.set(key, tml);
    }
    
    // Add supplement TMLs if not already present
    for (const tml of supplementTmls) {
      const key = (tml.legacyLocationId || tml.cml || tml.tmlId || '').toString().toLowerCase().trim();
      if (key && !cmlMap.has(key)) {
        cmlMap.set(key, tml);
        logger.info(`[Hybrid Parser] Added TML ${key} from supplementary source`);
      }
    }
    
    merged.tmlReadings = Array.from(cmlMap.values());
    logger.info(`[Hybrid Parser] Merged TMLs: ${merged.tmlReadings.length} (text: ${textTmls.length}, vision: ${visionTmls.length})`);
  }

  // Merge checklist items - take the larger set
  const textChecklist = textResult.inspectionChecklist || textResult.checklistItems || [];
  const visionChecklist = visionResult.checklistItems || visionResult.inspectionChecklist || [];
  
  if (visionChecklist.length > textChecklist.length) {
    merged.inspectionChecklist = visionChecklist;
    merged.checklistItems = visionChecklist;
    logger.info(`[Hybrid Parser] Using vision checklist (${visionChecklist.length} vs ${textChecklist.length} items)`);
  } else {
    merged.inspectionChecklist = textChecklist;
    merged.checklistItems = textChecklist;
  }

  // Merge nozzles - take the larger set
  const textNozzles = textResult.nozzles || [];
  const visionNozzles = visionResult.nozzles || [];
  
  if (visionNozzles.length > textNozzles.length) {
    merged.nozzles = visionNozzles;
    logger.info(`[Hybrid Parser] Using vision nozzles (${visionNozzles.length} vs ${textNozzles.length} items)`);
  }

  // Merge Table A - prefer whichever has data
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
