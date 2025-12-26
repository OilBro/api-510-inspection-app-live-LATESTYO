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
  serialNumber?: string;
  yearBuilt?: number;
  designPressure?: string;
  designTemperature?: string;
  operatingPressure?: string;
  operatingTemperature?: string;
  mdmt?: string;
  materialSpec?: string;
  allowableStress?: string;
  jointEfficiency?: string;
  specificGravity?: string;
  vesselType?: string;
  product?: string;
  constructionCode?: string;
  vesselConfiguration?: string;
  headType?: string;
  insulationType?: string;
  nbNumber?: string;
  insideDiameter?: string;
  overallLength?: string;
  crownRadius?: string;
  knuckleRadius?: string;
  corrosionAllowance?: string;
  radiographyType?: string;
  
  // Inspection Details fields
  reportNumber?: string;
  reportDate?: string;
  inspectionDate?: string;
  inspectionType?: string;
  inspectionCompany?: string;
  inspectorName?: string;
  inspectorCert?: string;
  clientName?: string;
  clientLocation?: string;
  executiveSummary?: string;
  inspectionResults?: string;
  recommendations?: string;
  
  tmlReadings?: Array<{
    cmlNumber?: string;
    tmlId?: string;
    location?: string;
    component?: string;
    componentType?: string;
    service?: string;
    readingType?: string;
    nozzleSize?: string;
    angle?: string;
    tml1?: string | number;
    tml2?: string | number;
    tml3?: string | number;
    tml4?: string | number;
    tActual?: string | number;
    currentThickness?: string | number;
    previousThickness?: string | number;
    nominalThickness?: string | number;
    minimumRequired?: number;
    loss?: string | number;
    lossPercent?: string | number;
    corrosionRate?: string | number;
    status?: string;
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
 * Supports the comprehensive API 510 import template with multiple sheets
 */
export async function parseExcelFile(buffer: Buffer): Promise<ParsedVesselData> {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const result: ParsedVesselData = {
      tmlReadings: [],
      nozzles: [],
      checklistItems: [],
    };

    logger.info(`[Excel Parser] Processing workbook with sheets: ${workbook.SheetNames.join(', ')}`);

    // Process each sheet by name
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetNameLower = sheetName.toLowerCase();
      
      if (sheetNameLower.includes('vessel') && sheetNameLower.includes('info')) {
        // Parse Vessel Information sheet (Field/Value format)
        parseVesselInfoSheet(worksheet, result);
      } else if (sheetNameLower.includes('tml') || sheetNameLower.includes('reading') || sheetNameLower.includes('thickness')) {
        // Parse TML Readings sheet (tabular format)
        parseTmlReadingsSheet(worksheet, result);
      } else if (sheetNameLower.includes('nozzle')) {
        // Parse Nozzles sheet (tabular format)
        parseNozzlesSheet(worksheet, result);
      } else if (sheetNameLower.includes('inspection') && sheetNameLower.includes('detail')) {
        // Parse Inspection Details sheet (Field/Value format)
        parseInspectionDetailsSheet(worksheet, result);
      } else if (!sheetNameLower.includes('instruction')) {
        // Try to parse as generic data sheet
        parseGenericSheet(worksheet, result);
      }
    }

    logger.info(`[Excel Parser] Extracted: vessel=${result.vesselTagNumber}, TMLs=${result.tmlReadings?.length}, nozzles=${result.nozzles?.length}`);
    return result;
  } catch (error) {
    logger.error("[Excel Parser] Error:", error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Parse Vessel Information sheet (Field/Value/Notes format)
 */
function parseVesselInfoSheet(worksheet: XLSX.WorkSheet, result: ParsedVesselData): void {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  // Field mapping for vessel information
  const fieldMap: Record<string, keyof ParsedVesselData> = {
    'vessel tag number': 'vesselTagNumber',
    'vessel name': 'vesselName',
    'manufacturer': 'manufacturer',
    'serial number': 'serialNumber',
    'year built': 'yearBuilt',
    'design pressure': 'designPressure',
    'design temperature': 'designTemperature',
    'operating pressure': 'operatingPressure',
    'operating temperature': 'operatingTemperature',
    'mdmt': 'mdmt',
    'minimum design metal temperature': 'mdmt',
    'material specification': 'materialSpec',
    'material spec': 'materialSpec',
    'allowable stress': 'allowableStress',
    'joint efficiency': 'jointEfficiency',
    'specific gravity': 'specificGravity',
    'vessel type': 'vesselType',
    'product': 'product',
    'product/service': 'product',
    'service': 'product',
    'construction code': 'constructionCode',
    'vessel configuration': 'vesselConfiguration',
    'head type': 'headType',
    'insulation type': 'insulationType',
    'nb number': 'nbNumber',
    'national board': 'nbNumber',
    'inside diameter': 'insideDiameter',
    'overall length': 'overallLength',
    'crown radius': 'crownRadius',
    'knuckle radius': 'knuckleRadius',
    'corrosion allowance': 'corrosionAllowance',
    'radiography type': 'radiographyType',
  };

  for (const row of data) {
    if (!row || row.length < 2) continue;
    
    const fieldName = String(row[0] || '').toLowerCase().trim();
    const value = row[1];
    
    if (!fieldName || value === undefined || value === null || value === '') continue;
    
    // Find matching field
    for (const [pattern, targetField] of Object.entries(fieldMap)) {
      if (fieldName.includes(pattern)) {
        if (targetField === 'yearBuilt') {
          const numVal = parseInt(String(value));
          if (!isNaN(numVal)) {
            result.yearBuilt = numVal;
          }
        } else {
          (result as any)[targetField] = String(value).trim();
        }
        break;
      }
    }
  }
}

/**
 * Parse TML Readings sheet (tabular format with headers)
 */
function parseTmlReadingsSheet(worksheet: XLSX.WorkSheet, result: ParsedVesselData): void {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (data.length < 2) return; // Need at least header + 1 data row
  
  // Get headers from first row
  const headers = data[0]?.map((h: any) => String(h || '').toLowerCase().trim()) || [];
  
  // Column index mapping
  const colMap: Record<string, number> = {};
  const headerPatterns: Record<string, string[]> = {
    'cmlNumber': ['cml number', 'cml', 'cml #'],
    'tmlId': ['tml id', 'tml', 'tml #'],
    'location': ['location', 'loc'],
    'componentType': ['component type', 'component', 'area'],
    'service': ['service'],
    'readingType': ['reading type', 'type'],
    'nozzleSize': ['nozzle size', 'size'],
    'angle': ['angle'],
    'tml1': ['tml 1', 'tml1', 'reading 1'],
    'tml2': ['tml 2', 'tml2', 'reading 2'],
    'tml3': ['tml 3', 'tml3', 'reading 3'],
    'tml4': ['tml 4', 'tml4', 'reading 4'],
    'tActual': ['t actual', 'tactual', 'actual', 'minimum'],
    'nominalThickness': ['nominal thickness', 'nominal', 'design thickness'],
    'previousThickness': ['previous thickness', 'previous', 'last reading', 'prior'],
    'currentThickness': ['current thickness', 'current'],
    'loss': ['loss'],
    'lossPercent': ['loss %', 'loss percent', '%'],
    'corrosionRate': ['corrosion rate', 'rate', 'mpy'],
    'status': ['status', 'condition'],
  };
  
  // Find column indices
  for (const [field, patterns] of Object.entries(headerPatterns)) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (patterns.some(p => header.includes(p))) {
        colMap[field] = i;
        break;
      }
    }
  }
  
  // Parse data rows (skip header and any instruction rows)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Skip instruction/example rows
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('corrosion monitoring') || firstCell.includes('example') || firstCell.includes('instruction')) {
      continue;
    }
    
    // Check if row has meaningful data
    const hasData = row.some((cell: any) => cell !== undefined && cell !== null && cell !== '');
    if (!hasData) continue;
    
    const reading: any = {};
    
    // Extract values based on column mapping
    if (colMap.cmlNumber !== undefined) reading.cmlNumber = String(row[colMap.cmlNumber] || '');
    if (colMap.tmlId !== undefined) reading.tmlId = String(row[colMap.tmlId] || '');
    if (colMap.location !== undefined) reading.location = String(row[colMap.location] || '');
    if (colMap.componentType !== undefined) reading.component = String(row[colMap.componentType] || 'Shell');
    if (colMap.service !== undefined) reading.service = String(row[colMap.service] || '');
    if (colMap.readingType !== undefined) reading.readingType = String(row[colMap.readingType] || '');
    if (colMap.nozzleSize !== undefined) reading.nozzleSize = String(row[colMap.nozzleSize] || '');
    if (colMap.angle !== undefined) reading.angle = String(row[colMap.angle] || '');
    if (colMap.tml1 !== undefined && row[colMap.tml1]) reading.tml1 = row[colMap.tml1];
    if (colMap.tml2 !== undefined && row[colMap.tml2]) reading.tml2 = row[colMap.tml2];
    if (colMap.tml3 !== undefined && row[colMap.tml3]) reading.tml3 = row[colMap.tml3];
    if (colMap.tml4 !== undefined && row[colMap.tml4]) reading.tml4 = row[colMap.tml4];
    if (colMap.tActual !== undefined && row[colMap.tActual]) reading.tActual = row[colMap.tActual];
    if (colMap.nominalThickness !== undefined && row[colMap.nominalThickness]) reading.nominalThickness = row[colMap.nominalThickness];
    if (colMap.previousThickness !== undefined && row[colMap.previousThickness]) reading.previousThickness = row[colMap.previousThickness];
    if (colMap.currentThickness !== undefined && row[colMap.currentThickness]) reading.currentThickness = row[colMap.currentThickness];
    if (colMap.loss !== undefined && row[colMap.loss]) reading.loss = row[colMap.loss];
    if (colMap.lossPercent !== undefined && row[colMap.lossPercent]) reading.lossPercent = row[colMap.lossPercent];
    if (colMap.corrosionRate !== undefined && row[colMap.corrosionRate]) reading.corrosionRate = row[colMap.corrosionRate];
    if (colMap.status !== undefined) reading.status = String(row[colMap.status] || '');
    
    // Use T Actual as current thickness if not separately provided
    if (!reading.currentThickness && reading.tActual) {
      reading.currentThickness = reading.tActual;
    }
    
    // Only add if we have at least an ID or location
    if (reading.cmlNumber || reading.tmlId || reading.location) {
      result.tmlReadings?.push(reading);
    }
  }
}

