import * as XLSX from "xlsx";
import * as pdf from "pdf-parse";
import { invokeLLM } from "./_core/llm";
import { logger } from "./_core/logger";
import { parseDocument, parseAndStandardizeDocument } from "./docupipe";
import { parseDocupipeStandard, type DocupipeStandardFormat } from "./docupipeStandardParser";
import { parseAndStandardizeWithManus, parseDocumentWithManus } from "./manusParser";
import { ENV } from "./_core/env";

/**
 * Comprehensive interface for parsed vessel data
 * Supports all fields from API 510 inspection reports
 */
export interface ParsedVesselData {
  // Vessel identification
  vesselTagNumber?: string;
  vesselName?: string;
  manufacturer?: string;
  serialNumber?: string;
  yearBuilt?: number;
  nbNumber?: string;
  
  // Design specifications
  designPressure?: string;
  designTemperature?: string;
  operatingPressure?: string;
  operatingTemperature?: string;
  mdmt?: string;
  materialSpec?: string;
  allowableStress?: string;
  jointEfficiency?: string;
  radiographyType?: string;
  specificGravity?: string;
  
  // Vessel geometry
  vesselType?: string;
  vesselConfiguration?: string;
  insideDiameter?: string;
  overallLength?: string;
  headType?: string;
  crownRadius?: string;
  knuckleRadius?: string;
  
  // Service and construction
  product?: string;
  constructionCode?: string;
  insulationType?: string;
  corrosionAllowance?: string;
  
  // Report information
  reportNumber?: string;
  reportDate?: string;
  inspectionDate?: string;
  inspectionType?: string;
  inspectionCompany?: string;
  inspectorName?: string;
  inspectorCert?: string;
  
  // Client information
  clientName?: string;
  clientLocation?: string;
  
  // Report sections
  executiveSummary?: string;
  inspectionResults?: string;
  recommendations?: string;
  
  // Thickness measurement locations
  tmlReadings?: Array<{
    cmlNumber?: string;
    tmlId?: string;
    location?: string;
    component?: string;
    componentType?: string;
    readingType?: string;
    nozzleSize?: string;
    service?: string;
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
  
  // Checklist items
  checklistItems?: Array<{
    category?: string;
    itemNumber?: string;
    itemText?: string;
    description?: string;
    checked?: boolean;
    status?: string;
    notes?: string;
    checkedBy?: string;
    checkedDate?: string;
  }>;
  
  // Nozzle evaluations
  nozzles?: Array<{
    nozzleNumber: string;
    nozzleDescription?: string;
    service?: string;
    location?: string;
    nominalSize: string;
    schedule?: string;
    actualThickness?: string | number;
    pipeNominalThickness?: string | number;
    minimumRequired?: string | number;
    acceptable?: boolean;
    notes?: string;
  }>;
  
  // TABLE A component calculations
  tableA?: {
    description?: string;
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
}

/**
 * Parse Excel file and extract vessel inspection data
 */
export async function parseExcelFile(buffer: Buffer): Promise<ParsedVesselData> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const result: ParsedVesselData = {
      tmlReadings: [],
    };

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Look for vessel identification data in headers
      for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;

        for (let j = 0; j < row.length - 1; j++) {
          const key = String(row[j] || "").toLowerCase();
          const value = String(row[j + 1] || "").trim();

          if (!value) continue;

          // Match vessel identification fields
          if (key.includes("tag") || key.includes("vessel id")) {
            result.vesselTagNumber = value;
          } else if (key.includes("vessel name") || key.includes("equipment")) {
            result.vesselName = value;
          } else if (key.includes("manufacturer") || key.includes("fabricator")) {
            result.manufacturer = value;
          } else if (key.includes("year") && key.includes("built")) {
            result.yearBuilt = parseInt(value);
          } else if (key.includes("design pressure") || key.includes("mawp")) {
            result.designPressure = value;
          } else if (key.includes("design temp")) {
            result.designTemperature = value;
          } else if (key.includes("operating pressure")) {
            result.operatingPressure = value;
          } else if (key.includes("material")) {
            result.materialSpec = value;
          } else if (key.includes("diameter") || key.includes("id")) {
            result.insideDiameter = value;
          } else if (key.includes("length")) {
            result.overallLength = value;
          }
        }
      }

      // Look for TML reading data (usually in tabular format)
      const headers = data[0]?.map((h: any) => String(h || "").toLowerCase()) || [];
      const tmlIdCol = headers.findIndex((h) =>
        h.includes("tml") || h.includes("cml") || h.includes("location")
      );
      const componentCol = headers.findIndex((h) => h.includes("component") || h.includes("area"));
      const currentThicknessCol = headers.findIndex(
        (h) => h.includes("current") || h.includes("actual") || h.includes("measured")
      );
      const nominalCol = headers.findIndex((h) => h.includes("nominal") || h.includes("design"));
      const previousCol = headers.findIndex((h) => h.includes("previous") || h.includes("prior") || h.includes("last"));

