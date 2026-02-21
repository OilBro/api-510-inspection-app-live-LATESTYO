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
    legacyLocationId?: string;
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
      nozzles: [],
    };

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheetNameLower = sheetName.toLowerCase();
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Skip instruction sheets
      if (sheetNameLower.includes('instruction') || sheetNameLower.includes('readme')) {
        continue;
      }

      // Parse Vessel Information sheet (Field/Value format)
      if (sheetNameLower.includes('vessel') || sheetNameLower.includes('equipment')) {
        parseFieldValueSheet(data, result);
      }
      
      // Parse Inspection Details sheet (Field/Value format)
      if (sheetNameLower.includes('inspection') && sheetNameLower.includes('detail')) {
        parseInspectionDetailsSheet(data, result);
      }
      
      // Parse TML Readings sheet (tabular format)
      if (sheetNameLower.includes('tml') || sheetNameLower.includes('thickness') || sheetNameLower.includes('reading')) {
        parseTmlReadingsSheet(data, result);
      }
      
      // Parse Nozzles sheet (tabular format)
      if (sheetNameLower.includes('nozzle')) {
        parseNozzlesSheet(data, result);
      }
    }

    return result;
  } catch (error) {
    logger.error("[Excel Parser] Error:", error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Parse Field/Value format sheets (Vessel Information, Inspection Details)
 */
function parseFieldValueSheet(data: any[][], result: ParsedVesselData): void {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const key = String(row[0] || "").toLowerCase().trim();
    const value = row[1];
    
    if (value === undefined || value === null || value === '') continue;
    const valueStr = String(value).trim();

    // Vessel identification
    if (key.includes("tag") && key.includes("number")) result.vesselTagNumber = valueStr;
    else if (key === "vessel name" || key.includes("vessel name")) result.vesselName = valueStr;
    else if (key.includes("manufacturer") || key.includes("fabricator")) result.manufacturer = valueStr;
    else if (key.includes("serial") && key.includes("number")) result.serialNumber = valueStr;
    else if (key.includes("year") && key.includes("built")) result.yearBuilt = typeof value === 'number' ? value : parseInt(valueStr);
    else if (key.includes("nb number") || key.includes("national board")) result.nbNumber = valueStr;
    
    // Design specifications
    else if (key.includes("design pressure")) result.designPressure = valueStr;
    else if (key.includes("design temp")) result.designTemperature = valueStr;
    else if (key.includes("operating pressure")) result.operatingPressure = valueStr;
    else if (key.includes("operating temp")) result.operatingTemperature = valueStr;
    else if (key.includes("material") && key.includes("spec")) result.materialSpec = valueStr;
    else if (key.includes("joint") && key.includes("efficiency")) result.jointEfficiency = valueStr;
    else if (key.includes("inside") && key.includes("diameter")) result.insideDiameter = valueStr;
    else if (key.includes("overall") && key.includes("length")) result.overallLength = valueStr;
    else if (key.includes("head") && key.includes("type")) result.headType = valueStr;
    else if (key.includes("construction") && key.includes("code")) result.constructionCode = valueStr;
  }
}

/**
 * Parse Inspection Details sheet
 */
function parseInspectionDetailsSheet(data: any[][], result: ParsedVesselData): void {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const key = String(row[0] || "").toLowerCase().trim();
    const value = row[1];
    
    if (value === undefined || value === null || value === '') continue;
    const valueStr = String(value).trim();

    // Report information
    if (key === "report number" || key.includes("report number")) result.reportNumber = valueStr;
    else if (key === "report date" || key.includes("report date")) result.reportDate = valueStr;
    else if (key === "inspection date" || key.includes("inspection date")) result.inspectionDate = valueStr;
    else if (key === "inspection type" || key.includes("inspection type")) result.inspectionType = valueStr;
    else if (key.includes("inspection company") || key.includes("company")) result.inspectionCompany = valueStr;
    else if (key === "inspector name" || key.includes("inspector name")) result.inspectorName = valueStr;
    else if (key.includes("inspector") && key.includes("cert")) result.inspectorCert = valueStr;
    else if (key === "client name" || key.includes("client name")) result.clientName = valueStr;
    else if (key === "client location" || key.includes("client location")) result.clientLocation = valueStr;
    else if (key === "executive summary" || key.includes("executive summary")) result.executiveSummary = valueStr;
    else if (key === "recommendations" || key.includes("recommendation")) result.recommendations = valueStr;
  }
}