/**
 * Parse Nozzles sheet (tabular format with headers)
 */
function parseNozzlesSheet(worksheet: XLSX.WorkSheet, result: ParsedVesselData): void {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (data.length < 2) return;
  
  const headers = data[0]?.map((h: any) => String(h || '').toLowerCase().trim()) || [];
  
  // Column index mapping for nozzles
  const colMap: Record<string, number> = {};
  const headerPatterns: Record<string, string[]> = {
    'nozzleNumber': ['nozzle number', 'nozzle', 'nozzle #', 'number'],
    'description': ['description', 'service', 'desc'],
    'location': ['location', 'loc'],
    'nominalSize': ['nominal size', 'size', 'pipe size'],
    'schedule': ['schedule', 'sch'],
    'actualThickness': ['actual thickness', 'actual', 'measured'],
    'pipeNominalThickness': ['pipe nominal', 'nominal thickness', 'original'],
    'minimumRequired': ['minimum required', 'min required', 'minimum', 'min req'],
    'acceptable': ['acceptable', 'accept'],
    'notes': ['notes', 'comments', 'remarks'],
  };
  
  for (const [field, patterns] of Object.entries(headerPatterns)) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (patterns.some(p => header.includes(p))) {
        colMap[field] = i;
        break;
      }
    }
  }
  
  // Parse data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Skip instruction rows
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('nozzle identifier') || firstCell.includes('example')) {
      continue;
    }
    
    const hasData = row.some((cell: any) => cell !== undefined && cell !== null && cell !== '');
    if (!hasData) continue;
    
    const nozzle: any = {
      nozzleNumber: '',
      nominalSize: '',
    };
    
    if (colMap.nozzleNumber !== undefined) nozzle.nozzleNumber = String(row[colMap.nozzleNumber] || '');
    if (colMap.description !== undefined) nozzle.nozzleDescription = String(row[colMap.description] || '');
    if (colMap.location !== undefined) nozzle.location = String(row[colMap.location] || '');
    if (colMap.nominalSize !== undefined) nozzle.nominalSize = String(row[colMap.nominalSize] || '');
    if (colMap.schedule !== undefined) nozzle.schedule = String(row[colMap.schedule] || '');
    if (colMap.actualThickness !== undefined && row[colMap.actualThickness]) nozzle.actualThickness = row[colMap.actualThickness];
    if (colMap.pipeNominalThickness !== undefined && row[colMap.pipeNominalThickness]) nozzle.pipeNominalThickness = row[colMap.pipeNominalThickness];
    if (colMap.minimumRequired !== undefined && row[colMap.minimumRequired]) nozzle.minimumRequired = row[colMap.minimumRequired];
    if (colMap.acceptable !== undefined) {
      const val = String(row[colMap.acceptable] || '').toLowerCase();
      nozzle.acceptable = val === 'yes' || val === 'true' || val === '1';
    }
    if (colMap.notes !== undefined) nozzle.notes = String(row[colMap.notes] || '');
    
    // Only add if we have a nozzle number
    if (nozzle.nozzleNumber) {
      result.nozzles?.push(nozzle);
    }
  }
}

