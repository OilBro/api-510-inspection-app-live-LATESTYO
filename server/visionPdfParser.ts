import { invokeLLM } from './_core/llm';
import { logger } from "./_core/logger";
import { storagePut } from './storage';
import { pdfToPng } from 'pdf-to-png-converter';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Vision-capable PDF parser that handles both text and scanned/image-based PDFs
 * Converts PDF pages to images and sends to vision LLM for comprehensive analysis
 */

interface VisionParsedData {
  vesselInfo?: {
    vesselTag?: string;
    vesselDescription?: string;
    manufacturer?: string;
    serialNumber?: string;
    yearBuilt?: string;
    designPressure?: string;
    designTemperature?: string;
    operatingPressure?: string;
    operatingTemperature?: string;
    mdmt?: string;
    corrosionAllowance?: string;
    materialSpec?: string;
    allowableStress?: string;
    jointEfficiency?: string;
    insideDiameter?: string;
    overallLength?: string;
    headType?: string;
    vesselConfiguration?: string;
    constructionCode?: string;
    nbNumber?: string;
    product?: string;
    insulationType?: string;
  };
  inspectionInfo?: {
    inspectionDate?: string;
    reportNumber?: string;
    reportDate?: string;
    inspectorName?: string;
    inspectorCertification?: string;
    inspectionType?: string;
    clientName?: string;
    clientLocation?: string;
  };
  executiveSummary?: string;
  inspectionResults?: string;
  recommendations?: string;
  thicknessMeasurements?: Array<{
    cmlNumber?: string;
    tmlId?: string;
    location?: string;
    component?: string;
    componentType?: string;
    currentThickness?: string | number;
    previousThickness?: string | number;
    nominalThickness?: string | number;
    minimumRequired?: number;
    tActual?: string | number;
    tml1?: string | number;
    tml2?: string | number;
    tml3?: string | number;
    tml4?: string | number;
    angle?: string;
    readingType?: string;
    nozzleSize?: string;
    service?: string;
  }>;
  checklistItems?: Array<{
    category?: string;
    itemNumber?: string;
    itemText?: string;
    description?: string;
    status?: string;
    notes?: string;
    checkedBy?: string;
    checkedDate?: string;
  }>;
  nozzles?: Array<{
    nozzleNumber?: string;
    service?: string;
    size?: string;
    schedule?: string;
    actualThickness?: number;
    nominalThickness?: number;
    minimumRequired?: number;
    acceptable?: boolean;
    notes?: string;
  }>;
  tableA?: {
    components?: Array<{
      componentName?: string;
      nominalThickness?: number;
      actualThickness?: number;
      minimumRequiredThickness?: number;
      designMAWP?: number;
      calculatedMAWP?: number;
      corrosionRate?: number;
      remainingLife?: number;
    }>;
  };
  photos?: Array<{
    description?: string;
    location?: string;
    url?: string;
  }>;
}

/**
 * Comprehensive extraction prompt for vision LLM
 */
