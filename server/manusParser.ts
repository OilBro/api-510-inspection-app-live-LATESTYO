import { ENV } from './_core/env';
import { logger } from "./_core/logger";
import { invokeLLM } from './_core/llm';
import { storagePut } from './storage';

/**
 * Manus API Parser - Uses Manus built-in LLM with PDF file_url for parsing
 * Alternative to Docupipe API with similar functionality
 */

const MANUS_API_KEY = ENV.forgeApiKey;

// Log API key status on module load
if (MANUS_API_KEY) {
  logger.info("[Manus Parser] API key loaded successfully:", MANUS_API_KEY.substring(0, 10) + "...");
} else {
  logger.warn("[Manus Parser] WARNING: API key not found in environment variables");
}

interface ManusParseResponse {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
  metadata?: {
    numPages: number;
    title?: string;
    author?: string;
  };
}

/**
 * Parse PDF using pdf-parse library (independent of Docupipe)
 * Extracts text content from PDF file
 */
export async function parseWithManusAPI(
  fileBuffer: Buffer,
  filename: string
): Promise<ManusParseResponse> {
  logger.info("[Manus Parser] Starting independent PDF text extraction...");
  
  try {
    // Use pdfjs-dist directly for PDF parsing
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Convert Buffer to Uint8Array (required by pdfjs-dist)
    const uint8Array = new Uint8Array(fileBuffer);
    
    // Load PDF document with memory-efficient options
    const loadingTask = pdfjsLib.getDocument({ 
      data: uint8Array,
      // Disable features that consume extra memory
      disableFontFace: true,
      disableRange: true,
      disableStream: true,
    });
    const pdfDocument = await loadingTask.promise;
    
    // Extract text from pages with limits to prevent memory issues
    const numPages = pdfDocument.numPages;
    const MAX_PAGES = 100; // Limit to 100 pages for memory safety
    const pagesToProcess = Math.min(numPages, MAX_PAGES);
    
    if (numPages > MAX_PAGES) {
      logger.warn(`[Manus Parser] PDF has ${numPages} pages, limiting to first ${MAX_PAGES} pages for memory safety`);
    }
    
    let fullText = '';
    const pages: Array<{ pageNumber: number; text: string }> = [];
    const MAX_TEXT_LENGTH = 1000000; // 1MB text limit
    
    for (let i = 1; i <= pagesToProcess; i++) {
      // Check if we've exceeded text limit
      if (fullText.length > MAX_TEXT_LENGTH) {
        logger.warn(`[Manus Parser] Text limit reached at page ${i}, stopping extraction`);
        break;
      }
      
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
        
        // Store per-page text for hybrid parser analysis
        pages.push({
          pageNumber: i,
          text: pageText,
        });
        
        // Clean up page resources
        page.cleanup();
      } catch (pageError) {
        logger.warn(`[Manus Parser] Error extracting page ${i}, skipping:`, pageError);
        continue;
      }
    }
    
    // Clean up document resources
    pdfDocument.cleanup();
    
    logger.info("[Manus Parser] Text extraction successful, pages:", pagesToProcess, "length:", fullText.length);

    return {
      text: fullText,
      pages: pages,
      metadata: {
        numPages: numPages,
      },
    };
  } catch (error) {
    logger.error("[Manus Parser] Failed to parse PDF:", error);
    throw error;
  }
}

/**
 * Parse and standardize PDF using Manus API + LLM extraction
 * Similar to Docupipe's parseAndStandardizeDocument
 */