/**
 * Parse Inspection Details sheet (Field/Value format)
 */
function parseInspectionDetailsSheet(worksheet: XLSX.WorkSheet, result: ParsedVesselData): void {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  const fieldMap: Record<string, keyof ParsedVesselData> = {
    'report number': 'reportNumber',
    'report date': 'reportDate',
    'inspection date': 'inspectionDate',
    'inspection type': 'inspectionType',
    'inspection company': 'inspectionCompany',
    'inspector name': 'inspectorName',
    'inspector certification': 'inspectorCert',
    'client name': 'clientName',
    'client location': 'clientLocation',
    'executive summary': 'executiveSummary',
    'inspection results': 'inspectionResults',
    'recommendations': 'recommendations',
  };
  
  // For multi-line fields, we need to accumulate content
  let currentField: keyof ParsedVesselData | null = null;
  let accumulatedContent: string[] = [];
  
  const saveAccumulated = () => {
    if (currentField && accumulatedContent.length > 0) {
      (result as any)[currentField] = accumulatedContent.join('\n').trim();
    }
    accumulatedContent = [];
    currentField = null;
  };
  
  for (const row of data) {
    if (!row) continue;
    
    const fieldName = String(row[0] || '').toLowerCase().trim();
    const value = row[1];
    
    // Check if this is a new field
    let foundField = false;
    for (const [pattern, targetField] of Object.entries(fieldMap)) {
      if (fieldName.includes(pattern)) {
        // Save any accumulated content from previous field
        saveAccumulated();
        
        if (value !== undefined && value !== null && value !== '') {
          (result as any)[targetField] = String(value).trim();
        } else {
          // This might be a multi-line field, start accumulating
          currentField = targetField;
        }
        foundField = true;
        break;
      }
    }
    
    // If we're accumulating and this isn't a new field, add content
    if (!foundField && currentField && row[0]) {
      accumulatedContent.push(String(row[0]).trim());
    }
  }
  
  // Save any remaining accumulated content
  saveAccumulated();
}

