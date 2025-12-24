import { invokeLLM } from './_core/llm';
import { logger } from "./_core/logger";
import { storagePut } from './storage';

/**
 * Vision-capable PDF parser that handles both text and scanned/image-based PDFs
 * Uses the LLM's native PDF file handling capability instead of converting to images
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
    insideDiameter?: string;
    overallLength?: string;
    materialSpec?: string;
    allowableStress?: string;
    jointEfficiency?: string;
    specificGravity?: string;
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
  nozzles?: Array<{
    nozzleNumber?: string;
    description?: string;
    size?: string;
    schedule?: string;
    thickness?: string | number;
  }>;
}

/**
 * Parse a PDF using vision LLM to extract inspection data
 * Uploads PDF to S3 and sends URL directly to LLM
 */
export async function parseWithVision(pdfBuffer: Buffer): Promise<VisionParsedData> {
  try {
    logger.info('[Vision Parser] Starting PDF upload to S3');
    
    // Upload PDF directly to S3
    const timestamp = Date.now();
    const pdfKey = `vision-parser/${timestamp}-inspection.pdf`;
    
    const { url: pdfUrl } = await storagePut(pdfKey, pdfBuffer, 'application/pdf');
    logger.info(`[Vision Parser] PDF uploaded to S3: ${pdfUrl}`);
    
    // Prepare extraction prompt
    const extractionPrompt = `You are an expert at extracting data from API 510 pressure vessel inspection reports.

Analyze this inspection report PDF and extract ALL available data in the following JSON structure:

{
  "vesselInfo": {
    "vesselTag": "vessel tag number or ID",
    "vesselDescription": "vessel description/name",
    "manufacturer": "manufacturer name",
    "serialNumber": "serial number",
    "yearBuilt": "year built",
    "designPressure": "design pressure in psi (number only)",
    "designTemperature": "design temperature in °F (number only)",
    "corrosionAllowance": "corrosion allowance in inches (number only)",
    "insideDiameter": "inside diameter in inches (number only)",
    "overallLength": "overall length in inches (number only)",
    "materialSpec": "material specification (e.g., SA-516 Grade 70)",
    "allowableStress": "allowable stress in psi (number only)",
    "jointEfficiency": "joint efficiency (decimal, e.g., 0.85 or 1.0)",
    "specificGravity": "specific gravity of contents (decimal)"
  },
  "thicknessMeasurements": [
    {
      "cmlNumber": "CML number or location ID",
      "location": "measurement location description",
      "component": "component name (Shell, East Head, West Head, North Head, South Head, Nozzle)",
      "componentType": "component type (shell, head, nozzle)",
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
  "nozzles": [
    {
      "nozzleNumber": "N1",
      "description": "Manway",
      "size": "24 inch",
      "schedule": "40",
      "thickness": 0.500
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
1. Extract PREVIOUS THICKNESS values from any tables - look for columns like "Previous", "Last Reading", "Prior Thickness"
2. Extract ALL TML (Thickness Measurement Location) readings from thickness tables
3. For multi-angle readings (0°, 90°, 180°, 270°), put them in tml1, tml2, tml3, tml4 fields
4. Identify component type: "Shell" for vessel body, "Head" for ends (East/West or North/South)
5. Extract nozzle data including sizes (24", 3", 2", 1") and descriptions (Manway, Relief, Vapor Out, etc.)
6. Look for ASME calculation parameters: S (allowable stress), E (joint efficiency), P (design pressure)
7. If a field is not present in the document, omit it from the JSON
8. Return ONLY valid JSON, no additional text or markdown`;

    logger.info('[Vision Parser] Sending PDF to LLM for analysis...');
    
    // Call LLM with PDF file URL
    const response = await invokeLLM({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: extractionPrompt },
            { 
              type: 'file_url', 
              file_url: { 
                url: pdfUrl,
                mime_type: 'application/pdf' as const
              } 
            }
          ]
        }
      ]
    });
    
    // Check if response is valid
    if (!response || !response.choices || response.choices.length === 0) {
      logger.error('[Vision Parser] Invalid LLM response:', JSON.stringify(response));
      throw new Error('LLM returned empty or invalid response');
    }
    
    const content = response.choices[0].message.content;
    if (typeof content !== 'string') {
      logger.error('[Vision Parser] Content is not a string:', typeof content);
      throw new Error('Unexpected response format from LLM');
    }
    
    logger.info('[Vision Parser] Raw LLM response:', content.substring(0, 500));
    
    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();
    
    // Parse the JSON response
    let parsedData: VisionParsedData;
    try {
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError: any) {
      logger.error('[Vision Parser] JSON parse error:', parseError.message);
      logger.error('[Vision Parser] Content that failed to parse:', cleanedContent.substring(0, 1000));
      throw new Error(`Failed to parse LLM response as JSON: ${parseError.message}`);
    }
    
    logger.info('[Vision Parser] Successfully extracted data from PDF');
    logger.info('[Vision Parser] Vessel info:', JSON.stringify(parsedData.vesselInfo));
    logger.info('[Vision Parser] TML readings:', parsedData.thicknessMeasurements?.length || 0);
    logger.info('[Vision Parser] Nozzles:', parsedData.nozzles?.length || 0);
    logger.info('[Vision Parser] Checklist items:', parsedData.checklistItems?.length || 0);
    
    return parsedData;
    
  } catch (error: any) {
    logger.error('[Vision Parser] Error:', error.message);
    logger.error('[Vision Parser] Stack:', error.stack);
    
    // Provide more specific error messages
    if (error.message.includes('Service Unavailable')) {
      throw new Error('Vision parser service is temporarily unavailable. Please try the Manus AI Parser instead.');
    }
    if (error.message.includes('fetch')) {
      throw new Error('Network error while processing PDF. Please check your connection and try again.');
    }
    
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  }
}