const VISION_EXTRACTION_PROMPT = `You are an expert at extracting data from API 510 pressure vessel inspection reports.

Analyze these inspection report pages and extract ALL available data in the following JSON structure:

{
  "vesselInfo": {
    "vesselTag": "vessel tag number or ID",
    "vesselDescription": "vessel description/name",
    "manufacturer": "manufacturer name",
    "serialNumber": "serial number",
    "yearBuilt": "year built",
    "designPressure": "design pressure in psi",
    "designTemperature": "design temperature in °F",
    "operatingPressure": "operating pressure in psi",
    "operatingTemperature": "operating temperature in °F",
    "mdmt": "Minimum Design Metal Temperature in °F",
    "corrosionAllowance": "corrosion allowance in inches",
    "materialSpec": "material specification (e.g., SA-516 Gr 70)",
    "allowableStress": "allowable stress in psi",
    "jointEfficiency": "joint efficiency factor (E value)",
    "insideDiameter": "inside diameter in inches",
    "overallLength": "overall length in inches",
    "headType": "head type (e.g., 2:1 Ellipsoidal)",
    "vesselConfiguration": "Horizontal or Vertical",
    "constructionCode": "construction code (e.g., ASME S8 D1)",
    "nbNumber": "National Board Number",
    "product": "product/service in vessel",
    "insulationType": "insulation type"
  },
  "inspectionInfo": {
    "inspectionDate": "YYYY-MM-DD",
    "reportNumber": "report number",
    "reportDate": "YYYY-MM-DD",
    "inspectorName": "inspector name",
    "inspectorCertification": "certification number",
    "inspectionType": "Internal/External/On-Stream",
    "clientName": "client company name",
    "clientLocation": "facility location"
  },
  "executiveSummary": "full executive summary text",
  "inspectionResults": "Section 3.0 Inspection Results - all findings",
  "recommendations": "Section 4.0 Recommendations - all recommendations",
  "thicknessMeasurements": [
    {
      "cmlNumber": "CML number (e.g., 1, 2, CML-1)",
      "location": "measurement location description",
      "component": "FULL component name (e.g., 'Vessel Shell', '2\" East Head Seam - Head Side')",
      "componentType": "Shell/Head/Nozzle",
      "currentThickness": 0.652,
      "previousThickness": 0.689,
      "nominalThickness": 0.750,
      "minimumRequired": 0.500,
      "tActual": 0.652,
      "tml1": 0.652,
      "tml2": 0.648,
      "tml3": 0.655,
      "tml4": 0.650,
      "angle": "0°/90°/180°/270°",
      "readingType": "nozzle/seam/spot/general",
      "nozzleSize": "24\" (only for nozzles)",
      "service": "nozzle service description"
    }
  ],
  "checklistItems": [
    {
      "category": "External Visual/Internal Visual/Foundation/etc.",
      "itemNumber": "1",
      "itemText": "Check item description",
      "status": "Satisfactory/Unsatisfactory/N/A/Not Checked",
      "notes": "any notes or comments"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "N1/N2/MW-1/etc.",
      "service": "Manway/Relief/Inlet/Outlet/etc.",
      "size": "18\" NPS",
      "schedule": "STD/40/80",
      "actualThickness": 0.500,
      "nominalThickness": 0.562,
      "minimumRequired": 0.375,
      "acceptable": true
    }
  ],
  "tableA": {
    "components": [
      {
        "componentName": "Vessel Shell/East Head/West Head",
        "nominalThickness": 0.750,
        "actualThickness": 0.652,
        "minimumRequiredThickness": 0.500,
        "designMAWP": 150,
        "calculatedMAWP": 180,
        "corrosionRate": 0.002,
        "remainingLife": 76
      }
    ]
  }
}

CRITICAL EXTRACTION RULES:
1. Extract EVERYTHING visible in the document - search all pages thoroughly
2. For thickness measurements: Extract ALL readings including multi-angle measurements (0°, 90°, 180°, 270°)
3. Extract the FULL component names exactly as written (e.g., '2" East Head Seam - Head Side')
4. Look for TABLE A or Executive Summary tables with component calculations
5. Extract ALL checklist items with their exact status
6. Extract ALL nozzle data from nozzle evaluation tables
7. Joint Efficiency (E value) is CRITICAL - look in vessel metadata AND calculation tables
8. For PREVIOUS THICKNESS: Look for columns labeled "Previous", "Last Reading", "Prior", etc.
9. If a field is not found, omit it from JSON (do not use null or empty string)
10. Pay special attention to scanned tables and handwritten values
11. Return ONLY valid JSON, no additional text`;

/**
 * Parse a PDF using vision LLM to extract inspection data
 * Handles scanned PDFs and images within PDFs
 */