/**
 * Parse TML Readings sheet (tabular format with headers)
 */
function parseTmlReadingsSheet(data: any[][], result: ParsedVesselData): void {
  if (!data || data.length < 2) return;
  
  const headers = data[0]?.map((h: any) => String(h || "").toLowerCase()) || [];
  
  // Find column indices
  const cmlCol = headers.findIndex(h => h.includes('cml') && h.includes('number'));
  const tmlIdCol = headers.findIndex(h => h === 'tml id' || h.includes('tml id'));
  const locationCol = headers.findIndex(h => h === 'location' || h.includes('location'));
  const componentCol = headers.findIndex(h => h.includes('component'));
  
  // Support both "TML 1/2/3/4" format and "0°/90°/180°/270°" angle format
  let tml1Col = headers.findIndex(h => h.includes('tml 1') || h === 'tml1');
  let tml2Col = headers.findIndex(h => h.includes('tml 2') || h === 'tml2');
  let tml3Col = headers.findIndex(h => h.includes('tml 3') || h === 'tml3');
  let tml4Col = headers.findIndex(h => h.includes('tml 4') || h === 'tml4');
  
  // If TML 1-4 columns not found, look for angle columns (0°, 90°, 180°, 270°)
  if (tml1Col < 0) tml1Col = headers.findIndex(h => h.includes('0°') || h === '0' || h.includes('0 deg'));
  if (tml2Col < 0) tml2Col = headers.findIndex(h => h.includes('90°') || h === '90' || h.includes('90 deg'));
  if (tml3Col < 0) tml3Col = headers.findIndex(h => h.includes('180°') || h === '180' || h.includes('180 deg'));
  if (tml4Col < 0) tml4Col = headers.findIndex(h => h.includes('270°') || h === '270' || h.includes('270 deg'));
  
  const tActualCol = headers.findIndex(h => h.includes('t actual') || h.includes('actual') || h.includes('t-actual') || h.includes('min'));
  const nominalCol = headers.findIndex(h => h.includes('nominal') || h.includes('t-nom') || h.includes('t nom'));
  const previousCol = headers.findIndex(h => h.includes('previous') || h.includes('t-prev') || h.includes('t prev'));
  const corrosionRateCol = headers.findIndex(h => h.includes('corrosion rate') || h.includes('cr') || h.includes('rate'));
  const statusCol = headers.findIndex(h => h === 'status' || h.includes('status'));
  
  // Parse data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Skip empty rows
    const hasData = row.some(cell => cell !== undefined && cell !== null && cell !== '');
    if (!hasData) continue;
    
    const reading: any = {};
    
    if (cmlCol >= 0 && row[cmlCol] !== undefined) reading.legacyLocationId = String(row[cmlCol]);
    if (tmlIdCol >= 0 && row[tmlIdCol] !== undefined) reading.tmlId = String(row[tmlIdCol]);
    if (locationCol >= 0 && row[locationCol] !== undefined) reading.location = String(row[locationCol]);
    if (componentCol >= 0 && row[componentCol] !== undefined) reading.component = String(row[componentCol]);
    if (tml1Col >= 0 && row[tml1Col] !== undefined) reading.tml1 = row[tml1Col];
    if (tml2Col >= 0 && row[tml2Col] !== undefined) reading.tml2 = row[tml2Col];
    if (tml3Col >= 0 && row[tml3Col] !== undefined) reading.tml3 = row[tml3Col];
    if (tml4Col >= 0 && row[tml4Col] !== undefined) reading.tml4 = row[tml4Col];
    if (tActualCol >= 0 && row[tActualCol] !== undefined) reading.tActual = row[tActualCol];
    if (nominalCol >= 0 && row[nominalCol] !== undefined) reading.nominalThickness = row[nominalCol];
    if (previousCol >= 0 && row[previousCol] !== undefined) reading.previousThickness = row[previousCol];
    if (corrosionRateCol >= 0 && row[corrosionRateCol] !== undefined) reading.corrosionRate = row[corrosionRateCol];
    if (statusCol >= 0 && row[statusCol] !== undefined) reading.status = String(row[statusCol]).toLowerCase();
    
    // Only add if we have at least a CML number or TML ID
    if (reading.legacyLocationId || reading.tmlId) {
      result.tmlReadings?.push(reading);
    }
  }
}

