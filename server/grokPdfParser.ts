import { ENV } from "./_core/env";
import { logger } from "./_core/logger";
import { storagePut } from './storage';
import { fromBuffer } from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';

/**
 * Grok 5.2 PDF parser for API 510 pressure vessel inspection reports
 * Uses Grok's vision capabilities for comprehensive data extraction
 */

interface GrokParsedData {
  // Report Information
  reportInfo?: {
    reportNumber?: string;
    reportDate?: string;
    inspectionDate?: string;
    inspectionType?: string;
    inspectionCompany?: string;
    inspectorName?: string;
    inspectorCert?: string;
  };
  
  // Client Information
  clientInfo?: {
    clientName?: string;
    clientLocation?: string;
    product?: string;
  };
  
  // Vessel Information
  vesselInfo?: {
    vesselTag?: string;
    vesselDescription?: string;
    manufacturer?: string;
    serialNumber?: string;
    yearBuilt?: string;
    nbNumber?: string;
    constructionCode?: string;
    vesselType?: string;
    vesselConfiguration?: string;
    designPressure?: string;
    designTemperature?: string;
    operatingPressure?: string;
    operatingTemperature?: string;
    mdmt?: string;
    product?: string;
    corrosionAllowance?: string;
    insideDiameter?: string;
    overallLength?: string;
    materialSpec?: string;
    headType?: string;
    insulationType?: string;
    allowableStress?: string;
    jointEfficiency?: string;
    radiographyType?: string;
    specificGravity?: string;
    crownRadius?: string;
    knuckleRadius?: string;
  };
  
  // Narratives
  executiveSummary?: string;
  inspectionResults?: string;
  recommendations?: string;
  
  // Thickness Measurements
  thicknessMeasurements?: Array<{
    legacyLocationId?: string;
    tmlId?: string;
    location?: string;
    component?: string;
    componentType?: string;
    readingType?: string;
    nozzleSize?: string;
    angle?: string;
    currentThickness?: string | number;
    previousThickness?: string | number;
    nominalThickness?: string | number;
    minimumRequired?: number;
    calculatedMAWP?: number;
    tActual?: string | number;
    tml1?: string | number;
    tml2?: string | number;
    tml3?: string | number;
    tml4?: string | number;
  }>;
  
  // Checklist Items
  checklistItems?: Array<{
    category?: string;
    itemNumber?: string;
    itemText?: string;
    description?: string;
    status?: string;
    notes?: string;
  }>;
  
  // Inspection Info (alternative structure)
  inspectionInfo?: {
    reportNumber?: string;
    reportDate?: string;
    inspectionDate?: string;
    inspectionType?: string;
    inspectorName?: string;
    inspectorCertification?: string;
    clientName?: string;
    clientLocation?: string;
  };
  
  // Table A - Component Calculations
  tableA?: {
    components?: Array<{
      component?: string;
      nominalThickness?: number;
      actualThickness?: number;
      minimumRequired?: number;
      calculatedMAWP?: number;
      corrosionRate?: number;
      remainingLife?: number;
    }>;
  };
  
  // Nozzle Evaluations
  nozzles?: Array<{
    nozzleNumber?: string;
    service?: string;
    description?: string;
    size?: string;
    schedule?: string;
    actualThickness?: string | number;
    nominalThickness?: string | number;
    minimumRequired?: string | number;
    acceptable?: boolean;
    notes?: string;
  }>;
}

/**
 * Parse a PDF using Grok 5.2 to extract comprehensive inspection data
 * Uploads PDF to S3 and sends URL to Grok API
 */