export async function parseAndStandardizeWithManus(
  fileBuffer: Buffer,
  filename: string
): Promise<any> {
  logger.info("[Manus Parser] Starting parse and standardization workflow...");

  // Step 1: Parse PDF with Manus API
  const parseResult = await parseWithManusAPI(fileBuffer, filename);
  const fullText = parseResult.text;

  logger.info("[Manus Parser] Text extracted, length:", fullText.length);

  // Step 2: Use LLM to extract structured data
  logger.info("[Manus Parser] Extracting structured data with LLM...");

  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert at extracting vessel inspection data from API 510 reports. 
Extract all available information and return it as structured JSON matching this schema.

CRITICAL INSTRUCTIONS:

1. MULTI-PAGE TABLES: Thickness measurement tables often span MULTIPLE PAGES.
   - Continue reading ALL pages of the document from start to finish
   - Look for table continuations ("continued", "cont'd", page breaks in tables)
   - Extract EVERY row from thickness tables, even if they span 5+ pages
   - Do NOT stop at the first page of a table
   - Count the total rows extracted and verify against row numbers if present
   - If you see "CML 001" through "CML 177", you MUST extract ALL 177 rows

8. CIRCUMFERENTIAL SLICE-ANGLE READINGS - CRITICAL: Many UT inspection reports use a GRID FORMAT where:
   - ROWS represent "slices" or locations along the vessel (e.g., "2' from East Head", "4'", "6'", "8'", "10'", "12'", "14'", "16'")
   - COLUMNS represent angular positions around the circumference: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° (8 columns)
   - Each cell contains a thickness reading at that slice+angle combination
   
   **MANDATORY: You MUST create 8 SEPARATE TML readings for EACH ROW in the grid table.**
   For a table with 10 rows and 8 columns, you MUST extract 80 TML readings.
   
   For EACH cell in the grid:
   - legacyLocationId: Use format "SLICE-ANGLE" where SLICE is the row identifier (e.g., "2-0", "2-45", "2-90", "2-135", "2-180", "2-225", "2-270", "2-315" for the 2' slice)
   - location: Include the row description (e.g., "2' from East Head Seam - Shell side")
   - angle: The column header angle (e.g., "0°", "45°", "90°", "135°", "180°", "225°", "270°", "315°")
   - sliceLocation: The distance marker (e.g., "2'", "4'", "6'")
   - component: "Shell" for shell readings
   - currentThickness: The numeric value in that cell
   
   EXAMPLE: For a row labeled "2' from East Head" with readings [0.66, 0.658, 0.66, 0.659, 0.658, 0.659, 0.671, 0.659] across 8 columns:
   You MUST create these 8 TML readings:
   { legacyLocationId: "2-0", location: "2' from East Head Seam", angle: "0°", sliceLocation: "2'", currentThickness: 0.66, component: "Shell" }
   { legacyLocationId: "2-45", location: "2' from East Head Seam", angle: "45°", sliceLocation: "2'", currentThickness: 0.658, component: "Shell" }
   { legacyLocationId: "2-90", location: "2' from East Head Seam", angle: "90°", sliceLocation: "2'", currentThickness: 0.66, component: "Shell" }
   { legacyLocationId: "2-135", location: "2' from East Head Seam", angle: "135°", sliceLocation: "2'", currentThickness: 0.659, component: "Shell" }
   { legacyLocationId: "2-180", location: "2' from East Head Seam", angle: "180°", sliceLocation: "2'", currentThickness: 0.658, component: "Shell" }
   { legacyLocationId: "2-225", location: "2' from East Head Seam", angle: "225°", sliceLocation: "2'", currentThickness: 0.659, component: "Shell" }
   { legacyLocationId: "2-270", location: "2' from East Head Seam", angle: "270°", sliceLocation: "2'", currentThickness: 0.671, component: "Shell" }
   { legacyLocationId: "2-315", location: "2' from East Head Seam", angle: "315°", sliceLocation: "2'", currentThickness: 0.659, component: "Shell" }
   
   DO NOT summarize or combine readings. Extract EVERY SINGLE CELL as a separate TML reading.
   VERIFICATION: Count your extracted readings. If the grid has M rows × 8 columns, you MUST have M × 8 readings.

9. NOZZLE ANGULAR READINGS - CRITICAL: Nozzle readings often have 4 positions: 0°, 90°, 180°, 270°
   **MANDATORY: You MUST create 4 SEPARATE TML readings for EACH NOZZLE.**
   For 12 nozzles with 4 angles each, you MUST extract 48 TML readings.
   
   For EACH nozzle and EACH angle:
   - legacyLocationId: Use format "N1-0", "N1-90", "N1-180", "N1-270" for nozzle N1
   - location: Nozzle description (e.g., "N1 Manway")
   - nozzleSize: Size from table (e.g., "24", "3", "2", "1") - NUMERIC VALUE ONLY
   - minimumRequired: tmin value from table
   - component: "Nozzle"
   - currentThickness: The reading value for that angle
   - readingType: "nozzle"
   
   EXAMPLE: For nozzle "N1 Manway 24" with readings [0.574, 0.576, 0.578, 0.578] at 0°/90°/180°/270° and tmin 0.375:
   { legacyLocationId: "N1-0", location: "N1 Manway", nozzleSize: "24", angle: "0°", currentThickness: 0.574, minimumRequired: 0.375, component: "Nozzle", readingType: "nozzle" }
   { legacyLocationId: "N1-90", location: "N1 Manway", nozzleSize: "24", angle: "90°", currentThickness: 0.576, minimumRequired: 0.375, component: "Nozzle", readingType: "nozzle" }
   { legacyLocationId: "N1-180", location: "N1 Manway", nozzleSize: "24", angle: "180°", currentThickness: 0.578, minimumRequired: 0.375, component: "Nozzle", readingType: "nozzle" }
   { legacyLocationId: "N1-270", location: "N1 Manway", nozzleSize: "24", angle: "270°", currentThickness: 0.578, minimumRequired: 0.375, component: "Nozzle", readingType: "nozzle" }
   
   VERIFICATION: Count your nozzle readings. If there are N nozzles with 4 angles each, you MUST have N × 4 nozzle readings.

2. PREVIOUS THICKNESS DATA - CRITICAL FOR CORROSION RATE CALCULATIONS:
   - Search for "Previous Thickness", "Prior Thickness", "t_prev", "Last Inspection", "Baseline" columns
   - Previous thickness may be in a separate column or in historical data tables
   - Look for comparison tables showing "Current vs Previous" or "2025 vs 2017" data
   - Extract ALL previous thickness values - these are ESSENTIAL for corrosion rate calculations
   - If no previous data exists, only then set to null (NOT zero)
   - Zero thickness values (0.000") are INVALID - use null instead

3. HEADS: Most pressure vessels have TWO heads (one at each end). Look for:
   - North Head / South Head (common naming)
   - East Head / West Head (alternative naming)
   - Head 1 / Head 2 (numbered naming)
   - Left Head / Right Head
   If you see thickness readings for heads, check if there are TWO separate sections or tables for different heads.
   Map North Head → East Head, South Head → West Head in the location field.

3. COMPONENT TYPE ORGANIZATION: Categorize each TML reading by component:
   - "Shell" for cylindrical shell readings
   - "East Head" for north/left/head1 readings
   - "West Head" for south/right/head2 readings  
   - "Nozzle" for nozzle readings (include nozzle name in location)
   The 'component' field MUST be one of: Shell, East Head, West Head, Nozzle
   
4. NOZZLES: Look for nozzle schedules, nozzle thickness tables, or nozzle evaluation sections.
   Common nozzles: Manway, Relief Valve, Inlet, Outlet, Drain, Vent, Level Gauge, etc.
   Extract ALL nozzles found in the document.
   IMPORTANT: Parse nozzle SIZE from descriptions using these patterns:
   - "24\" Manway" → nozzleSize: "24\"" or "24", service: "Manway"
   - "3\" Relief" → nozzleSize: "3\"" or "3", service: "Relief"
   - "2\" Inlet" → nozzleSize: "2\"" or "2", service: "Inlet"
   - "1\" Drain" → nozzleSize: "1\"" or "1", service: "Drain"
   - "N1 Manway 24" → nozzleSize: "24", nozzleNumber: "N1", service: "Manway"
   Common size patterns: 24, 18, 12, 8, 6, 4, 3, 2, 1, 0.75, 3/4
   ALWAYS extract the numeric size value separately from the service type
   
5. CHECKLIST: Look for inspection checklists, examination items, or condition assessments.
   These may be in tables with checkboxes, pass/fail columns, or satisfactory/unsatisfactory status.
   Extract the FULL text of each checklist item - do NOT truncate or abbreviate

6. INSPECTION RESULTS (Section 3.0): Extract ALL findings from the inspection results section.
   Include: foundation condition, shell condition, head condition, appurtenances, corrosion findings, etc.
   This is typically a narrative section describing what was found during inspection.
   Extract the COMPLETE text, preserving all details

7. RECOMMENDATIONS (Section 4.0): Extract ALL recommendations from the recommendations section.
   Include: repair recommendations, replacement needs, next inspection date, continued service approval, etc.
   This is typically a narrative section with action items and future planning.
   Extract the COMPLETE text, preserving all details

{
  "reportInfo": {
    "reportNumber": "string",
    "reportDate": "string",
    "inspectionDate": "string",
    "inspectionType": "string",
    "inspectionCompany": "string",
    "inspectorName": "string",
    "inspectorCert": "string"
  },
  "clientInfo": {
    "clientName": "string",
    "clientLocation": "string",
    "product": "string"
  },
  "vesselData": {
    "vesselTagNumber": "string",
    "vesselName": "string",
    "manufacturer": "string",
    "serialNumber": "string",
    "yearBuilt": "number",
    "nbNumber": "string",
    "constructionCode": "string",
    "vesselType": "string",
    "vesselConfiguration": "string (Horizontal/Vertical)",
    "designPressure": "string",
    "designTemperature": "string",
    "operatingPressure": "string",
    "operatingTemperature": "string",
    "mdmt": "string (Minimum Design Metal Temperature)",
    "product": "string (Product/Service e.g. METHYLCHLORIDE CLEAN)",
    "materialSpec": "string",
    "insideDiameter": "string",
    "overallLength": "string",
    "headType": "string (e.g. 2:1 Ellipsoidal, Hemispherical, Torispherical)",
    "insulationType": "string",
    "allowableStress": "string (S value - IMPORTANT: Look in the MINIMUM THICKNESS CALCULATION section for the actual S value used in calculations, NOT the nameplate value. The calculation table shows S in psi, typically 17500, 20000, etc.)",
    "jointEfficiency": "string (E value - IMPORTANT: Look in the MINIMUM THICKNESS CALCULATION section for the actual E value used in calculations, NOT the nameplate value. The calculation table shows E as a decimal like 0.85, 1.0, etc. If the table shows E=1.0, use 1.0 not 0.85)",
    "radiographyType": "string (RT-1, RT-2, RT-3, or RT-4)",
    "specificGravity": "string",
    "crownRadius": "string (L parameter for torispherical heads, in inches)",
    "knuckleRadius": "string (r parameter for torispherical heads, in inches)"
  },
  "executiveSummary": "string",
  "tmlReadings": [
    {
      "legacyLocationId": "string (e.g. CML-1, CML-2, 001, 002)",
      "location": "string (IMPORTANT: Use 'East Head' for North/Left/Head1, 'West Head' for South/Right/Head2, 'Shell' for shell readings)",
      "component": "string (Shell/East Head/West Head/Nozzle - be specific about which head)",
      "readingType": "string (nozzle/seam/spot/general)",
      "nozzleSize": "string (e.g. 24\", 3\", 2\", 1\" - only for nozzles)",
      "angle": "string (e.g. 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° for circumferential readings)",
      "sliceLocation": "string (e.g. 2', 4', 6' - distance from head seam for shell slice readings)",
      "nominalThickness": "number",
      "previousThickness": "number",
      "currentThickness": "number",
      "minimumRequired": "number",
      "calculatedMAWP": "number"
    }
  ],
  "inspectionChecklist": [
    {
      "category": "string (e.g. External Examination, Internal Examination, Pressure Test)",
      "itemText": "string (the inspection item description)",
      "status": "string (Satisfactory/Unsatisfactory/N/A/Pass/Fail)",
      "notes": "string (any comments or observations)"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "string (e.g. N1, N2, Manway, MW-1)",
      "service": "string (e.g. Manway, Relief, Vapor Out, Inlet, Outlet, Drain)",
      "size": "string (e.g. 18\" NPS, 2\" NPS)",
      "schedule": "string (e.g. STD, 40, 80, XS)",
      "actualThickness": "number",
      "nominalThickness": "number",
      "minimumRequired": "number",
      "acceptable": "boolean",
      "notes": "string"
    }
  ]
}`
      },
      {
        role: "user",
        content: (() => {
          // Character limit calculation:
          // - OpenAI GPT-4 Turbo max context: ~128K tokens (~500K chars with avg 4 chars/token)
          // - Using gpt-4-turbo-preview or newer models with extended context windows
          // - Safe limit for prompt + response: 200K chars input + 100K chars response = 300K total
          // - This allows processing ~50 page PDFs with detailed tables
          const MAX_CHARS = 200000; // Increased from 120000 to handle larger documents
          const textToSend = fullText.substring(0, MAX_CHARS);
          if (fullText.length > MAX_CHARS) {
            logger.warn(`[Manus Parser] Text truncated from ${fullText.length} to ${MAX_CHARS} chars for LLM processing`);
            logger.info(`[Manus Parser] IMPORTANT: Multi-page tables may be incomplete if document exceeds ${MAX_CHARS} chars`);
          }
          return `Extract vessel inspection data from this API 510 report:\n\n${textToSend}`;
        })(),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "api510_inspection_data",
        strict: true,
        schema: {
          type: "object",
          properties: {
            reportInfo: {
              type: "object",
              properties: {
                reportNumber: { type: "string" },
                reportDate: { type: "string" },
                inspectionDate: { type: "string" },
                inspectionType: { type: "string" },
                inspectionCompany: { type: "string" },
                inspectorName: { type: "string" },
                inspectorCert: { type: "string" },
              },
              required: [],
              additionalProperties: false,
            },
            clientInfo: {
              type: "object",
              properties: {
                clientName: { type: "string" },
                clientLocation: { type: "string" },
                product: { type: "string" },
              },
              required: [],
              additionalProperties: false,
            },
            vesselData: {
              type: "object",
              properties: {
                vesselTagNumber: { type: "string" },
                vesselName: { type: "string" },
                manufacturer: { type: "string" },
                serialNumber: { type: "string" },
                yearBuilt: { type: "number" },
                nbNumber: { type: "string" },
                constructionCode: { type: "string" },
                vesselType: { type: "string" },
                vesselConfiguration: { type: "string" },
                designPressure: { type: "string" },
                designTemperature: { type: "string" },
                operatingPressure: { type: "string" },
                operatingTemperature: { type: "string" },
                mdmt: { type: "string" },
                product: { type: "string" },
                materialSpec: { type: "string" },
                insideDiameter: { type: "string" },
                overallLength: { type: "string" },
                headType: { type: "string" },
                insulationType: { type: "string" },
                allowableStress: { type: "string" },
                jointEfficiency: { type: "string" },
                radiographyType: { type: "string" },
                specificGravity: { type: "string" },
                crownRadius: { type: "string" },
                knuckleRadius: { type: "string" },
              },
              required: [],
              additionalProperties: false,
            },
            executiveSummary: { type: "string" },
            inspectionResults: { type: "string", description: "Section 3.0 Inspection Results - all findings, observations, and condition assessments" },
            recommendations: { type: "string", description: "Section 4.0 Recommendations - all recommendations for repairs, replacements, next inspection date, or continued service" },
            tmlReadings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  legacyLocationId: { type: "string" },
                  location: { type: "string" },
                  component: { type: "string" },
                  readingType: { type: "string" },
                  nozzleSize: { type: "string" },
                  angle: { type: "string" },
                  sliceLocation: { type: "string" },
                  nominalThickness: { type: "number" },
                  previousThickness: { type: "number" },
                  currentThickness: { type: "number" },
                  minimumRequired: { type: "number" },
                  calculatedMAWP: { type: "number" },
                },
                required: [],
                additionalProperties: false,
              },
            },
            inspectionChecklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  itemNumber: { type: "string" },
                  itemText: { type: "string" },
                  status: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["itemText", "status"],
                additionalProperties: false,
              },
            },
            nozzles: {
              type: "array",
              description: "Nozzle evaluation data from PDF",
              items: {
                type: "object",
                properties: {
                  nozzleNumber: { type: "string", description: "Nozzle identifier (e.g., N1, N2, Manway)" },
                  service: { type: "string", description: "Nozzle service (e.g., Manway, Relief, Vapor Out)" },
                  size: { type: "string", description: "Nozzle size (e.g., 18\" NPS, 2\" NPS)" },
                  schedule: { type: "string", description: "Pipe schedule (e.g., STD, 40, 80)" },
                  actualThickness: { type: "number", description: "Measured thickness in inches" },
                  nominalThickness: { type: "number", description: "Nominal thickness in inches" },
                  minimumRequired: { type: "number", description: "Minimum required thickness in inches" },
                  acceptable: { type: "boolean", description: "Whether nozzle passes evaluation" },
                  notes: { type: "string", description: "Additional notes or observations" },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
          required: ["reportInfo", "clientInfo", "vesselData", "executiveSummary", "inspectionResults", "recommendations", "tmlReadings", "inspectionChecklist", "nozzles"],
          additionalProperties: false,
        },
      },
    },
  });

  const messageContent = llmResponse.choices[0].message.content;
  const contentText = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
  
  // Robust JSON parsing with truncation recovery
  let extractedData;
  try {
    extractedData = JSON.parse(contentText || "{}");
  } catch (parseError) {
    logger.warn("[Manus Parser] Initial JSON parse failed, attempting recovery...", parseError);
    
    // Try to repair truncated JSON
    let repairedJson = contentText || "{}";
    
    // Remove any trailing incomplete content after last complete structure
    // Find the last valid closing bracket/brace
    let lastValidEnd = -1;
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < repairedJson.length; i++) {
      const char = repairedJson[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && bracketCount === 0) {
            lastValidEnd = i;
          }
        }
        else if (char === '[') bracketCount++;
        else if (char === ']') {
          bracketCount--;
          if (braceCount === 0 && bracketCount === 0) {
            lastValidEnd = i;
          }
        }
      }
    }
    
    // If we found a valid end point, truncate there
    if (lastValidEnd > 0 && lastValidEnd < repairedJson.length - 1) {
      repairedJson = repairedJson.substring(0, lastValidEnd + 1);
      logger.info(`[Manus Parser] Truncated JSON at position ${lastValidEnd + 1}`);
    } else {
      // Try to close any open structures
      // Close any unclosed strings first
      if (inString) {
        repairedJson += '"';
      }
      // Close brackets and braces
      while (bracketCount > 0) {
        repairedJson += ']';
        bracketCount--;
      }
      while (braceCount > 0) {
        repairedJson += '}';
        braceCount--;
      }
      logger.info("[Manus Parser] Attempted to close open JSON structures");
    }
    
    // Use jsonrepair library as final fallback for structural repair
    try {
      const { jsonrepair } = await import('jsonrepair');
      repairedJson = jsonrepair(repairedJson);
      logger.info("[Manus Parser] jsonrepair applied successfully");
    } catch (repairErr) {
      logger.warn("[Manus Parser] jsonrepair also failed, will use brace-counter result");
    }
    
    try {
      extractedData = JSON.parse(repairedJson);
      logger.info("[Manus Parser] JSON recovery successful");
    } catch (secondError) {
      logger.error("[Manus Parser] JSON recovery failed, returning empty object");
      // Return a minimal valid structure
      extractedData = {
        reportInfo: {},
        clientInfo: {},
        vesselData: {},
        executiveSummary: "",
        inspectionResults: "",
        recommendations: "",
        tmlReadings: [],
        inspectionChecklist: [],
        nozzles: []
      };
    }
  }
  
  // Log extraction metrics for quality assurance
  logger.info("[Manus Parser] Extraction metrics:", {
    tmlReadings: extractedData.tmlReadings?.length || 0,
    nozzles: extractedData.nozzles?.length || 0,
    checklistItems: extractedData.inspectionChecklist?.length || 0,
    hasVesselData: !!(extractedData.vesselData && Object.keys(extractedData.vesselData).length > 0),
    hasInspectionResults: !!(extractedData.inspectionResults && extractedData.inspectionResults.length > 10),
    hasRecommendations: !!(extractedData.recommendations && extractedData.recommendations.length > 10),
  });
  
  // Validate critical data extraction
  if (extractedData.tmlReadings && extractedData.tmlReadings.length > 0) {
    const withPreviousThickness = extractedData.tmlReadings.filter((t: any) => 
      t.previousThickness !== null && t.previousThickness !== undefined && t.previousThickness !== 0
    ).length;
    const withNozzleSize = extractedData.tmlReadings.filter((t: any) => 
      t.component === 'Nozzle' && t.nozzleSize
    ).length;
    const nozzleReadings = extractedData.tmlReadings.filter((t: any) => t.component === 'Nozzle').length;
    
    logger.info("[Manus Parser] TML data quality:", {
      totalReadings: extractedData.tmlReadings.length,
      withPreviousThickness: withPreviousThickness,
      nozzleReadings: nozzleReadings,
      nozzleReadingsWithSize: withNozzleSize,
      previousThicknessPercentage: `${((withPreviousThickness / extractedData.tmlReadings.length) * 100).toFixed(1)}%`,
    });
    
    if (withPreviousThickness === 0 && extractedData.tmlReadings.length > 0) {
      logger.warn("[Manus Parser] WARNING: No previous thickness data extracted - corrosion rate calculations will be affected");
    }
  }
  
  logger.info("[Manus Parser] Structured data extracted successfully");

  return extractedData;
}

/**
 * Simple text extraction fallback
 * Just returns the raw text without standardization
 */
export async function parseDocumentWithManus(
  fileBuffer: Buffer,
  filename: string
): Promise<{ result: { text: string; pages: any[] } }> {
  logger.info("[Manus Parser] Simple text extraction...");
  
  const parseResult = await parseWithManusAPI(fileBuffer, filename);
  
  return {
    result: {
      text: parseResult.text,
      pages: parseResult.pages || [],
    },
  };
}