export async function parseWithVision(pdfBuffer: Buffer): Promise<VisionParsedData> {
  const tempDir = join(tmpdir(), `pdf-vision-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  const pdfPath = join(tempDir, 'input.pdf');
  writeFileSync(pdfPath, pdfBuffer);
  
  try {
    logger.info('[Vision Parser] Starting PDF to image conversion');
    
    // Convert PDF to PNG images
    const pngPages = await pdfToPng(pdfPath, {
      outputFolder: tempDir,
    });
    
    logger.info(`[Vision Parser] Converted ${pngPages.length} pages to images`);
    
    if (pngPages.length === 0) {
      throw new Error('Failed to convert PDF pages to images');
    }
    
    // Upload images to S3 and collect URLs
    const imageUrls: string[] = [];
    const maxPages = Math.min(pngPages.length, 50); // Process max 50 pages
    
    for (let i = 0; i < maxPages; i++) {
      const page = pngPages[i];
      if (!page.content) {
        logger.warn(`[Vision Parser] Page ${i + 1} has no content, skipping`);
        continue;
      }
      const { url } = await storagePut(
        `vision-parser/${Date.now()}-page-${i + 1}.png`,
        page.content,
        'image/png'
      );
      imageUrls.push(url);
      logger.info(`[Vision Parser] Uploaded page ${i + 1} to S3`);
    }
    
    logger.info(`[Vision Parser] Successfully uploaded ${imageUrls.length} images`);
    
    // Build message content with images
    const messageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }> = [
      { type: 'text', text: VISION_EXTRACTION_PROMPT }
    ];
    
    // Add all page images
    for (const imageUrl of imageUrls) {
      messageContent.push({
        type: 'image_url',
        image_url: { 
          url: imageUrl,
          detail: 'high' as const // Request high detail for better text extraction
        }
      });
    }
    
    logger.info('[Vision Parser] Sending images to LLM for analysis...');
    
    // Call vision LLM with images
    const response = await invokeLLM({
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'inspection_data',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              vesselInfo: {
                type: 'object',
                properties: {
                  vesselTag: { type: 'string' },
                  vesselDescription: { type: 'string' },
                  manufacturer: { type: 'string' },
                  serialNumber: { type: 'string' },
                  yearBuilt: { type: 'string' },
                  designPressure: { type: 'string' },
                  designTemperature: { type: 'string' },
                  operatingPressure: { type: 'string' },
                  operatingTemperature: { type: 'string' },
                  mdmt: { type: 'string' },
                  corrosionAllowance: { type: 'string' },
                  materialSpec: { type: 'string' },
                  allowableStress: { type: 'string' },
                  jointEfficiency: { type: 'string' },
                  insideDiameter: { type: 'string' },
                  overallLength: { type: 'string' },
                  headType: { type: 'string' },
                  vesselConfiguration: { type: 'string' },
                  constructionCode: { type: 'string' },
                  nbNumber: { type: 'string' },
                  product: { type: 'string' },
                  insulationType: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
              inspectionInfo: {
                type: 'object',
                properties: {
                  inspectionDate: { type: 'string' },
                  reportNumber: { type: 'string' },
                  reportDate: { type: 'string' },
                  inspectorName: { type: 'string' },
                  inspectorCertification: { type: 'string' },
                  inspectionType: { type: 'string' },
                  clientName: { type: 'string' },
                  clientLocation: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
              executiveSummary: { type: 'string' },
              inspectionResults: { type: 'string' },
              recommendations: { type: 'string' },
              thicknessMeasurements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    cmlNumber: { type: 'string' },
                    tmlId: { type: 'string' },
                    location: { type: 'string' },
                    component: { type: 'string' },
                    componentType: { type: 'string' },
                    currentThickness: { type: 'number' },
                    previousThickness: { type: 'number' },
                    nominalThickness: { type: 'number' },
                    minimumRequired: { type: 'number' },
                    tActual: { type: 'number' },
                    tml1: { type: 'number' },
                    tml2: { type: 'number' },
                    tml3: { type: 'number' },
                    tml4: { type: 'number' },
                    angle: { type: 'string' },
                    readingType: { type: 'string' },
                    nozzleSize: { type: 'string' },
                    service: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              checklistItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    itemNumber: { type: 'string' },
                    itemText: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string' },
                    notes: { type: 'string' },
                    checkedBy: { type: 'string' },
                    checkedDate: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              nozzles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    nozzleNumber: { type: 'string' },
                    service: { type: 'string' },
                    size: { type: 'string' },
                    schedule: { type: 'string' },
                    actualThickness: { type: 'number' },
                    nominalThickness: { type: 'number' },
                    minimumRequired: { type: 'number' },
                    acceptable: { type: 'boolean' },
                    notes: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              tableA: {
                type: 'object',
                properties: {
                  components: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        componentName: { type: 'string' },
                        nominalThickness: { type: 'number' },
                        actualThickness: { type: 'number' },
                        minimumRequiredThickness: { type: 'number' },
                        designMAWP: { type: 'number' },
                        calculatedMAWP: { type: 'number' },
                        corrosionRate: { type: 'number' },
                        remainingLife: { type: 'number' },
                      },
                      required: [],
                      additionalProperties: false,
                    },
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
    });
    
    // Check if response is valid
    if (!response || !response.choices || response.choices.length === 0) {
      logger.error('[Vision Parser] Invalid LLM response:', response);
      throw new Error('LLM returned empty or invalid response');
    }
    
    const content = response.choices[0].message.content;
    if (typeof content !== 'string') {
      logger.error('[Vision Parser] Content is not a string:', content);
      throw new Error('Unexpected response format from LLM');
    }
    
    const parsedData: VisionParsedData = JSON.parse(content);
    
    logger.info('[Vision Parser] Successfully extracted data from PDF');
    logger.info('[Vision Parser] Vessel info:', parsedData.vesselInfo);
    logger.info('[Vision Parser] TML readings:', parsedData.thicknessMeasurements?.length || 0);
    logger.info('[Vision Parser] Checklist items:', parsedData.checklistItems?.length || 0);
    logger.info('[Vision Parser] Nozzles:', parsedData.nozzles?.length || 0);
    logger.info('[Vision Parser] TABLE A components:', parsedData.tableA?.components?.length || 0);
    
    return parsedData;
    
  } catch (error: any) {
    logger.error('[Vision Parser] Error:', error);
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  } finally {
    // Cleanup temp directory
    try {
      const fs = await import('fs/promises');
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.error('[Vision Parser] Cleanup error:', cleanupError);
    }
  }
}

/**
 * Parse PDF using direct file_url approach (for text-based PDFs)
 * More efficient than converting to images for readable PDFs
 */
export async function parseWithVisionDirect(pdfUrl: string): Promise<VisionParsedData> {
  logger.info('[Vision Parser] Using direct file_url approach');
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: VISION_EXTRACTION_PROMPT,
            },
            {
              type: 'file_url',
              file_url: {
                url: pdfUrl,
                mime_type: 'application/pdf',
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'inspection_data',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              vesselInfo: {
                type: 'object',
                properties: {
                  vesselTag: { type: 'string' },
                  vesselDescription: { type: 'string' },
                  manufacturer: { type: 'string' },
                  serialNumber: { type: 'string' },
                  yearBuilt: { type: 'string' },
                  designPressure: { type: 'string' },
                  designTemperature: { type: 'string' },
                  operatingPressure: { type: 'string' },
                  operatingTemperature: { type: 'string' },
                  mdmt: { type: 'string' },
                  corrosionAllowance: { type: 'string' },
                  materialSpec: { type: 'string' },
                  allowableStress: { type: 'string' },
                  jointEfficiency: { type: 'string' },
                  insideDiameter: { type: 'string' },
                  overallLength: { type: 'string' },
                  headType: { type: 'string' },
                  vesselConfiguration: { type: 'string' },
                  constructionCode: { type: 'string' },
                  nbNumber: { type: 'string' },
                  product: { type: 'string' },
                  insulationType: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
              inspectionInfo: {
                type: 'object',
                properties: {
                  inspectionDate: { type: 'string' },
                  reportNumber: { type: 'string' },
                  reportDate: { type: 'string' },
                  inspectorName: { type: 'string' },
                  inspectorCertification: { type: 'string' },
                  inspectionType: { type: 'string' },
                  clientName: { type: 'string' },
                  clientLocation: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
              executiveSummary: { type: 'string' },
              inspectionResults: { type: 'string' },
              recommendations: { type: 'string' },
              thicknessMeasurements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    cmlNumber: { type: 'string' },
                    tmlId: { type: 'string' },
                    location: { type: 'string' },
                    component: { type: 'string' },
                    componentType: { type: 'string' },
                    currentThickness: { type: 'number' },
                    previousThickness: { type: 'number' },
                    nominalThickness: { type: 'number' },
                    minimumRequired: { type: 'number' },
                    tActual: { type: 'number' },
                    tml1: { type: 'number' },
                    tml2: { type: 'number' },
                    tml3: { type: 'number' },
                    tml4: { type: 'number' },
                    angle: { type: 'string' },
                    readingType: { type: 'string' },
                    nozzleSize: { type: 'string' },
                    service: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              checklistItems: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    itemNumber: { type: 'string' },
                    itemText: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string' },
                    notes: { type: 'string' },
                    checkedBy: { type: 'string' },
                    checkedDate: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              nozzles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    nozzleNumber: { type: 'string' },
                    service: { type: 'string' },
                    size: { type: 'string' },
                    schedule: { type: 'string' },
                    actualThickness: { type: 'number' },
                    nominalThickness: { type: 'number' },
                    minimumRequired: { type: 'number' },
                    acceptable: { type: 'boolean' },
                    notes: { type: 'string' },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              tableA: {
                type: 'object',
                properties: {
                  components: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        componentName: { type: 'string' },
                        nominalThickness: { type: 'number' },
                        actualThickness: { type: 'number' },
                        minimumRequiredThickness: { type: 'number' },
                        designMAWP: { type: 'number' },
                        calculatedMAWP: { type: 'number' },
                        corrosionRate: { type: 'number' },
                        remainingLife: { type: 'number' },
                      },
                      required: [],
                      additionalProperties: false,
                    },
                  },
                },
                required: [],
                additionalProperties: false,
              },
            },
            required: [],
            additionalProperties: false,
          },
        },
      },
    });
    
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error('LLM returned empty or invalid response');
    }
    
    const content = response.choices[0].message.content;
    if (typeof content !== 'string') {
      throw new Error('Unexpected response format from LLM');
    }
    
    const parsedData: VisionParsedData = JSON.parse(content);
    
    logger.info('[Vision Parser Direct] Successfully extracted data');
    logger.info('[Vision Parser Direct] Vessel info:', parsedData.vesselInfo);
    logger.info('[Vision Parser Direct] TML readings:', parsedData.thicknessMeasurements?.length || 0);
    
    return parsedData;
    
  } catch (error: any) {
    logger.error('[Vision Parser Direct] Error:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}
