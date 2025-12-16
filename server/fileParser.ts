import * as XLSX from "xlsx";
import * as pdf from "pdf-parse";
import { invokeLLM } from "./_core/llm";
import { logger } from "./_core/logger";
import { parseDocument, parseAndStandardizeDocument } from "./docupipe";
import { parseDocupipeStandard, type DocupipeStandardFormat } from "./docupipeStandardParser";
import { parseAndStandardizeWithManus, parseDocumentWithManus } from "./manusParser";
import { ENV } from "./_core/env";

interface ParsedVesselData {
  vesselTagNumber?: string;
  vesselName?: string;
  manufacturer?: string;
  yearBuilt?: number;
  designPressure?: string;
  designTemperature?: string;
  operatingPressure?: string;
  materialSpec?: string;
  vesselType?: string;
  insideDiameter?: string;
  overallLength?: string;
  corrosionAllowance?: string;
  
  // Additional fields from Docupipe standardization
  reportNumber?: string;
  reportDate?: string;
  inspectionDate?: string;
  inspectionType?: string;
  inspectionCompany?: string;
  inspectorName?: string;
  inspectorCert?: string;
  clientName?: string;
  clientLocation?: string;
  product?: string;
  nbNumber?: string;
  constructionCode?: string;
  vesselConfiguration?: string;
  headType?: string;
  insulationType?: string;
  executiveSummary?: string;
  allowableStress?: string;
  jointEfficiency?: string;
  specificGravity?: string;
  crownRadius?: string; // L parameter for torispherical heads
  knuckleRadius?: string; // r parameter for torispherical heads
  inspectionResults?: string; // Section 3.0 Inspection Results from PDF
  recommendations?: string; // Section 4.0 Recommendations from PDF
  
  tmlReadings?: Array<{
    cmlNumber?: string;
    tmlId?: string;
    location?: string;
    component?: string;
    currentThickness?: string | number;
    previousThickness?: string | number;
    nominalThickness?: string | number;
    minimumRequired?: number;
    calculatedMAWP?: number;
  }>;
  
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
  
  nozzles?: Array<{
    nozzleNumber: string;
    nozzleDescription?: string;
    location?: string;
    nominalSize: string;
    schedule?: string;
    actualThickness?: string | number;
    pipeNominalThickness?: string | number;
    minimumRequired?: string | number;
    acceptable?: boolean;
    notes?: string;
  }>;
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

      if (tmlIdCol >= 0 && currentThicknessCol >= 0) {
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[tmlIdCol]) continue;

          const reading: any = {
            tmlId: String(row[tmlIdCol]),
            component: componentCol >= 0 ? String(row[componentCol] || "Shell") : "Shell",
            currentThickness: row[currentThicknessCol]
              ? String(row[currentThicknessCol])
              : undefined,
          };

          if (nominalCol >= 0 && row[nominalCol]) {
            reading.nominalThickness = String(row[nominalCol]);
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
 * Parse PDF file using Docupipe standardized extraction
 */
export async function parsePDFFile(buffer: Buffer, parserType?: "docupipe" | "manus" | "vision"): Promise<ParsedVesselData> {
  // Use provided parser type or fall back to default
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
        yearBuilt: visionData.vesselInfo?.yearBuilt ? parseInt(visionData.vesselInfo.yearBuilt, 10) : undefined,
        designPressure: visionData.vesselInfo?.designPressure || '',
        designTemperature: visionData.vesselInfo?.designTemperature || '',
        corrosionAllowance: visionData.vesselInfo?.corrosionAllowance || '',
        tmlReadings: visionData.thicknessMeasurements || [],
        checklistItems: visionData.checklistItems || [],
      };
    }
    
    // Use basic parsing + LLM extraction (standardization APIs are unreliable)
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
            content:
              "You are an expert at extracting vessel inspection data from API 510 reports. Extract all available information and return it as JSON. Pay special attention to: 1) Thickness measurement tables - extract BOTH current AND previous thickness values, along with CML numbers, TML IDs, and all measurement readings (tml1, tml2, tml3, tml4). 2) Nozzle data - extract nozzle numbers, descriptions, sizes, schedules, and thickness measurements from nozzle tables or sections.",
          },
          {
            role: "user",
            content: `Extract vessel inspection data from this report. CRITICAL: For thickness measurements, look for tables with columns like 'Previous Thickness', 'Last Reading', 'Prior Thickness', 'Previous', etc. Extract these values into the previousThickness field.\n\nReport text:\n\n${fullText.substring(0, 12000)}`,
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
                yearBuilt: { type: "number" },
                designPressure: { type: "string" },
                designTemperature: { type: "string" },
                operatingPressure: { type: "string" },
                materialSpec: { type: "string" },
                vesselType: { type: "string" },
                insideDiameter: { type: "string" },
                overallLength: { type: "string" },
                corrosionAllowance: { type: "string" },
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
                    required: ["location"],
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
                    required: ["nozzleNumber", "nominalSize"],
                    additionalProperties: false,
                  },
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
    logger.info("[PDF Parser] LLM extraction completed");
    
    return extracted;
  } catch (error) {
    logger.error("[PDF Parser] Error:", error);
    throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

