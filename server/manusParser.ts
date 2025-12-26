import { ENV } from './_core/env';
import { logger } from "./_core/logger";
import { invokeLLM } from './_core/llm';
import { storagePut } from './storage';

/**
 * Manus API Parser - Uses Manus built-in LLM with PDF file_url for parsing
 * Enhanced with vision capabilities and comprehensive field extraction
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
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    // Extract text from all pages
    const numPages = pdfDocument.numPages;
    let fullText = '';
    const pages: Array<{ pageNumber: number; text: string }> = [];
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
      pages.push({ pageNumber: i, text: pageText });
    }
    
    logger.info("[Manus Parser] Text extraction successful, pages:", numPages, "length:", fullText.length);

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
 * Enhanced extraction prompt for comprehensive API 510 data extraction
 */
const ENHANCED_EXTRACTION_PROMPT = `You are an expert at extracting vessel inspection data from API 510 reports. 
Extract all available information and return it as structured JSON matching this schema:

{
  "reportInfo": {
    "reportNumber": "string - report/inspection number",
    "reportDate": "string - date report was issued (YYYY-MM-DD)",
    "inspectionDate": "string - date inspection was performed (YYYY-MM-DD)",
    "inspectionType": "string - type of inspection (Internal, External, On-Stream, etc.)",
    "inspectionCompany": "string - company performing inspection",
    "inspectorName": "string - inspector's full name",
    "inspectorCert": "string - inspector certification number"
  },
  "clientInfo": {
    "clientName": "string - client/owner company name",
    "clientLocation": "string - facility/plant location",
    "product": "string - product/service in vessel (e.g., METHYLCHLORIDE CLEAN)"
  },
  "vesselData": {
    "vesselTagNumber": "string - vessel tag/ID number",
    "vesselName": "string - vessel description/name",
    "manufacturer": "string - vessel manufacturer",
    "serialNumber": "string - manufacturer serial number",
    "yearBuilt": "number - year vessel was built",
    "nbNumber": "string - National Board Number",
    "constructionCode": "string - construction code (e.g., ASME S8 D1)",
    "vesselType": "string - type of vessel (Pressure Vessel, Storage Tank, etc.)",
    "vesselConfiguration": "string - Horizontal or Vertical",
    "designPressure": "string - design pressure in psig",
    "designTemperature": "string - design temperature in °F",
    "operatingPressure": "string - operating pressure in psig",
    "operatingTemperature": "string - operating temperature in °F",
    "mdmt": "string - Minimum Design Metal Temperature in °F",
    "product": "string - Product/Service (e.g., METHYLCHLORIDE CLEAN)",
    "materialSpec": "string - material specification (e.g., SA-516 Gr 70)",
    "insideDiameter": "string - inside diameter in inches",
    "overallLength": "string - overall length in inches or feet",
    "headType": "string - head type (e.g., 2:1 Ellipsoidal, Hemispherical, Torispherical)",
    "insulationType": "string - insulation type (e.g., None, Fiberglass)",
    "allowableStress": "string - allowable stress at design temperature in psi",
    "jointEfficiency": "string - weld joint efficiency factor (E value, typically 0.85, 1.0)",
    "radiographyType": "string - radiographic examination type (RT-1, RT-2, RT-3, RT-4)",
    "specificGravity": "string - specific gravity of vessel contents",
    "crownRadius": "string - L parameter for torispherical heads in inches",
    "knuckleRadius": "string - r parameter for torispherical heads in inches"
  },
  "executiveSummary": "string - full executive summary text from the report",
  "inspectionResults": "string - Section 3.0 Inspection Results - all findings, observations, and condition assessments",
  "recommendations": "string - Section 4.0 Recommendations - all recommendations for repairs, replacements, next inspection date, or continued service",
  "tmlReadings": [
    {
      "cmlNumber": "string - CML number (e.g., CML-1, CML-2, 1, 2)",
      "location": "string - physical location description (e.g., Shell, East Head, West Head)",
      "component": "string - component name (Shell/Head/Nozzle)",
      "readingType": "string - type of reading (nozzle/seam/spot/general)",
      "nozzleSize": "string - nozzle size if applicable (e.g., 24\", 3\", 2\", 1\")",
      "angle": "string - angle for multi-angle readings (e.g., 0°, 90°, 180°, 270°)",
      "nominalThickness": "number - nominal/design thickness in inches",
      "previousThickness": "number - previous inspection thickness in inches",
      "currentThickness": "number - current measured thickness in inches",
      "minimumRequired": "number - minimum required thickness in inches",
      "calculatedMAWP": "number - calculated MAWP at current thickness"
    }
  ],
  "inspectionChecklist": [
    {
      "category": "string - checklist category (e.g., External Visual, Internal Visual, Foundation)",
      "itemNumber": "string - item number if available",
      "itemText": "string - checklist item description",
      "status": "string - status (Satisfactory, Unsatisfactory, N/A, Not Checked)",
      "notes": "string - any notes or comments",
      "checkedBy": "string - inspector who checked this item",
      "checkedDate": "string - date item was checked"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "string - nozzle identifier (e.g., N1, N2, Manway)",
      "service": "string - nozzle service (e.g., Manway, Relief, Vapor Out, Inlet, Outlet)",
      "size": "string - nozzle size (e.g., 18\" NPS, 2\" NPS)",
      "schedule": "string - pipe schedule (e.g., STD, 40, 80)",
      "actualThickness": "number - measured thickness in inches",
      "nominalThickness": "number - nominal thickness in inches",
      "minimumRequired": "number - minimum required thickness in inches",
      "acceptable": "boolean - whether nozzle passes evaluation",
      "notes": "string - additional notes or observations"
    }
  ],
  "tableA": {
    "description": "Executive Summary TABLE A - Component Calculations (if present)",
    "components": [
      {
        "componentName": "string - component name (e.g., Vessel Shell, East Head, West Head)",
        "nominalThickness": "number - nominal thickness in inches",
        "actualThickness": "number - actual measured thickness in inches",
        "minimumRequiredThickness": "number - minimum required thickness in inches",
        "designMAWP": "number - design MAWP in psi",
        "calculatedMAWP": "number - calculated MAWP in psi",
        "corrosionRate": "number - corrosion rate in inches per year",
        "remainingLife": "number - remaining life in years (or 999 if >20 years)"
      }
    ]
  }
}

CRITICAL EXTRACTION GUIDELINES:
1. Extract ALL available data - search the entire document thoroughly
2. For thickness measurements, extract EVERY reading including all angles (0°, 90°, 180°, 270°)
3. Look for TABLE A or Executive Summary tables with component calculations
4. Extract the FULL component names (e.g., '2" East Head Seam - Head Side', not just 'East Head')
5. For checklist items, extract the complete text and status
6. For nozzles, extract all nozzle data from nozzle evaluation tables
7. Joint Efficiency (E value) is CRITICAL - look in vessel metadata AND in minimum thickness calculation tables
8. If a field is not found, use null rather than guessing
9. Dates should be in YYYY-MM-DD format when possible
10. Numeric values should be numbers, not strings with units`;

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

  // Step 2: Use LLM to extract structured data with enhanced prompt
  logger.info("[Manus Parser] Extracting structured data with LLM...");

  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: ENHANCED_EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: `Extract vessel inspection data from this API 510 report:\n\n${fullText.substring(0, 60000)}`,
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
            inspectionResults: { type: "string" },
            recommendations: { type: "string" },
            tmlReadings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cmlNumber: { type: "string" },
                  location: { type: "string" },
                  component: { type: "string" },
                  readingType: { type: "string" },
                  nozzleSize: { type: "string" },
                  angle: { type: "string" },
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
                  checkedBy: { type: "string" },
                  checkedDate: { type: "string" },
                },
                required: ["itemText", "status"],
                additionalProperties: false,
              },
            },
            nozzles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nozzleNumber: { type: "string" },
                  service: { type: "string" },
                  size: { type: "string" },
                  schedule: { type: "string" },
                  actualThickness: { type: "number" },
                  nominalThickness: { type: "number" },
                  minimumRequired: { type: "number" },
                  acceptable: { type: "boolean" },
                  notes: { type: "string" },
                },
                required: [],
                additionalProperties: false,
              },
            },
            tableA: {
              type: "object",
              properties: {
                description: { type: "string" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      componentName: { type: "string" },
                      nominalThickness: { type: "number" },
                      actualThickness: { type: "number" },
                      minimumRequiredThickness: { type: "number" },
                      designMAWP: { type: "number" },
                      calculatedMAWP: { type: "number" },
                      corrosionRate: { type: "number" },
                      remainingLife: { type: "number" },
                    },
                    required: ["componentName"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["components"],
              additionalProperties: false,
            },
          },
          required: ["reportInfo", "clientInfo", "vesselData", "executiveSummary", "inspectionResults", "recommendations", "tmlReadings", "inspectionChecklist", "nozzles", "tableA"],
          additionalProperties: false,
        },
      },
    },
  });

  const messageContent = llmResponse.choices[0].message.content;
  const contentText = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
  const extractedData = JSON.parse(contentText || "{}");
  logger.info("[Manus Parser] Structured data extracted successfully");
  
  // Log extraction summary
  logger.info("[Manus Parser] Extraction summary:", {
    vesselTag: extractedData.vesselData?.vesselTagNumber,
    tmlReadings: extractedData.tmlReadings?.length || 0,
    checklistItems: extractedData.inspectionChecklist?.length || 0,
    nozzles: extractedData.nozzles?.length || 0,
    tableAComponents: extractedData.tableA?.components?.length || 0,
  });

  return extractedData;
}