export async function parseWithGrok(pdfBuffer: Buffer): Promise<GrokParsedData> {
  try {
    logger.info('[Grok Parser] Converting PDF to images for Grok vision API');
    
    // Convert PDF to images (Grok only accepts image formats, not PDFs)
    const timestamp = Date.now();
    const tempDir = `/tmp/grok-parser-${timestamp}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    const options = {
      density: 200,
      saveFilename: `page`,
      savePath: tempDir,
      format: 'png',
      width: 2000,
      height: 2000,
    };
    
    const convert = fromBuffer(pdfBuffer, options);
    
    // Convert all pages
    logger.info('[Grok Parser] Converting PDF pages to PNG...');
    const pageResults = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 50) { // Limit to 50 pages max
      try {
        const result = await convert(pageNum, { responseType: 'buffer' });
        if (result && result.buffer) {
          pageResults.push(result.buffer);
          pageNum++;
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        hasMorePages = false;
      }
    }
    
    logger.info(`[Grok Parser] Converted ${pageResults.length} pages to PNG`);
    
    // Upload images to S3
    const imageUrls: string[] = [];
    for (let i = 0; i < pageResults.length; i++) {
      const imageKey = `grok-parser/${timestamp}-page-${i + 1}.png`;
      const { url } = await storagePut(imageKey, pageResults[i], 'image/png');
      imageUrls.push(url);
    }
    
    logger.info(`[Grok Parser] Uploaded ${imageUrls.length} images to S3`);
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn('[Grok Parser] Failed to clean up temp directory:', cleanupError);
    }
    
    // Comprehensive extraction prompt for API 510 inspection reports
    const extractionPrompt = `You are an expert at extracting vessel inspection data from API 510 pressure vessel inspection reports.
Extract ALL available information and return it as structured JSON.

CRITICAL INSTRUCTIONS:

0. MULTI-PAGE TABLES - VERY IMPORTANT:
   - Thickness measurement tables often span MULTIPLE PAGES
   - Continue reading ALL pages of the document
   - Look for table continuations ("continued", "cont'd", page breaks in tables)
   - Extract EVERY row from thickness tables, even if they span 5+ pages
   - Do NOT stop at the first page of a table

1. REPORT & CLIENT INFO:
   - Extract report number, date, inspection date, inspector name/certification
   - Extract client name, location, and product/service

2. VESSEL DATA - Extract ALL of these fields:
   - Vessel tag number, name/description, manufacturer, serial number
   - Year built, NB number, construction code
   - Vessel type (pressure vessel, storage tank, etc.)
   - Vessel configuration (Horizontal or Vertical)
   - Design pressure (psi), design temperature (°F)
   - Operating pressure, operating temperature
   - MDMT (Minimum Design Metal Temperature)
   - Product/service
   - Corrosion allowance (inches)
   - Inside diameter (inches), overall length (inches)
   - Material specification (e.g., SA-516 Grade 70)
   - Head type (2:1 Ellipsoidal, Hemispherical, Torispherical, Flanged & Dished)
   - Insulation type

3. ASME CALCULATION PARAMETERS:
   - S (Allowable Stress) - typically 17500, 20000, etc. psi
   - E (Joint Efficiency) - typically 0.85 or 1.0
   - Radiography type (RT-1, RT-2, RT-3, RT-4)
   - Specific gravity of contents
   - For torispherical heads: Crown radius (L) and Knuckle radius (r)

4. THICKNESS MEASUREMENTS (TML Readings):
   - Extract ALL CML/TML readings from ALL pages
   - COMPONENT TYPE: Must be "Shell", "East Head", "West Head", or "Nozzle"
   - Include: CML number, location, component, nominal/previous/current thickness
   - For multi-angle readings (0°, 90°, 180°, 270°), create separate entries

5. NOZZLES:
   - Extract ALL nozzle data from nozzle schedule or evaluation tables
   - Include: nozzle number, service/description, size, schedule
   - Include: actual thickness, nominal thickness, minimum required, acceptable status

6. INSPECTION CHECKLIST:
   - Extract checklist items with category, description, status
   - Status should be: Satisfactory, Unsatisfactory, N/A, Pass, Fail

7. NARRATIVES:
   - Extract executive summary, inspection results, recommendations

Return ONLY valid JSON with no markdown formatting or explanation.`;

    // Build message content array with text prompt and all page images
    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
      { type: 'text', text: extractionPrompt }
    ];
    
    // Add all page images
    for (const imageUrl of imageUrls) {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'high'
        }
      });
    }
    
    logger.info(`[Grok Parser] Sending ${imageUrls.length} images to Grok API...`);
    
    // Call Grok API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.grokApiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-vision-1212',
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Grok Parser] API error: ${response.status} - ${errorText}`);
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    logger.info('[Grok Parser] Received response from Grok API');

    // Extract the JSON content from the response
    const content = result.choices?.[0]?.message?.content || '{}';
    
    // Remove markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedData: GrokParsedData = JSON.parse(jsonContent);
    
    logger.info('[Grok Parser] Successfully parsed response:', {
      vesselTag: parsedData.vesselInfo?.vesselTag,
      tmlCount: parsedData.thicknessMeasurements?.length || 0,
      nozzleCount: parsedData.nozzles?.length || 0,
      checklistCount: parsedData.checklistItems?.length || 0,
    });

    return parsedData;
  } catch (error) {
    logger.error('[Grok Parser] Error:', error);
    throw new Error(`Grok parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