/**
 * Parse Nozzles sheet (tabular format with headers)
 */
function parseNozzlesSheet(data: any[][], result: ParsedVesselData): void {
  if (!data || data.length < 2) return;
  
  const headers = data[0]?.map((h: any) => String(h || "").toLowerCase()) || [];
  
  // Find column indices
  const nozzleNumCol = headers.findIndex(h => h.includes('nozzle') && h.includes('number'));
  const descCol = headers.findIndex(h => h === 'description' || h.includes('description'));
  const locationCol = headers.findIndex(h => h === 'location' || h.includes('location'));
  const sizeCol = headers.findIndex(h => h.includes('nominal') && h.includes('size'));
  const scheduleCol = headers.findIndex(h => h === 'schedule' || h.includes('schedule'));
  const actualThicknessCol = headers.findIndex(h => h.includes('actual') && h.includes('thickness'));
  const pipeNominalCol = headers.findIndex(h => h.includes('pipe') && h.includes('nominal'));
  const minRequiredCol = headers.findIndex(h => h.includes('minimum') && h.includes('required'));
  const acceptableCol = headers.findIndex(h => h === 'acceptable' || h.includes('acceptable'));
  const notesCol = headers.findIndex(h => h === 'notes' || h.includes('notes'));
  
  // Parse data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Skip empty rows
    const hasData = row.some(cell => cell !== undefined && cell !== null && cell !== '');
    if (!hasData) continue;
    
    const nozzle: any = {};
    
    if (nozzleNumCol >= 0 && row[nozzleNumCol] !== undefined) nozzle.nozzleNumber = String(row[nozzleNumCol]);
    if (descCol >= 0 && row[descCol] !== undefined) nozzle.nozzleDescription = String(row[descCol]);
    if (locationCol >= 0 && row[locationCol] !== undefined) nozzle.location = String(row[locationCol]);
    if (sizeCol >= 0 && row[sizeCol] !== undefined) nozzle.nominalSize = String(row[sizeCol]);
    if (scheduleCol >= 0 && row[scheduleCol] !== undefined) nozzle.schedule = String(row[scheduleCol]);
    if (actualThicknessCol >= 0 && row[actualThicknessCol] !== undefined) nozzle.actualThickness = row[actualThicknessCol];
    if (pipeNominalCol >= 0 && row[pipeNominalCol] !== undefined) nozzle.pipeNominalThickness = row[pipeNominalCol];
    if (minRequiredCol >= 0 && row[minRequiredCol] !== undefined) nozzle.minimumRequired = row[minRequiredCol];
    if (acceptableCol >= 0 && row[acceptableCol] !== undefined) {
      const acceptVal = String(row[acceptableCol]).toLowerCase();
      nozzle.acceptable = acceptVal === 'yes' || acceptVal === 'true' || acceptVal === '1';
    }
    if (notesCol >= 0 && row[notesCol] !== undefined) nozzle.notes = String(row[notesCol]);
    
    // Only add if we have a nozzle number
    if (nozzle.nozzleNumber) {
      result.nozzles?.push(nozzle);
    }
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
  "designTemperature": "string - design temperature in Â°F",
  "operatingPressure": "string - operating pressure in psig",
  "operatingTemperature": "string - operating temperature in Â°F",
  "mdmt": "string - Minimum Design Metal Temperature in Â°F",
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
      "legacyLocationId": "string - CML number",
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
export async function parsePDFFile(buffer: Buffer, parserType?: "docupipe" | "manus" | "vision" | "hybrid" | "grok"): Promise<ParsedVesselData> {
  const selectedParser = parserType || "manus";
  logger.info(`[PDF Parser] Using parser: ${selectedParser}`);
  
  try {
    // If vision parser is requested, use vision-based extraction
    
    // If Grok parser is requested, use Grok 5.2 vision-based extraction
    if (selectedParser === "grok") {
      logger.info("[PDF Parser] Using Grok 5.2 parser for comprehensive extraction...");
      const { parseWithGrok } = await import('./grokPdfParser');
      const grokData = await parseWithGrok(buffer);
      
      // Convert Grok data to ParsedVesselData format
      return {
        vesselTagNumber: grokData.vesselInfo?.vesselTag || '',
        vesselName: grokData.vesselInfo?.vesselDescription || '',
        manufacturer: grokData.vesselInfo?.manufacturer || '',
        serialNumber: grokData.vesselInfo?.serialNumber || '',
        yearBuilt: grokData.vesselInfo?.yearBuilt ? parseInt(grokData.vesselInfo.yearBuilt, 10) : undefined,
        designPressure: grokData.vesselInfo?.designPressure || '',
        designTemperature: grokData.vesselInfo?.designTemperature || '',
        operatingPressure: grokData.vesselInfo?.operatingPressure || '',
        operatingTemperature: grokData.vesselInfo?.operatingTemperature || '',
        mdmt: grokData.vesselInfo?.mdmt || '',
        materialSpec: grokData.vesselInfo?.materialSpec || '',
        allowableStress: grokData.vesselInfo?.allowableStress || '',
        jointEfficiency: grokData.vesselInfo?.jointEfficiency || '',
        insideDiameter: grokData.vesselInfo?.insideDiameter || '',
        overallLength: grokData.vesselInfo?.overallLength || '',
        headType: grokData.vesselInfo?.headType || '',
        vesselConfiguration: grokData.vesselInfo?.vesselConfiguration || '',
        constructionCode: grokData.vesselInfo?.constructionCode || '',
        nbNumber: grokData.vesselInfo?.nbNumber || '',
        product: grokData.vesselInfo?.product || '',
        insulationType: grokData.vesselInfo?.insulationType || '',
        corrosionAllowance: grokData.vesselInfo?.corrosionAllowance || '',
        reportNumber: grokData.reportInfo?.reportNumber || grokData.inspectionInfo?.reportNumber || '',
        reportDate: grokData.reportInfo?.reportDate || grokData.inspectionInfo?.reportDate || '',
        inspectionDate: grokData.reportInfo?.inspectionDate || grokData.inspectionInfo?.inspectionDate || '',
        inspectionType: grokData.reportInfo?.inspectionType || grokData.inspectionInfo?.inspectionType || '',
        inspectorName: grokData.reportInfo?.inspectorName || grokData.inspectionInfo?.inspectorName || '',
        inspectorCert: grokData.reportInfo?.inspectorCert || grokData.inspectionInfo?.inspectorCertification || '',
        clientName: grokData.clientInfo?.clientName || grokData.inspectionInfo?.clientName || '',
        clientLocation: grokData.clientInfo?.clientLocation || grokData.inspectionInfo?.clientLocation || '',
        executiveSummary: grokData.executiveSummary || '',
        inspectionResults: grokData.inspectionResults || '',
        recommendations: grokData.recommendations || '',
        tmlReadings: grokData.thicknessMeasurements || [],
        checklistItems: grokData.checklistItems || [],
        nozzles: grokData.nozzles?.map(n => ({
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
        tableA: grokData.tableA,
      };
    }
    
    // If hybrid parser is requested, use hybrid mixed-content parsing
    if (selectedParser === "hybrid") {
      logger.info("[PDF Parser] Using hybrid parser for mixed text/scanned documents...");
      const { parseWithHybrid } = await import('./hybridPdfParser');
      const hybridData = await parseWithHybrid(buffer, "inspection-report.pdf");
      
      // Normalize the hybrid data to ParsedVesselData format
      // Hybrid parser can return nested (vesselData/vesselInfo) OR flat structure
      logger.info('[PDF Parser] Normalizing hybrid data:', {
        hasVesselData: !!hybridData.vesselData,
        hasVesselInfo: !!hybridData.vesselInfo,
        hasTopLevelVesselTag: !!hybridData.vesselTagNumber,
        tmlCount: (hybridData.tmlReadings || hybridData.thicknessMeasurements || []).length,
      });
      
      return {
        vesselTagNumber: hybridData.vesselTagNumber || hybridData.vesselData?.vesselTagNumber || hybridData.vesselInfo?.vesselTag || '',
        vesselName: hybridData.vesselName || hybridData.vesselData?.vesselName || hybridData.vesselInfo?.vesselDescription || '',
        manufacturer: hybridData.manufacturer || hybridData.vesselData?.manufacturer || hybridData.vesselInfo?.manufacturer || '',
        serialNumber: hybridData.serialNumber || hybridData.vesselData?.serialNumber || hybridData.vesselInfo?.serialNumber || '',
        yearBuilt: hybridData.yearBuilt || hybridData.vesselData?.yearBuilt || (hybridData.vesselInfo?.yearBuilt ? parseInt(hybridData.vesselInfo.yearBuilt, 10) : undefined),
        designPressure: hybridData.designPressure || hybridData.vesselData?.designPressure || hybridData.vesselInfo?.designPressure || '',
        designTemperature: hybridData.designTemperature || hybridData.vesselData?.designTemperature || hybridData.vesselInfo?.designTemperature || '',
        operatingPressure: hybridData.operatingPressure || hybridData.vesselData?.operatingPressure || hybridData.vesselInfo?.operatingPressure || '',
        operatingTemperature: hybridData.operatingTemperature || hybridData.vesselData?.operatingTemperature || hybridData.vesselInfo?.operatingTemperature || '',
        mdmt: hybridData.mdmt || hybridData.vesselData?.mdmt || hybridData.vesselInfo?.mdmt || '',
        materialSpec: hybridData.materialSpec || hybridData.vesselData?.materialSpec || hybridData.vesselInfo?.materialSpec || '',
        allowableStress: hybridData.allowableStress || hybridData.vesselData?.allowableStress || hybridData.vesselInfo?.allowableStress || '',
        jointEfficiency: hybridData.jointEfficiency || hybridData.vesselData?.jointEfficiency || hybridData.vesselInfo?.jointEfficiency || '',
        insideDiameter: hybridData.insideDiameter || hybridData.vesselData?.insideDiameter || hybridData.vesselInfo?.insideDiameter || '',
        overallLength: hybridData.overallLength || hybridData.vesselData?.overallLength || hybridData.vesselInfo?.overallLength || '',
        headType: hybridData.headType || hybridData.vesselData?.headType || hybridData.vesselInfo?.headType || '',
        vesselConfiguration: hybridData.vesselConfiguration || hybridData.vesselData?.vesselConfiguration || hybridData.vesselInfo?.vesselConfiguration || '',
        constructionCode: hybridData.constructionCode || hybridData.vesselData?.constructionCode || hybridData.vesselInfo?.constructionCode || '',
        nbNumber: hybridData.nbNumber || hybridData.vesselData?.nbNumber || hybridData.vesselInfo?.nbNumber || '',
        product: hybridData.product || hybridData.vesselData?.product || hybridData.vesselInfo?.product || '',
        insulationType: hybridData.insulationType || hybridData.vesselData?.insulationType || hybridData.vesselInfo?.insulationType || '',
        corrosionAllowance: hybridData.corrosionAllowance || hybridData.vesselData?.corrosionAllowance || hybridData.vesselInfo?.corrosionAllowance || '',
        reportNumber: hybridData.reportNumber || hybridData.reportInfo?.reportNumber || hybridData.inspectionInfo?.reportNumber || '',
        reportDate: hybridData.reportDate || hybridData.reportInfo?.reportDate || hybridData.inspectionInfo?.reportDate || '',
        inspectionDate: hybridData.inspectionDate || hybridData.reportInfo?.inspectionDate || hybridData.inspectionInfo?.inspectionDate || '',
        inspectionType: hybridData.inspectionType || hybridData.reportInfo?.inspectionType || hybridData.inspectionInfo?.inspectionType || '',
        inspectorName: hybridData.inspectorName || hybridData.reportInfo?.inspectorName || hybridData.inspectionInfo?.inspectorName || '',
        inspectorCert: hybridData.inspectorCert || hybridData.reportInfo?.inspectorCert || hybridData.inspectionInfo?.inspectorCertification || '',
        clientName: hybridData.clientName || hybridData.clientInfo?.clientName || hybridData.inspectionInfo?.clientName || '',
        clientLocation: hybridData.clientLocation || hybridData.clientInfo?.clientLocation || hybridData.inspectionInfo?.clientLocation || '',
        executiveSummary: hybridData.executiveSummary || '',
        inspectionResults: hybridData.inspectionResults || '',
        recommendations: hybridData.recommendations || '',
        tmlReadings: hybridData.tmlReadings || hybridData.thicknessMeasurements || [],
        checklistItems: hybridData.checklistItems || hybridData.inspectionChecklist || [],
        nozzles: hybridData.nozzles || [],
        tableA: hybridData.tableA,
      };
    }
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
        reportNumber: visionData.reportInfo?.reportNumber || visionData.inspectionInfo?.reportNumber || '',
        reportDate: visionData.reportInfo?.reportDate || visionData.inspectionInfo?.reportDate || '',
        inspectionDate: visionData.reportInfo?.inspectionDate || visionData.inspectionInfo?.inspectionDate || '',
        inspectionType: visionData.reportInfo?.inspectionType || visionData.inspectionInfo?.inspectionType || '',
        inspectorName: visionData.reportInfo?.inspectorName || visionData.inspectionInfo?.inspectorName || '',
        inspectorCert: visionData.reportInfo?.inspectorCert || visionData.inspectionInfo?.inspectorCertification || '',
        clientName: visionData.clientInfo?.clientName || visionData.inspectionInfo?.clientName || '',
        clientLocation: visionData.clientInfo?.clientLocation || visionData.inspectionInfo?.clientLocation || '',
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
    
    // For manus parser, use the standardized parser which has a better prompt
    if (selectedParser === "manus") {
      logger.info("[PDF Parser] Using Manus standardized parser for structured extraction...");
      try {
        const manusResult = await parseAndStandardizeWithManus(buffer, "inspection-report.pdf");
        if (manusResult && manusResult.vesselTagNumber) {
          logger.info("[PDF Parser] Manus standardized parser succeeded:", {
            vesselTag: manusResult.vesselTagNumber,
            tmlReadings: manusResult.tmlReadings?.length || 0,
            checklistItems: manusResult.checklistItems?.length || 0,
            nozzles: manusResult.nozzles?.length || 0,
          });
          return manusResult;
        }
        logger.warn("[PDF Parser] Manus standardized parser returned empty result, falling back to basic extraction...");
      } catch (err) {
        logger.warn("[PDF Parser] Manus standardized parser failed, falling back to basic extraction:", err);
      }
    }

    // Fallback: Use basic parsing + LLM extraction
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
            content: `Extract vessel inspection data from this API 510 report:\n\n${fullText.substring(0, 120000)}`,
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
                      legacyLocationId: { type: "string" },
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


