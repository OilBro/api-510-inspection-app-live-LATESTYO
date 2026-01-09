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
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    // Extract text from all pages - store per-page text for hybrid parser
    const numPages = pdfDocument.numPages;
    let fullText = '';
    const pages: Array<{ pageNumber: number; text: string }> = [];
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
      
      // Store per-page text for hybrid parser analysis
      pages.push({
        pageNumber: i,
        text: pageText,
      });
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
1. HEADS: Most pressure vessels have TWO heads (one at each end). Look for:
   - North Head / South Head (common naming)
   - East Head / West Head (alternative naming)
   - Head 1 / Head 2 (numbered naming)
   - Left Head / Right Head
   If you see thickness readings for heads, check if there are TWO separate sections or tables for different heads.
   Map North Head → East Head, South Head → West Head in the location field.
   
2. NOZZLES: Look for nozzle schedules, nozzle thickness tables, or nozzle evaluation sections.
   Common nozzles: Manway, Relief Valve, Inlet, Outlet, Drain, Vent, Level Gauge, etc.
   Extract ALL nozzles found in the document.
   
3. CHECKLIST: Look for inspection checklists, examination items, or condition assessments.
   These may be in tables with checkboxes, pass/fail columns, or satisfactory/unsatisfactory status.

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
      "cmlNumber": "string (e.g. CML-1, CML-2, 001, 002)",
      "location": "string (IMPORTANT: Use 'East Head' for North/Left/Head1, 'West Head' for South/Right/Head2, 'Shell' for shell readings)",
      "component": "string (Shell/East Head/West Head/Nozzle - be specific about which head)",
      "readingType": "string (nozzle/seam/spot/general)",
      "nozzleSize": "string (e.g. 24\", 3\", 2\", 1\" - only for nozzles)",
      "angle": "string (e.g. 0°, 90°, 180°, 270° for multi-angle readings)",
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
        content: `Extract vessel inspection data from this API 510 report:\n\n${fullText.substring(0, 50000)}`,
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
                  itemText: { type: "string" },
                  status: { type: "string" },
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
  const extractedData = JSON.parse(contentText || "{}");
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

