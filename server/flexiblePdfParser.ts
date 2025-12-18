import { invokeLLM } from "./_core/llm";
import { logger } from "./_core/logger";

/**
 * Flexible PDF Parser
 * 
 * This parser uses a two-stage approach:
 * 1. Extract ALL data from the PDF without assumptions about structure
 * 2. Use AI to intelligently map extracted data to our schema
 */

export interface ExtractedData {
  rawText: string;
  structuredData: Record<string, any>;
  tables: Array<{
    headers: string[];
    rows: string[][];
  }>;
  confidence: number;
}

export interface MappedInspectionData {
  vesselData: {
    vesselTagNumber?: string;
    vesselName?: string;
    manufacturer?: string;
    yearBuilt?: number;
    designPressure?: number;
    designTemperature?: number;
    operatingPressure?: number;
    materialSpec?: string;
    vesselType?: string;
    insideDiameter?: number;
    overallLength?: number;
  };
  inspectionData: {
    inspectionDate?: string;
    inspector?: string;
    reportNumber?: string;
    client?: string;
  };
  thicknessMeasurements: Array<{
    cml?: string;
    cmlNumber?: string;
    component?: string;
    componentType?: string;
    location?: string;
    thickness?: number;
    previousThickness?: number;
    nominalThickness?: number;
    tml1?: number;
    tml2?: number;
    tml3?: number;
    tml4?: number;
    tActual?: number;
    service?: string;
    confidence: number;
  }>;
  findings: Array<{
    section?: string;
    finding?: string;
    severity?: "acceptable" | "monitor" | "critical";
    confidence: number;
  }>;
  unmatchedData: Record<string, any>;
  overallConfidence: number;
}

/**
 * Stage 1: Extract ALL data from PDF without assumptions
 */
export async function extractRawDataFromPDF(pdfUrl: string): Promise<ExtractedData> {
  const extractionPrompt = `You are analyzing an API 510 pressure vessel inspection report PDF.

TASK: Extract ALL data from this document. Do not make assumptions about the structure.

Return a JSON object with:
1. "rawText": All text content from the document
2. "structuredData": Any key-value pairs you can identify (e.g., "Vessel Tag: V-101" → {"vesselTag": "V-101"})
3. "tables": All tables found, with headers and rows
4. "confidence": Your confidence level (0-100) in the extraction quality

Be comprehensive - extract EVERYTHING, even if you're not sure what it means.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: extractionPrompt,
          },
          {
            type: "file_url",
            file_url: {
              url: pdfUrl,
              mime_type: "application/pdf",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM");
  }

  // Parse the JSON response
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const extracted = JSON.parse(contentStr);
  return extracted;
}

/**
 * Stage 2: Intelligently map extracted data to our schema
 */
export async function mapDataToSchema(extracted: ExtractedData): Promise<MappedInspectionData> {
  const mappingPrompt = `You are an expert at mapping inspection report data to a standardized schema.

I have extracted the following data from an API 510 inspection report:

${JSON.stringify(extracted, null, 2)}

TASK: Map this data to the following schema. Use your intelligence to:
1. Identify which extracted fields correspond to which schema fields
2. Handle variations in naming (e.g., "CML #" = "cmlNumber", "Shell Thk" = "thickness")
3. Convert units if needed
4. Provide a confidence score (0-100) for each mapped item
5. Put any data you can't confidently map into "unmatchedData"

Schema to map to:
{
  "vesselData": {
    "vesselTagNumber": "string - vessel ID/tag",
    "vesselName": "string - vessel name/description",
    "manufacturer": "string",
    "yearBuilt": "number",
    "designPressure": "number in psig",
    "designTemperature": "number in °F",
    "operatingPressure": "number in psig",
    "materialSpec": "string - material specification",
    "vesselType": "string - type of vessel",
    "insideDiameter": "number in inches",
    "overallLength": "number in inches"
  },
  "inspectionData": {
    "inspectionDate": "string YYYY-MM-DD",
    "inspector": "string - inspector name",
    "reportNumber": "string - report/inspection number",
    "client": "string - client/company name"
  },
  "thicknessMeasurements": [
    {
      "cml": "string - CML identifier (can be CML#, TML#, Location#, etc.)",
      "cmlNumber": "string - normalized CML number",
      "component": "string - component name (Shell, Head, Nozzle, etc.)",
      "componentType": "string - standardized component type",
      "location": "string - physical location on vessel",
      "thickness": "number - current thickness in inches",
      "previousThickness": "number - previous inspection thickness in inches",
      "nominalThickness": "number - nominal/original thickness in inches",
      "tml1": "number - first reading",
      "tml2": "number - second reading",
      "tml3": "number - third reading",
      "tml4": "number - fourth reading",
      "tActual": "number - actual/minimum thickness",
      "service": "string - service description for nozzles",
      "confidence": "number 0-100"
    }
  ],
  "findings": [
    {
      "section": "string - section of report",
      "finding": "string - finding description",
      "severity": "acceptable|monitor|critical",
      "confidence": "number 0-100"
    }
  ],
  "unmatchedData": "object - any data you couldn't confidently map",
  "overallConfidence": "number 0-100 - your overall confidence in the mapping"
}

IMPORTANT MAPPING RULES:
- For thickness measurements: If you see "CML", "TML", "Location", or similar, map to both "cml" and "cmlNumber"
- Component names: Map variations like "Shell", "Vessel Shell", "Body" → "componentType": "Vessel Shell"
- Location: Look for grid references, clock positions, or physical descriptions
- If multiple thickness readings exist (T1, T2, T3, T4), map to tml1, tml2, tml3, tml4
- Always provide "tActual" as the minimum thickness if available
- CRITICAL: Look for "Previous Thickness", "Last Reading", "Prior Thickness", "Previous", "Prev" columns and map to "previousThickness"
- CRITICAL: Look for "Nominal Thickness", "Original Thickness", "Nom", "Design Thickness" and map to "nominalThickness"
- Confidence: 90-100 = very sure, 70-89 = pretty sure, 50-69 = uncertain, <50 = guessing

Return the mapped data as JSON.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "user",
        content: mappingPrompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from LLM for mapping");
  }

  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const mapped = JSON.parse(contentStr);
  return mapped;
}

/**
 * Complete flexible parsing pipeline
 */
export async function parseInspectionPDF(pdfUrl: string): Promise<MappedInspectionData> {
  logger.info("[Flexible Parser] Stage 1: Extracting raw data from PDF...");
  const extracted = await extractRawDataFromPDF(pdfUrl);
  
  logger.info("[Flexible Parser] Stage 2: Mapping data to schema...");
  const mapped = await mapDataToSchema(extracted);
  
  logger.info(`[Flexible Parser] Complete! Overall confidence: ${mapped.overallConfidence}%`);
  logger.info(`[Flexible Parser] Mapped ${mapped.thicknessMeasurements?.length || 0} thickness measurements`);
  logger.info(`[Flexible Parser] Unmatched data keys: ${Object.keys(mapped.unmatchedData || {}).length}`);
  
  return mapped;
}