      if (tmlIdCol >= 0 && currentThicknessCol >= 0) {
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[tmlIdCol]) continue;

          const reading: any = {
            tmlId: String(row[tmlIdCol]),
            cmlNumber: String(row[tmlIdCol]),
            component: componentCol >= 0 ? String(row[componentCol] || "Shell") : "Shell",
            currentThickness: row[currentThicknessCol]
              ? String(row[currentThicknessCol])
              : undefined,
          };

          if (nominalCol >= 0 && row[nominalCol]) {
            reading.nominalThickness = String(row[nominalCol]);
          }
          
          if (previousCol >= 0 && row[previousCol]) {
            reading.previousThickness = String(row[previousCol]);
          }

          result.tmlReadings?.push(reading);
        }
      }
    }

    return result;
  } catch (error) {
    logger.error("[Excel Parser] Error:", error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Comprehensive extraction prompt for LLM-based PDF parsing
 */
const COMPREHENSIVE_EXTRACTION_PROMPT = `You are an expert at extracting vessel inspection data from API 510 reports.

Extract ALL available information and return it as JSON matching this schema:

{
  "vesselTagNumber": "string - vessel tag/ID number (REQUIRED)",
  "vesselName": "string - vessel description/name",
  "manufacturer": "string - vessel manufacturer",
  "serialNumber": "string - serial number",
  "yearBuilt": "number - year vessel was built",
  "nbNumber": "string - National Board Number",
  "designPressure": "string - design pressure in psig",
  "designTemperature": "string - design temperature in °F",
  "operatingPressure": "string - operating pressure in psig",
  "operatingTemperature": "string - operating temperature in °F",
  "mdmt": "string - Minimum Design Metal Temperature in °F",
  "materialSpec": "string - material specification (e.g., SA-516 Gr 70)",
  "allowableStress": "string - allowable stress in psi",
  "jointEfficiency": "string - joint efficiency factor (E value)",
  "radiographyType": "string - RT-1, RT-2, RT-3, or RT-4",
  "specificGravity": "string - specific gravity",
  "vesselType": "string - type of vessel",
  "vesselConfiguration": "string - Horizontal or Vertical",
  "insideDiameter": "string - inside diameter in inches",
  "overallLength": "string - overall length in inches",
  "headType": "string - head type (2:1 Ellipsoidal, Hemispherical, Torispherical)",
  "crownRadius": "string - L parameter for torispherical heads",
  "knuckleRadius": "string - r parameter for torispherical heads",
  "product": "string - vessel contents/service",
  "constructionCode": "string - construction code (e.g., ASME S8 D1)",
  "insulationType": "string - insulation type",
  "reportNumber": "string - report number",
  "reportDate": "string - report date (YYYY-MM-DD)",
  "inspectionDate": "string - inspection date (YYYY-MM-DD)",
  "inspectionType": "string - Internal, External, On-Stream",
  "inspectorName": "string - inspector name",
  "inspectorCert": "string - inspector certification",
  "clientName": "string - client company name",
  "clientLocation": "string - facility location",
  "executiveSummary": "string - full executive summary text",
  "inspectionResults": "string - Section 3.0 Inspection Results",
  "recommendations": "string - Section 4.0 Recommendations",
  "tmlReadings": [
    {
      "cmlNumber": "string - CML number",
      "location": "string - location description",
      "component": "string - FULL component name (e.g., 'Vessel Shell', '2\" East Head Seam')",
      "componentType": "string - Shell/Head/Nozzle",
      "readingType": "string - nozzle/seam/spot/general",
      "nozzleSize": "string - nozzle size if applicable",
      "angle": "string - angle for multi-angle readings",
      "currentThickness": "string - current thickness in inches",
      "previousThickness": "string - previous thickness in inches",
      "nominalThickness": "string - nominal thickness in inches",
      "minimumRequired": "number - minimum required thickness",
      "tActual": "string - actual thickness",
      "tml1": "string - reading 1",
      "tml2": "string - reading 2",
      "tml3": "string - reading 3",
      "tml4": "string - reading 4"
    }
  ],
  "checklistItems": [
    {
      "category": "string - category (External Visual, Internal Visual, Foundation)",
      "itemNumber": "string - item number",
      "itemText": "string - checklist item description",
      "status": "string - Satisfactory, Unsatisfactory, N/A, Not Checked",
      "notes": "string - notes or comments"
    }
  ],
  "nozzles": [
    {
      "nozzleNumber": "string - nozzle identifier (N1, N2, MW-1)",
      "nozzleDescription": "string - nozzle service description",
      "nominalSize": "string - nozzle size",
      "schedule": "string - pipe schedule",
      "actualThickness": "string - measured thickness",
      "pipeNominalThickness": "string - nominal pipe thickness",
      "minimumRequired": "string - minimum required thickness",
      "acceptable": "boolean - passes evaluation"
    }
  ],
  "tableA": {
    "components": [
      {
        "componentName": "string - component name",
        "nominalThickness": "number",
        "actualThickness": "number",
        "minimumRequiredThickness": "number",
        "designMAWP": "number",
        "calculatedMAWP": "number",
        "corrosionRate": "number",
        "remainingLife": "number"
      }
    ]
  }
}

CRITICAL RULES:
1. Extract EVERYTHING - search the entire document
2. For thickness measurements, extract ALL readings including multi-angle
3. Extract FULL component names exactly as written
4. Joint Efficiency (E value) is CRITICAL - look everywhere
5. Extract ALL checklist items with exact status
6. If a field is not found, omit it (do not use null)`;

/**
 * Parse PDF file using Manus API + LLM extraction
 */
export async function parsePDFFile(buffer: Buffer, parserType?: "docupipe" | "manus" | "vision"): Promise<ParsedVesselData> {
  const selectedParser = parserType || "manus";
  logger.info(`[PDF Parser] Using parser: ${selectedParser}`);
  
  try {
    // If vision parser is requested, use vision-based extraction
    if (selectedParser === "vision") {
      logger.info("[PDF Parser] Using vision LLM parser for scanned documents...");
      const { parseWithVision } = await import('./visionPdfParser');
      const visionData = await parseWithVision(buffer);
      
      // Convert vision data to ParsedVesselData format
      return {
        vesselTagNumber: visionData.vesselInfo?.vesselTag || '',
        vesselName: visionData.vesselInfo?.vesselDescription || '',
        manufacturer: visionData.vesselInfo?.manufacturer || '',
        serialNumber: visionData.vesselInfo?.serialNumber || '',
        yearBuilt: visionData.vesselInfo?.yearBuilt ? parseInt(visionData.vesselInfo.yearBuilt, 10) : undefined,
        designPressure: visionData.vesselInfo?.designPressure || '',
        designTemperature: visionData.vesselInfo?.designTemperature || '',
        operatingPressure: visionData.vesselInfo?.operatingPressure || '',
        operatingTemperature: visionData.vesselInfo?.operatingTemperature || '',
        mdmt: visionData.vesselInfo?.mdmt || '',
        materialSpec: visionData.vesselInfo?.materialSpec || '',
        allowableStress: visionData.vesselInfo?.allowableStress || '',
        jointEfficiency: visionData.vesselInfo?.jointEfficiency || '',
        insideDiameter: visionData.vesselInfo?.insideDiameter || '',
        overallLength: visionData.vesselInfo?.overallLength || '',
        headType: visionData.vesselInfo?.headType || '',
        vesselConfiguration: visionData.vesselInfo?.vesselConfiguration || '',
        constructionCode: visionData.vesselInfo?.constructionCode || '',
        nbNumber: visionData.vesselInfo?.nbNumber || '',
        product: visionData.vesselInfo?.product || '',
        insulationType: visionData.vesselInfo?.insulationType || '',
        corrosionAllowance: visionData.vesselInfo?.corrosionAllowance || '',
        reportNumber: visionData.inspectionInfo?.reportNumber || '',
        reportDate: visionData.inspectionInfo?.reportDate || '',
        inspectionDate: visionData.inspectionInfo?.inspectionDate || '',
        inspectionType: visionData.inspectionInfo?.inspectionType || '',
        inspectorName: visionData.inspectionInfo?.inspectorName || '',
        inspectorCert: visionData.inspectionInfo?.inspectorCertification || '',
        clientName: visionData.inspectionInfo?.clientName || '',
        clientLocation: visionData.inspectionInfo?.clientLocation || '',
        executiveSummary: visionData.executiveSummary || '',
        inspectionResults: visionData.inspectionResults || '',
        recommendations: visionData.recommendations || '',
        tmlReadings: visionData.thicknessMeasurements || [],
        checklistItems: visionData.checklistItems || [],
        nozzles: visionData.nozzles?.map(n => ({
          nozzleNumber: n.nozzleNumber || '',
          nozzleDescription: n.service || '',
          nominalSize: n.size || '',
          schedule: n.schedule || '',
          actualThickness: n.actualThickness,
          pipeNominalThickness: n.nominalThickness,
          minimumRequired: n.minimumRequired,
          acceptable: n.acceptable,
          notes: n.notes,
        })) || [],
        tableA: visionData.tableA,
      };
    }
    
    // Use basic parsing + LLM extraction
    logger.info("[PDF Parser] Using basic parsing + LLM extraction...");
    
    const docResult = selectedParser === "manus" 
      ? await parseDocumentWithManus(buffer, "inspection-report.pdf")
      : await parseDocument(buffer, "inspection-report.pdf");
    
    const fullText = docResult.result.text;
    logger.info(`[PDF Parser] Text extracted (${fullText.length} chars), using LLM for structured extraction...`);

    // Use LLM to extract structured data from text
    const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: COMPREHENSIVE_EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: `Extract vessel inspection data from this API 510 report:\n\n${fullText.substring(0, 60000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vessel_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                vesselTagNumber: { type: "string" },
                vesselName: { type: "string" },
                manufacturer: { type: "string" },
                serialNumber: { type: "string" },
                yearBuilt: { type: "number" },
                nbNumber: { type: "string" },
                designPressure: { type: "string" },
                designTemperature: { type: "string" },
                operatingPressure: { type: "string" },
                operatingTemperature: { type: "string" },
                mdmt: { type: "string" },
                materialSpec: { type: "string" },
                allowableStress: { type: "string" },
                jointEfficiency: { type: "string" },
                radiographyType: { type: "string" },
                specificGravity: { type: "string" },
                vesselType: { type: "string" },
                vesselConfiguration: { type: "string" },
                insideDiameter: { type: "string" },
                overallLength: { type: "string" },
                headType: { type: "string" },
                crownRadius: { type: "string" },
                knuckleRadius: { type: "string" },
                product: { type: "string" },
                constructionCode: { type: "string" },
                insulationType: { type: "string" },
                reportNumber: { type: "string" },
                reportDate: { type: "string" },
                inspectionDate: { type: "string" },
                inspectionType: { type: "string" },
                inspectorName: { type: "string" },
                inspectorCert: { type: "string" },
                clientName: { type: "string" },
                clientLocation: { type: "string" },
                executiveSummary: { type: "string" },
                inspectionResults: { type: "string" },
                recommendations: { type: "string" },
                tmlReadings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cmlNumber: { type: "string" },
                      tmlId: { type: "string" },
                      location: { type: "string" },
                      component: { type: "string" },
                      componentType: { type: "string" },
                      readingType: { type: "string" },
                      nozzleSize: { type: "string" },
                      angle: { type: "string" },
                      currentThickness: { type: "string" },
                      previousThickness: { type: "string" },
                      nominalThickness: { type: "string" },
                      minimumRequired: { type: "number" },
                      tActual: { type: "string" },
                      tml1: { type: "string" },
                      tml2: { type: "string" },
                      tml3: { type: "string" },
                      tml4: { type: "string" },
                    },
                    required: [],
                    additionalProperties: false,
                  },
                },
                checklistItems: {
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
                    required: [],
                    additionalProperties: false,
                  },
                },
                nozzles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nozzleNumber: { type: "string" },
                      nozzleDescription: { type: "string" },
                      location: { type: "string" },
                      nominalSize: { type: "string" },
                      schedule: { type: "string" },
                      actualThickness: { type: "string" },
                      pipeNominalThickness: { type: "string" },
                      minimumRequired: { type: "string" },
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
                        required: [],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              required: ["vesselTagNumber"],
              additionalProperties: false,
            },
          },
        },
    });

    // Validate LLM response
    if (!llmResponse || !llmResponse.choices || llmResponse.choices.length === 0) {
      logger.error("[PDF Parser] Invalid LLM response:", JSON.stringify(llmResponse, null, 2));
      throw new Error("LLM returned empty or invalid response");
    }
    
    const messageContent = llmResponse.choices[0].message.content;
    if (!messageContent) {
      logger.error("[PDF Parser] Empty message content in LLM response");
      throw new Error("LLM returned empty message content");
    }
    
    const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
    const extracted = JSON.parse(contentStr || "{}");
    
    logger.info("[PDF Parser] LLM extraction completed:", {
      vesselTag: extracted.vesselTagNumber,
      tmlReadings: extracted.tmlReadings?.length || 0,
      checklistItems: extracted.checklistItems?.length || 0,
      nozzles: extracted.nozzles?.length || 0,
      tableAComponents: extracted.tableA?.components?.length || 0,
    });
    
    return extracted;
  } catch (error) {
    logger.error("[PDF Parser] Error:", error);
    throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
