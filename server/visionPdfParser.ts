import { invokeLLM } from './_core/llm';
import { logger } from "./_core/logger";
import { storagePut } from './storage';

/**
 * Vision-capable PDF parser that handles both text and scanned/image-based PDFs
 * Uses the LLM's native PDF file handling capability for comprehensive data extraction
 */

interface VisionParsedData {
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
  
  // Vessel Information (comprehensive)
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
  
  // Executive Summary
  executiveSummary?: string;
  
  // Inspection Results (Section 3.0)
  inspectionResults?: string;
  
  // Recommendations (Section 4.0)
  recommendations?: string;
  
  // Thickness Measurements
  thicknessMeasurements?: Array<{
    cmlNumber?: string;
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
 * Parse a PDF using vision LLM to extract comprehensive inspection data
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
    
    // Comprehensive extraction prompt matching Manus parser capabilities
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
   - Product/service (e.g., METHYLCHLORIDE, TRIETHYLAMINE, etc.)
   - Corrosion allowance (inches)
   - Inside diameter (inches), overall length (inches)
   - Material specification (e.g., SA-516 Grade 70, SA-612, SA-240)
   - Head type (2:1 Ellipsoidal, Hemispherical, Torispherical, Flanged & Dished)
   - Insulation type

3. ASME CALCULATION PARAMETERS - VERY IMPORTANT:
   - Look in the MINIMUM THICKNESS CALCULATION section or TABLE A
   - S (Allowable Stress) - typically 17500, 20000, etc. psi
   - E (Joint Efficiency) - typically 0.85 or 1.0
   - Radiography type (RT-1, RT-2, RT-3, RT-4)
   - Specific gravity of contents
   - For torispherical heads: Crown radius (L) and Knuckle radius (r)

4. HEADS - Most vessels have TWO heads:
   - Look for North Head / South Head OR East Head / West Head
   - Map: North Head → East Head, South Head → West Head
   - Extract thickness readings for BOTH heads separately

5. THICKNESS MEASUREMENTS (TML Readings):
   - Extract ALL CML/TML readings from ALL pages of thickness tables
   - COMPONENT TYPE ORGANIZATION - The 'component' field MUST be one of:
     * "Shell" for cylindrical shell readings
     * "East Head" for north/left/head1 readings
     * "West Head" for south/right/head2 readings
     * "Nozzle" for nozzle readings (include nozzle name in location)
   - Include: CML number, location, component (Shell/East Head/West Head/Nozzle)
   - Include: nominal thickness, previous thickness, current thickness
   - Include: minimum required thickness, calculated MAWP
   - For multi-angle readings (0°, 90°, 180°, 270°), use tml1, tml2, tml3, tml4

6. NOZZLES:
   - Extract ALL nozzle data from nozzle schedule or evaluation tables
   - Include: nozzle number (N1, N2, MW-1, etc.)
   - Include: service/description (Manway, Relief, Inlet, Outlet, Drain, Vent)
   - PARSE SIZE from descriptions: "24\" Manway" → size: "24\"", service: "Manway"
   - Common size patterns: 24\", 18\", 12\", 8\", 6\", 4\", 3\", 2\", 1\", 3/4\"
   - Include: size (e.g., 24\" NPS, 2\" NPS), schedule (STD, 40, 80, XS)
   - Include: actual thickness, nominal thickness, minimum required
   - Include: acceptable status (true/false)

7. INSPECTION CHECKLIST:
   - Extract inspection checklist items with category, description, status
   - Status should be: Satisfactory, Unsatisfactory, N/A, Pass, Fail

8. EXECUTIVE SUMMARY, INSPECTION RESULTS, RECOMMENDATIONS:
   - Extract the executive summary text
   - Extract Section 3.0 Inspection Results (findings, observations)
   - Extract Section 4.0 Recommendations (repairs, next inspection, etc.)

Return the data in this JSON structure:

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
  "vesselInfo": {
    "vesselTag": "string",
    "vesselDescription": "string",
    "manufacturer": "string",
    "serialNumber": "string",
    "yearBuilt": "string",
    "nbNumber": "string",
    "constructionCode": "string",
    "vesselType": "string",
    "vesselConfiguration": "string",
    "designPressure": "string",
    "designTemperature": "string",
    "operatingPressure": "string",
    "operatingTemperature": "string",
    "mdmt": "string",
    "product": "string",
    "corrosionAllowance": "string",
    "insideDiameter": "string",
    "overallLength": "string",
    "materialSpec": "string",
    "headType": "string",
    "insulationType": "string",
    "allowableStress": "string",
    "jointEfficiency": "string",
    "radiographyType": "string",
    "specificGravity": "string",
    "crownRadius": "string",
    "knuckleRadius": "string"
  },
  "executiveSummary": "string",
  "inspectionResults": "string",
  "recommendations": "string",
  "thicknessMeasurements": [
    {
      "cmlNumber": "string",
      "location": "string",
      "component": "string (Shell/East Head/West Head/Nozzle)",
      "componentType": "string (shell/head/nozzle)",
      "readingType": "string (spot/seam/nozzle/general)",
      "nozzleSize": "string",
      "angle": "string",
      "nominalThickness": 0.750,
      "previousThickness": 0.689,
      "currentThickness": 0.652,
      "minimumRequired": 0.500,
      "calculatedMAWP": 250.0,
      "tml1": 0.652,
      "tml2": 0.648,
      "tml3": 0.655,
      "tml4": 0.650
    }
  ],
  "checklistItems": [
    {
      "category": "string",
      "itemNumber": "string",
      "itemText": "string",
      "description": "string",
      "status": "string",
      "notes": "string"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "string",
      "service": "string",
      "description": "string",
      "size": "string",
      "schedule": "string",
      "actualThickness": 0.500,
      "nominalThickness": 0.500,
      "minimumRequired": 0.300,
      "acceptable": true,
      "notes": "string"
    }
  ]
}

IMPORTANT: 
- If a field is not present in the document, omit it from the JSON (do not use null or empty string)
- Return ONLY valid JSON, no additional text, explanations, or markdown code blocks`;

    logger.info('[Vision Parser] Sending PDF to LLM for comprehensive analysis...');
    
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
    
    logger.info('[Vision Parser] Raw LLM response length:', content.length);
    logger.info('[Vision Parser] Raw LLM response preview:', content.substring(0, 500));
    
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
    
    // Parse the JSON response with robust error recovery
    let parsedData: VisionParsedData;
    try {
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError: any) {
      logger.warn('[Vision Parser] Initial JSON parse failed, attempting recovery...', parseError.message);
      
      // Try to repair truncated JSON
      let repairedJson = cleanedContent;
      
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
        logger.info(`[Vision Parser] Truncated JSON at position ${lastValidEnd + 1}`);
      } else {
        // Try to close any open structures
        if (inString) {
          repairedJson += '"';
        }
        while (bracketCount > 0) {
          repairedJson += ']';
          bracketCount--;
        }
        while (braceCount > 0) {
          repairedJson += '}';
          braceCount--;
        }
        logger.info('[Vision Parser] Attempted to close open JSON structures');
      }
      
      try {
        parsedData = JSON.parse(repairedJson);
        logger.info('[Vision Parser] JSON recovery successful');
      } catch (secondError) {
        logger.error('[Vision Parser] JSON recovery failed, returning empty object');
        logger.error('[Vision Parser] Content that failed to parse:', cleanedContent.substring(0, 1000));
        // Return a minimal valid structure
        parsedData = {
          reportInfo: {},
          clientInfo: {},
          vesselInfo: {},
          executiveSummary: '',
          inspectionResults: '',
          recommendations: '',
          thicknessMeasurements: [],
          checklistItems: [],
          nozzles: []
        };
      }
    }
    
    // Log extraction results
    logger.info('[Vision Parser] Successfully extracted data from PDF');
    logger.info('[Vision Parser] Report info:', JSON.stringify(parsedData.reportInfo));
    logger.info('[Vision Parser] Client info:', JSON.stringify(parsedData.clientInfo));
    logger.info('[Vision Parser] Vessel info:', JSON.stringify(parsedData.vesselInfo));
    logger.info('[Vision Parser] TML readings:', parsedData.thicknessMeasurements?.length || 0);
    logger.info('[Vision Parser] Nozzles:', parsedData.nozzles?.length || 0);
    logger.info('[Vision Parser] Checklist items:', parsedData.checklistItems?.length || 0);
    logger.info('[Vision Parser] Has executive summary:', !!parsedData.executiveSummary);
    logger.info('[Vision Parser] Has inspection results:', !!parsedData.inspectionResults);
    logger.info('[Vision Parser] Has recommendations:', !!parsedData.recommendations);
    
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