/**
 * Parse generic sheet (fallback for unrecognized sheets)
 */
function parseGenericSheet(worksheet: XLSX.WorkSheet, result: ParsedVesselData): void {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  // Look for vessel identification data in key-value pairs
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length - 1; j++) {
      const key = String(row[j] || "").toLowerCase();
      const value = String(row[j + 1] || "").trim();

      if (!value) continue;

      // Match vessel identification fields
      if (key.includes("tag") || key.includes("vessel id")) {
        if (!result.vesselTagNumber) result.vesselTagNumber = value;
      } else if (key.includes("vessel name") || key.includes("equipment")) {
        if (!result.vesselName) result.vesselName = value;
      } else if (key.includes("manufacturer") || key.includes("fabricator")) {
        if (!result.manufacturer) result.manufacturer = value;
      } else if (key.includes("year") && key.includes("built")) {
        if (!result.yearBuilt) result.yearBuilt = parseInt(value);
      } else if (key.includes("design pressure") || key.includes("mawp")) {
        if (!result.designPressure) result.designPressure = value;
      } else if (key.includes("design temp")) {
        if (!result.designTemperature) result.designTemperature = value;
      } else if (key.includes("operating pressure")) {
        if (!result.operatingPressure) result.operatingPressure = value;
      } else if (key.includes("material")) {
        if (!result.materialSpec) result.materialSpec = value;
      } else if (key.includes("diameter") || key.includes("id")) {
        if (!result.insideDiameter) result.insideDiameter = value;
      } else if (key.includes("length")) {
        if (!result.overallLength) result.overallLength = value;
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

/**
 * Parse PDF file using Docupipe standardized extraction
 */
export async function parsePDFFile(buffer: Buffer, parserType?: "docupipe" | "manus" | "vision" | "documentai"): Promise<ParsedVesselData> {
  // Use provided parser type or fall back to default
  const selectedParser = parserType || "manus";
  logger.info(`[PDF Parser] Using parser: ${selectedParser}`);
  
  try {
    // If Document AI parser is requested, use Google Cloud Document AI + Manus AI
    if (selectedParser === "documentai") {
      logger.info("[PDF Parser] Using Google Cloud Document AI + Manus AI parser...");
      
      const { parseWithDocumentAi, isDocumentAiConfigured } = await import('./documentAiParser');
      
      if (!isDocumentAiConfigured()) {
        throw new Error('Document AI is not configured. Please set up your Google Cloud service account credentials in Settings > Secrets.');
      }
      
      const { parsedData, metadata } = await parseWithDocumentAi(buffer);
      
      logger.info(`[PDF Parser] Document AI extracted ${metadata.textLength} chars from ${metadata.pages} pages (OCR confidence: ${(metadata.ocrConfidence * 100).toFixed(1)}%)`);
      
      // Convert Document AI parsed data to ParsedVesselData format
      return {
        // Report Information
        reportNumber: parsedData.reportInfo?.reportNumber || '',
        reportDate: parsedData.reportInfo?.reportDate || '',
        inspectionDate: parsedData.reportInfo?.inspectionDate || '',
        inspectionType: parsedData.reportInfo?.inspectionType || '',
        inspectionCompany: parsedData.reportInfo?.inspectionCompany || '',
        inspectorName: parsedData.reportInfo?.inspectorName || '',
        inspectorCert: parsedData.reportInfo?.inspectorCert || '',
        
        // Client Information
        clientName: parsedData.clientInfo?.clientName || '',
        clientLocation: parsedData.clientInfo?.clientLocation || '',
        product: parsedData.clientInfo?.product || parsedData.vesselData?.service || '',
        
        // Vessel Information
        vesselTagNumber: parsedData.vesselData?.equipmentNumber || '',
        vesselName: parsedData.vesselData?.equipmentName || '',
        manufacturer: parsedData.vesselData?.manufacturer || '',
        yearBuilt: parsedData.vesselData?.yearBuilt ? parseInt(String(parsedData.vesselData.yearBuilt), 10) : undefined,
        nbNumber: parsedData.vesselData?.nbNumber || '',
        constructionCode: parsedData.vesselData?.constructionCode || '',
        vesselType: parsedData.vesselData?.vesselType || '',
        designPressure: parsedData.vesselData?.designPressure || parsedData.vesselData?.mawp || '',
        designTemperature: parsedData.vesselData?.designTemperature || '',
        operatingPressure: parsedData.vesselData?.operatingPressure || '',
        corrosionAllowance: parsedData.vesselData?.corrosionAllowance || '',
        insideDiameter: parsedData.vesselData?.insideDiameter || '',
        overallLength: parsedData.vesselData?.overallLength || '',
        materialSpec: parsedData.vesselData?.materialSpecification || '',
        headType: parsedData.vesselData?.headType || '',
        
        // ASME Calculation Parameters
        allowableStress: parsedData.asmeParameters?.sValue || '',
        jointEfficiency: parsedData.asmeParameters?.eValue || '',
        crownRadius: parsedData.asmeParameters?.crownRadius || '',
        knuckleRadius: parsedData.asmeParameters?.knuckleRadius || '',
        
        // Summary and Results
        executiveSummary: parsedData.executiveSummary?.overallCondition || '',
        inspectionResults: parsedData.inspectionResults || '',
        recommendations: parsedData.recommendations || '',
        
        // TML Readings and Nozzles
        tmlReadings: (parsedData.tmlReadings || []).map((t: any) => ({
          tmlId: t.locationId || '',
          location: t.description || '',
          component: t.component || 'Shell',
          currentThickness: t.actualThickness || '',
          nominalThickness: t.nominalThickness || '',
          minimumRequired: t.minRequired ? parseFloat(t.minRequired) : undefined,
        })),
        nozzles: (parsedData.nozzleEvaluations || []).map((n: any) => ({
          nozzleNumber: n.nozzleId || '',
          nozzleDescription: n.serviceDescription || '',
          nominalSize: n.size || '',
          schedule: n.schedule || '',
          notes: n.condition || '',
        })),
      };
    }
    
    // If vision parser is requested, use vision-based extraction
    if (selectedParser === "vision") {
      logger.info("[PDF Parser] Using vision LLM parser for scanned documents...");
      const { parseWithVision } = await import('./visionPdfParser');
      const visionData = await parseWithVision(buffer);
      
      // Convert vision data to ParsedVesselData format (comprehensive mapping)
      return {
        // Report Information
        reportNumber: visionData.reportInfo?.reportNumber || '',
        reportDate: visionData.reportInfo?.reportDate || '',
        inspectionDate: visionData.reportInfo?.inspectionDate || '',
        inspectionType: visionData.reportInfo?.inspectionType || '',
        inspectionCompany: visionData.reportInfo?.inspectionCompany || '',
        inspectorName: visionData.reportInfo?.inspectorName || '',
        inspectorCert: visionData.reportInfo?.inspectorCert || '',
        
        // Client Information
        clientName: visionData.clientInfo?.clientName || '',
        clientLocation: visionData.clientInfo?.clientLocation || '',
        product: visionData.clientInfo?.product || visionData.vesselInfo?.product || '',
        
        // Vessel Information
        vesselTagNumber: visionData.vesselInfo?.vesselTag || '',
        vesselName: visionData.vesselInfo?.vesselDescription || '',
        manufacturer: visionData.vesselInfo?.manufacturer || '',
        yearBuilt: visionData.vesselInfo?.yearBuilt ? parseInt(visionData.vesselInfo.yearBuilt, 10) : undefined,
        nbNumber: visionData.vesselInfo?.nbNumber || '',
        constructionCode: visionData.vesselInfo?.constructionCode || '',
        vesselType: visionData.vesselInfo?.vesselType || '',
        vesselConfiguration: visionData.vesselInfo?.vesselConfiguration || '',
        designPressure: visionData.vesselInfo?.designPressure || '',
        designTemperature: visionData.vesselInfo?.designTemperature || '',
        operatingPressure: visionData.vesselInfo?.operatingPressure || '',
        corrosionAllowance: visionData.vesselInfo?.corrosionAllowance || '',
        insideDiameter: visionData.vesselInfo?.insideDiameter || '',
        overallLength: visionData.vesselInfo?.overallLength || '',
        materialSpec: visionData.vesselInfo?.materialSpec || '',
        headType: visionData.vesselInfo?.headType || '',
        insulationType: visionData.vesselInfo?.insulationType || '',
        
        // ASME Calculation Parameters
        allowableStress: visionData.vesselInfo?.allowableStress || '',
        jointEfficiency: visionData.vesselInfo?.jointEfficiency || '',
        specificGravity: visionData.vesselInfo?.specificGravity || '',
        crownRadius: visionData.vesselInfo?.crownRadius || '',
        knuckleRadius: visionData.vesselInfo?.knuckleRadius || '',
        
        // Summary and Results
        executiveSummary: visionData.executiveSummary || '',
        inspectionResults: visionData.inspectionResults || '',
        recommendations: visionData.recommendations || '',
        
        // TML Readings, Checklist, and Nozzles
        tmlReadings: visionData.thicknessMeasurements || [],
        checklistItems: visionData.checklistItems || [],
        nozzles: (visionData.nozzles || []).map(n => ({
          nozzleNumber: n.nozzleNumber || '',
          nozzleDescription: n.service || n.description || '',
          nominalSize: n.size || '',
          schedule: n.schedule || '',
          actualThickness: n.actualThickness,
          pipeNominalThickness: n.nominalThickness,
          minimumRequired: n.minimumRequired,
          acceptable: n.acceptable,
          notes: n.notes || '',
        })),
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
