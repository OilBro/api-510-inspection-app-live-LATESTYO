import { invokeLLM } from './_core/llm';
import { logger } from "./_core/logger";
import { storagePut } from './storage';
import { pdfToPng } from 'pdf-to-png-converter';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Vision-capable PDF parser that handles both text and scanned/image-based PDFs
 * Converts PDF pages to images and sends to vision LLM for analysis
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
    corrosionAllowance?: string;
  };
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
  }>;
  checklistItems?: Array<{
    category?: string;
    itemNumber?: string;
    itemText?: string;
    description?: string;
    status?: string;
  }>;
  photos?: Array<{
    description?: string;
    location?: string;
    url?: string;
  }>;
}

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
    
    // Prepare vision LLM prompt
    const extractionPrompt = `You are an expert at extracting data from API 510 pressure vessel inspection reports.

Analyze these inspection report pages and extract ALL available data in the following JSON structure:

{
  "vesselInfo": {
    "vesselTag": "vessel tag number or ID",
    "vesselDescription": "vessel description",
    "manufacturer": "manufacturer name",
    "serialNumber": "serial number",
    "yearBuilt": "year built",
    "designPressure": "design pressure in psi",
    "designTemperature": "design temperature in °F",
    "corrosionAllowance": "corrosion allowance in inches"
  },
  "thicknessMeasurements": [
    {
      "cmlNumber": "CML number or location ID",
      "location": "measurement location description",
      "component": "component name (e.g., Shell, Head, Nozzle)",
      "componentType": "component type",
      "currentThickness": 0.652,
      "previousThickness": 0.689,
      "nominalThickness": 0.750,
      "minimumRequired": 0.500,
      "tActual": 0.652,
      "tml1": 0.652,
      "tml2": 0.648,
      "tml3": 0.655,
      "tml4": 0.650
    }
  ],
  "checklistItems": [
    {
      "category": "External Visual",
      "itemNumber": "1",
      "itemText": "Check item description",
      "description": "detailed description",
      "status": "Satisfactory"
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. Extract PREVIOUS THICKNESS values from any tables, forms, or text
2. Look for thickness measurement tables with columns like "Previous", "Last Reading", "Prior Thickness", etc.
3. Extract ALL TML (Thickness Measurement Location) readings you can find
4. If a field is not present in the document, omit it from the JSON (do not use null or empty string)
5. Pay special attention to scanned tables and handwritten values
6. Return ONLY valid JSON, no additional text`;

    // Build message content with images
    const messageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }> = [
      { type: 'text', text: extractionPrompt }
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
                  corrosionAllowance: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
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
                    currentThickness: { type: ['string', 'number'] },
                    previousThickness: { type: ['string', 'number'] },
                    nominalThickness: { type: ['string', 'number'] },
                    minimumRequired: { type: 'number' },
                    tActual: { type: ['string', 'number'] },
                    tml1: { type: ['string', 'number'] },
                    tml2: { type: ['string', 'number'] },
                    tml3: { type: ['string', 'number'] },
                    tml4: { type: ['string', 'number'] },
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