/**
 * Parse PDF using vision LLM for scanned documents
 * Converts PDF pages to images and sends to vision LLM
 */
export async function parseWithVisionLLM(
  fileBuffer: Buffer,
  filename: string
): Promise<any> {
  logger.info("[Manus Parser] Starting vision-based PDF parsing...");
  
  try {
    // Import vision parser
    const { parseWithVision } = await import('./visionPdfParser');
    const visionData = await parseWithVision(fileBuffer);
    
    logger.info("[Manus Parser] Vision parsing completed:", {
      vesselInfo: !!visionData.vesselInfo,
      thicknessMeasurements: visionData.thicknessMeasurements?.length || 0,
      checklistItems: visionData.checklistItems?.length || 0,
    });
    
    return visionData;
  } catch (error) {
    logger.error("[Manus Parser] Vision parsing failed:", error);
    throw error;
  }
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

/**
 * Auto-detect parser type based on PDF content
 * Returns "text" for text-based PDFs, "vision" for scanned/image-based PDFs
 */
export async function detectPdfType(fileBuffer: Buffer): Promise<"text" | "vision"> {
  try {
    const parseResult = await parseWithManusAPI(fileBuffer, "detect.pdf");
    const textLength = parseResult.text.trim().length;
    const pageCount = parseResult.metadata?.numPages || 1;
    
    // If average text per page is less than 100 characters, likely scanned
    const avgTextPerPage = textLength / pageCount;
    
    if (avgTextPerPage < 100) {
      logger.info("[Manus Parser] Detected scanned PDF (low text content)");
      return "vision";
    }
    
    logger.info("[Manus Parser] Detected text-based PDF");
    return "text";
  } catch (error) {
    logger.warn("[Manus Parser] PDF type detection failed, defaulting to text");
    return "text";
  }
}

/**
 * Smart parse function that auto-detects and uses appropriate parser
 */
export async function smartParsePDF(
  fileBuffer: Buffer,
  filename: string
): Promise<any> {
  const pdfType = await detectPdfType(fileBuffer);
  
  if (pdfType === "vision") {
    return await parseWithVisionLLM(fileBuffer, filename);
  }
  
  return await parseAndStandardizeWithManus(fileBuffer, filename);
}
